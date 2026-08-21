const express = require('express');
const { query, pool } = require('../config/db');
const auth = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// ─── Crypto helpers ──────────────────────────────────────────────────────────

/**
 * Derive a 32-byte key using HKDF-like construction from a master secret.
 * Using scryptSync with a per-record salt so each packet gets a unique key.
 */
function derivePacketKey(salt) {
  const master = process.env.PACKET_ENCRYPTION_SECRET || 'eron-packet-secret-change-in-prod';
  return crypto.scryptSync(master, salt, 32);
}

/**
 * Encrypt patientData with AES-256-GCM.
 * Returns { iv, salt, authTag, encryptedData } all as hex strings.
 */
function encryptPacket(data) {
  const salt = crypto.randomBytes(16).toString('hex'); // 32 hex chars stored in packets.iv-like field
  const key = derivePacketKey(salt);
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return {
    iv: iv.toString('hex'),
    salt,
    authTag,
    encryptedData: encrypted
  };
}

/**
 * Decrypt an AES-256-GCM packet.
 */
function decryptPacket({ encryptedData, iv, salt, authTag }) {
  const key = derivePacketKey(salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

/**
 * Derive the unique patient key from a phone number using HMAC-SHA256.
 * Deterministic: same phone → same key. Non-reversible without the secret.
 */
function derivePatientKey(phoneNumber) {
  const secret = process.env.PATIENT_KEY_SECRET || 'eron-patient-key-secret-change-in-prod';
  // Normalise: keep digits only, handle +91 prefix
  const normalised = String(phoneNumber).replace(/\D/g, '').replace(/^91/, '');
  return crypto.createHmac('sha256', secret).update(normalised).digest('hex');
}

/**
 * Validate an Indian mobile number (10 digits, optionally prefixed with +91 or 91).
 */
function isValidPhone(phone) {
  return /^(\+91|91)?[6-9]\d{9}$/.test(String(phone).replace(/\s/g, ''));
}

// ─── Blockchain audit chain helpers ──────────────────────────────────────────

const GENESIS_HASH = crypto.createHash('sha256').update('ERON-GENESIS-BLOCK-v1').digest('hex');

/**
 * Append one event to the referral_events chain for a referral.
 * Also writes to referral_status_log for backward compatibility when action is a status transition.
 */
async function appendChainEvent(client, { referralId, action, actor, payload }) {
  // Get tail of the chain
  const prevRes = await client.query(
    'SELECT event_hash FROM referral_events WHERE referral_id = $1 ORDER BY id DESC LIMIT 1',
    [referralId]
  );
  const prevHash = prevRes.rows.length > 0 ? prevRes.rows[0].event_hash : GENESIS_HASH;

  const timestamp = new Date().toISOString();
  const eventPayload = JSON.stringify({ referralId, action, actor, payload, prevHash, timestamp });
  const eventHash = crypto.createHash('sha256').update(eventPayload).digest('hex');

  await client.query(
    `INSERT INTO referral_events (referral_id, action, actor, payload, event_hash, prev_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [referralId, action, String(actor), JSON.stringify(payload || {}), eventHash, prevHash, timestamp]
  );

  return eventHash;
}

/**
 * Backward-compat: also write to referral_status_log for status transitions.
 */
async function createAuditLog(client, referralId, fromStatus, toStatus, actorId) {
  const prevRes = await client.query(
    'SELECT event_hash FROM referral_status_log WHERE referral_id = $1 ORDER BY id DESC LIMIT 1',
    [referralId]
  );
  const prevHash = prevRes.rows.length > 0 ? prevRes.rows[0].event_hash : GENESIS_HASH;

  const eventPayload = JSON.stringify({ referralId, fromStatus, toStatus, actorId, prevHash });
  const eventHash = crypto.createHash('sha256').update(eventPayload).digest('hex');

  await client.query(
    `INSERT INTO referral_status_log (referral_id, from_status, to_status, actor_id, prev_hash, event_hash)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [referralId, fromStatus, toStatus, actorId, prevHash, eventHash]
  );

  // Also log to the primary chain
  await appendChainEvent(client, {
    referralId,
    action: `STATUS_TRANSITION:${fromStatus}->${toStatus}`,
    actor: String(actorId),
    payload: { fromStatus, toStatus }
  });
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/**
 * Fetch a referral row with hospital names joined, then map to client shape.
 * Use this for WS emits so originHospitalName / targetHospitalName are always
 * populated — never "Hospital #N".
 */
async function mapReferralWithJoin(clientOrPool, referralId) {
  const res = await clientOrPool.query(
    `SELECT r.*, hs.name AS sending_hospital_name, hr.name AS receiving_hospital_name
     FROM referrals r
     LEFT JOIN hospitals hs ON hs.id = r.sending_hospital_id
     LEFT JOIN hospitals hr ON hr.id = r.receiving_hospital_id
     WHERE r.id = $1`,
    [referralId]
  );
  if (res.rows.length === 0) return null;
  return mapReferralToClient(res.rows[0]);
}

function mapReferralToClient(row) {
  if (!row) return null;
  const caps = row.required_capabilities || [];
  const pd   = row.patient_data || {};
  return {
    id:                 row.id,
    patientRefCode:     row.patient_ref_id,
    patientKey:         row.patient_key || null,
    // Integer IDs — frontend must use String() when comparing to authSession.hospitalId
    originHospitalId:   row.sending_hospital_id,
    targetHospitalId:   row.receiving_hospital_id,
    acceptedHospitalId: (row.status === 'ACCEPTED' || row.status === 'COMPLETED' || row.status === 'HOSPITAL_CONFIRMED' || row.status === 'IN_TRANSIT')
                          ? row.receiving_hospital_id : null,
    status:             row.status,
    requiredCapabilities: caps,
    // Also expose as requiredResources so UI chips work from either field
    requiredResources:  caps,
    // Human-readable summary for dashboard cards
    requirementSummary: pd.diagnosisSuspected
      ? `${pd.diagnosisSuspected}${caps.length ? ' — Requires ' + caps.slice(0, 3).join(', ') : ''}`
      : (caps.length ? caps.join(', ') : 'Emergency Referral'),
    // Hospital names — populated below via joinedRow if available, else fallback
    originHospitalName:  row.sending_hospital_name   || `Hospital #${row.sending_hospital_id}`,
    targetHospitalName:  row.receiving_hospital_name  || (row.receiving_hospital_id ? `Hospital #${row.receiving_hospital_id}` : 'Pending Match'),
    createdAt:          row.created_at || new Date().toISOString(),
    timeoutSeconds:     row.timeout_seconds || 300,
    ambulance:          row.ambulance || null,
    rejectionReason:    row.rejection_reason || null,
    patientData:        pd.patientName ? pd : {
      patientName:         'Unknown Patient',
      patientAge:          0,
      patientSex:          'UNKNOWN',
      diagnosisSuspected:  'Pending',
      referringDoctorName: 'Duty Doctor',
      reasonForReferral:   'Pending'
    }
  };
}

function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateEtaMinutes(distanceKm, priority = 'URGENT') {
  const speedKmH = priority === 'CRITICAL' ? 42 : 35;
  return Math.max(3, Math.round((distanceKm / speedKmH) * 60) + 2);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/referrals/extract
router.post('/extract', auth(), async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  try {
    let result = null;

    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Extract the following medical referral details from this text and return ONLY valid JSON: requiredCapabilities (array of strings, e.g. NEUROSURGERY, CARDIOLOGY), requiredResources (array of strings, e.g. ICU_BED, VENTILATOR), priority (CRITICAL, URGENT, or STABLE). Text: "${text}"` }] }],
              generationConfig: { response_mime_type: 'application/json' }
            })
          }
        );
        if (response.ok) {
          const data = await response.json();
          result = JSON.parse(data.candidates[0].content.parts[0].text);
        }
      } catch (e) {
        console.error('Gemini API failed, falling back to regex:', e);
      }
    }

    if (!result) {
      const caps = [], resTypes = [];
      let prio = 'URGENT';
      const lower = text.toLowerCase();
      if (lower.includes('neuro') || lower.includes('brain')) caps.push('NEUROSURGERY');
      if (lower.includes('cardio') || lower.includes('heart')) caps.push('CARDIOLOGY');
      if (lower.includes('burn')) caps.push('BURN_UNIT');
      if (lower.includes('icu')) resTypes.push('ICU_BED');
      if (lower.includes('ventilator') || lower.includes('vent')) resTypes.push('VENTILATOR');
      if (lower.includes('critical') || lower.includes('immediate')) prio = 'CRITICAL';
      else if (lower.includes('stable')) prio = 'STABLE';
      result = { requiredCapabilities: caps, requiredResources: resTypes, priority: prio };
    }

    res.json(result);
  } catch (err) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: 'Extraction failed' });
  }
});

// POST /api/referrals/match
router.post('/match', auth(), async (req, res) => {
  try {
    const { requiredCapabilities = [], requiredResources = [], originHospitalId, priority = 'URGENT' } = req.body;

    let originLat = 28.7041, originLng = 77.1025;
    if (originHospitalId) {
      const origRes = await query('SELECT location_lat, location_lng FROM hospitals WHERE id = $1', [originHospitalId]);
      if (origRes.rows.length > 0) {
        originLat = origRes.rows[0].location_lat;
        originLng = origRes.rows[0].location_lng;
      }
    }

    const hospRes = await query(`
      SELECT h.*,
        json_agg(json_build_object('type', b.bed_type, 'total', b.total, 'available', b.available)) as resources
      FROM hospitals h
      LEFT JOIN beds_capacity b ON h.id = b.hospital_id
      GROUP BY h.id
    `);

    const candidates = [];
    for (const hosp of hospRes.rows) {
      if (hosp.id == originHospitalId) continue;

      const hospCaps = hosp.capabilities || [];
      if (requiredCapabilities.length > 0 && !requiredCapabilities.every(c => hospCaps.includes(c))) continue;

      let hasAllResources = true;
      let totalHeadroomSum = 0, resourceCount = 0;

      for (const reqRes of requiredResources) {
        const resPool = hosp.resources.find(r => r.type === reqRes);
        if (!resPool || resPool.available <= 0) { hasAllResources = false; break; }
        totalHeadroomSum += resPool.available / (resPool.total || 1);
        resourceCount++;
      }

      if (requiredResources.length > 0 && !hasAllResources) continue;

      const distKm = getHaversineDistanceKm(originLat, originLng, hosp.location_lat, hosp.location_lng);
      const etaMinutes = estimateEtaMinutes(distKm, priority);
      const capabilityScore = 1.0;
      const capacityHeadroomScore = resourceCount > 0 ? totalHeadroomSum / resourceCount : 0.5;
      const normalizedEtaScore = Math.max(0, 1 - distKm / 40);
      const finalScore = 0.40 * capabilityScore + 0.15 * capacityHeadroomScore + 0.35 * normalizedEtaScore + 0.10 * 0;

      candidates.push({
        hospitalId: hosp.id,
        hospitalName: hosp.name,
        lat: hosp.location_lat,
        lng: hosp.location_lng,
        distanceKm: parseFloat(distKm.toFixed(1)),
        etaMinutes,
        score: parseFloat(finalScore.toFixed(3)),
        availableResources: hosp.resources.map(r => ({ type: r.type, available: r.available, total: r.total }))
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    res.json({ matches: candidates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/referrals ──────────────────────────────────────────────────────
// Core referral creation: phone capture, patient key derivation, AES-256-GCM encryption,
// blockchain audit chain event, bed soft-hold.
router.post('/', auth(['referral_staff', 'control_room_admin', 'DOCTOR']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      targetHospitalId,
      requiredCapabilities,
      requiredResources,
      patientData,
      timeoutMinutes: tmRaw
    } = req.body;

    const originHospitalId = req.user.hospital_id;
    const patientRefCode = `PAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const status = targetHospitalId ? 'REQUEST_SENT' : 'PENDING_MATCH';
    const timeoutSeconds = (parseInt(tmRaw) || 5) * 60;
    const createdAt = new Date().toISOString();

    // ── Patient Key derivation ─────────────────────────────────────────────────
    let patientKey = null;
    let phoneForPacket = null;

    if (patientData?.patientPhone) {
      const raw = patientData.patientPhone;
      if (!isValidPhone(raw)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid phone number. Must be a 10-digit Indian mobile number.' });
      }
      patientKey = derivePatientKey(raw);
      phoneForPacket = raw; // included in encrypted packet only
    }

    // Strip phone from the plain patientData blob before storing on the row
    const patientDataForRow = { ...(patientData || {}) };
    delete patientDataForRow.patientPhone;
    delete patientDataForRow.phoneOwner;

    // ── Insert referral row ────────────────────────────────────────────────────
    const refResult = await client.query(
      `INSERT INTO referrals
         (patient_ref_id, patient_key, sending_hospital_id, receiving_hospital_id,
          required_capabilities, status, timeout_seconds, patient_data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        patientRefCode,
        patientKey,
        originHospitalId,
        targetHospitalId || null,
        requiredCapabilities || [],
        status,
        timeoutSeconds,
        JSON.stringify(patientDataForRow),
        createdAt
      ]
    );
    const referral = refResult.rows[0];

    // ── Audit chain: REFERRAL_CREATED ──────────────────────────────────────────
    await createAuditLog(client, referral.id, 'CREATED', status, req.user.id);

    // Also log patient key issuance as its own chain event
    if (patientKey) {
      await appendChainEvent(client, {
        referralId: referral.id,
        action: 'PATIENT_KEY_ISSUED',
        actor: String(req.user.id),
        payload: {
          patientKeyPrefix: patientKey.substring(0, 12) + '...',
          phoneOwner: patientData.phoneOwner || 'patient',
          keyAlgorithm: 'HMAC-SHA256'
        }
      });
    }

    // ── Bed soft-hold ──────────────────────────────────────────────────────────
    if (targetHospitalId && requiredResources?.length > 0) {
      await client.query(
        `INSERT INTO referral_ranking_log
           (referral_id, ranking_model_version, hospital_id, rank_position, match_score, features)
         VALUES ($1, 'v1.1-gcm', $2, 1, 0.85, $3)`,
        [referral.id, targetHospitalId, JSON.stringify({ capabilityScore: 1.0, capacityHeadroomScore: 0.5, normalizedEtaScore: 0.8 })]
      );

      for (const resType of requiredResources) {
        const bedRes = await client.query(
          'SELECT * FROM beds_capacity WHERE hospital_id = $1 AND bed_type = $2 FOR UPDATE',
          [targetHospitalId, resType]
        );
        if (bedRes.rows.length > 0 && bedRes.rows[0].available > 0) {
          await client.query('UPDATE beds_capacity SET available = available - 1, last_updated_at = NOW() WHERE id = $1', [bedRes.rows[0].id]);
          await client.query(
            `INSERT INTO bed_status_log (bed_capacity_id, from_status, to_status, actor_id)
             VALUES ($1, 'AVAILABLE', 'TEMPORARILY_HELD', $2)`,
            [bedRes.rows[0].id, req.user.id]
          );
        }
      }

      // Audit: BED_SOFT_HOLD
      await appendChainEvent(client, {
        referralId: referral.id,
        action: 'BED_SOFT_HOLD',
        actor: String(req.user.id),
        payload: { targetHospitalId, resources: requiredResources }
      });
    }

    // ── AES-256-GCM clinical packet encryption ─────────────────────────────────
    if (patientData) {
      // Include phone in the encrypted packet (never stored plaintext outside)
      const packetPayload = {
        ...patientDataForRow,
        ...(phoneForPacket ? { patientPhone: phoneForPacket, phoneOwner: patientData.phoneOwner || 'patient' } : {}),
        patientKey,
        encryptedAt: createdAt,
        referralId: referral.id
      };

      const { iv, salt, authTag, encryptedData } = encryptPacket(packetPayload);

      // Write to packets table (AES-GCM, the correct v3 table)
      await client.query(
        `INSERT INTO packets (referral_id, encrypted_data, iv, auth_tag, salt, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [referral.id, encryptedData, iv, authTag, salt, createdAt]
      );

      // Also write legacy clinical_packets so old GET /packet endpoint keeps working
      // Store the GCM params encoded as iv:salt:authTag:ciphertext for backward compat
      await client.query(
        `INSERT INTO clinical_packets (referral_id, encrypted_payload, created_by)
         VALUES ($1, $2, $3)`,
        [referral.id, `${iv}:${salt}:${authTag}:${encryptedData}`, req.user.id]
      );

      // Audit: PACKET_ENCRYPTED
      await appendChainEvent(client, {
        referralId: referral.id,
        action: 'PACKET_ENCRYPTED',
        actor: String(req.user.id),
        payload: { algorithm: 'AES-256-GCM', ivPrefix: iv.substring(0, 8) + '...' }
      });
    }

    await client.query('COMMIT');

    const mappedReferral = mapReferralToClient(referral);

    if (targetHospitalId && req.io) {
      req.io.emit('REFERRAL_CREATED', { referral: mappedReferral });
    }

    // ── Response-window auto-accept/reject engine ──────────────────────────────
    if (targetHospitalId) {
      setTimeout(async () => {
        const client2 = await pool.connect();
        try {
          await client2.query('BEGIN');
          const checkRes = await client2.query('SELECT * FROM referrals WHERE id = $1 FOR UPDATE', [referral.id]);
          if (checkRes.rows.length > 0 && checkRes.rows[0].status === 'REQUEST_SENT') {
            const refRow = checkRes.rows[0];
            const autoAccept = process.env.AUTO_ACCEPT_ON_TIMEOUT !== 'false';

            if (autoAccept) {
              await client2.query('UPDATE referrals SET status = $1 WHERE id = $2', ['ACCEPTED', refRow.id]);
              await createAuditLog(client2, refRow.id, 'REQUEST_SENT', 'ACCEPTED', req.user.id);
              const autoAcceptMapped = await mapReferralWithJoin(client2, refRow.id) || mapReferralToClient({ ...refRow, status: 'ACCEPTED' });
              if (req.io) req.io.emit('REFERRAL_ACCEPTED', { referral: autoAcceptMapped, auto_accepted: true });
            } else {
              await client2.query('UPDATE referrals SET status = $1 WHERE id = $2', ['REJECTED', refRow.id]);
              await createAuditLog(client2, refRow.id, 'REQUEST_SENT', 'REJECTED', req.user.id);
              const heldBeds = await client2.query(
                'SELECT bed_capacity_id FROM bed_status_log WHERE to_status = $1 AND actor_id = $2',
                ['TEMPORARILY_HELD', req.user.id]
              );
              for (const held of heldBeds.rows) {
                await client2.query('UPDATE beds_capacity SET available = available + 1, last_updated_at = NOW() WHERE id = $1', [held.bed_capacity_id]);
                await client2.query('INSERT INTO bed_status_log (bed_capacity_id, from_status, to_status) VALUES ($1, $2, $3)', [held.bed_capacity_id, 'TEMPORARILY_HELD', 'AVAILABLE']);
              }
              if (req.io) req.io.emit('REFERRAL_REJECTED', {
                referral: await mapReferralWithJoin(client2, refRow.id) || mapReferralToClient({ ...refRow, status: 'REJECTED' }),
                auto_rejected: true,
                rejectionReason: 'Auto-rejected: response window expired',
                message: 'Referral was not responded to in time and has been auto-rejected'
              });
            }
          }
          await client2.query('COMMIT');
        } catch (e) {
          await client2.query('ROLLBACK');
          console.error('Response window engine error:', e);
        } finally {
          client2.release();
        }
      }, (referral.timeout_seconds || 300) * 1000);
    }

    res.status(201).json(mappedReferral);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─── GET /api/referrals ────────────────────────────────────────────────────────
router.get('/', auth(), async (req, res) => {
  try {
    const result = await query(
      `SELECT r.*,
              hs.name AS sending_hospital_name,
              hr.name AS receiving_hospital_name
       FROM referrals r
       LEFT JOIN hospitals hs ON hs.id = r.sending_hospital_id
       LEFT JOIN hospitals hr ON hr.id = r.receiving_hospital_id
       WHERE r.sending_hospital_id = $1 OR r.receiving_hospital_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.hospital_id]
    );
    res.json(result.rows.map(mapReferralToClient));
  } catch (err) {
    console.error('GET /api/referrals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/referrals/:id ────────────────────────────────────────────────────
router.get('/:id', auth(), async (req, res) => {
  const result = await query('SELECT * FROM referrals WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(mapReferralToClient(result.rows[0]));
});

// ─── POST /api/referrals/:id/accept ───────────────────────────────────────────
router.post('/:id/accept', auth(['receiving_hospital_desk', 'DOCTOR']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const refRes = await client.query('SELECT * FROM referrals WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (refRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    const ref = refRes.rows[0];

    if (ref.receiving_hospital_id != req.user.hospital_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Referral is not targeted at your hospital' });
    }
    if (['HOSPITAL_CONFIRMED', 'COMPLETED'].includes(ref.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Cannot transition from ${ref.status}` });
    }

    const updated = await client.query('UPDATE referrals SET status = $1 WHERE id = $2 RETURNING *', ['HOSPITAL_CONFIRMED', ref.id]);
    await createAuditLog(client, ref.id, ref.status, 'HOSPITAL_CONFIRMED', req.user.id);

    await client.query(
      `INSERT INTO referral_ranking_log (referral_id, hospital_id, was_accepted, time_to_decision_sec)
       VALUES ($1, $2, true, EXTRACT(EPOCH FROM (NOW() - $3)))`,
      [ref.id, ref.receiving_hospital_id, ref.created_at]
    );

    await client.query('COMMIT');
    const acceptedMapped = await mapReferralWithJoin(client, ref.id) || mapReferralToClient(updated.rows[0]);
    acceptedMapped.acceptedByName = req.user.name || `Hospital #${req.user.hospital_id}`;
    if (req.io) req.io.emit('REFERRAL_ACCEPTED', {
      referral: acceptedMapped,
      acceptedByName: acceptedMapped.acceptedByName,
      message: `Referral accepted by ${acceptedMapped.acceptedByName}`
    });
    res.json(acceptedMapped);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─── POST /api/referrals/:id/reject ───────────────────────────────────────────
router.post('/:id/reject', auth(['receiving_hospital_desk', 'DOCTOR']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const refRes = await client.query('SELECT * FROM referrals WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (refRes.rows.length === 0) return res.status(404).json({ error: 'Referral not found' });
    const ref = refRes.rows[0];

    if (ref.status !== 'REQUEST_SENT') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Cannot reject referral in status ${ref.status}` });
    }

    // Accept optional rejection reason from body (sent by RejectReasonModal)
    const rejectionReason = (req.body.reason || '').trim() || null;
    const rejectedByName  = req.user.name || `Hospital #${req.user.hospital_id}`;

    const updated = await client.query(
      'UPDATE referrals SET status = $1, rejection_reason = $2 WHERE id = $3 RETURNING *',
      ['REJECTED', rejectionReason, ref.id]
    );
    await createAuditLog(client, ref.id, ref.status, 'REJECTED', req.user.id);

    // Log to chain with reason
    await appendChainEvent(client, {
      referralId: ref.id,
      action: 'REFERRAL_REJECTED',
      actor: String(req.user.id),
      payload: { reason: rejectionReason, rejectedByHospitalId: req.user.hospital_id }
    });

    const beds = await client.query(
      'SELECT bed_capacity_id FROM bed_status_log WHERE to_status = $1 AND actor_id = $2',
      ['TEMPORARILY_HELD', req.user.id]
    );
    for (const log of beds.rows) {
      await client.query('UPDATE beds_capacity SET available = available + 1, last_updated_at = NOW() WHERE id = $1', [log.bed_capacity_id]);
      await client.query(
        `INSERT INTO bed_status_log (bed_capacity_id, from_status, to_status, actor_id) VALUES ($1, 'TEMPORARILY_HELD', 'AVAILABLE', $2)`,
        [log.bed_capacity_id, req.user.id]
      );
    }

    await client.query(
      `INSERT INTO referral_ranking_log (referral_id, hospital_id, was_rejected, time_to_decision_sec)
       VALUES ($1, $2, true, EXTRACT(EPOCH FROM (NOW() - $3)))`,
      [ref.id, ref.receiving_hospital_id, ref.created_at]
    );

    await client.query('COMMIT');

    const mappedUpdated = await mapReferralWithJoin(client, ref.id) || mapReferralToClient(updated.rows[0]);
    mappedUpdated.rejectedByName = rejectedByName;

    if (req.io) req.io.emit('REFERRAL_REJECTED', {
      referral: mappedUpdated,
      rejectionReason,
      rejectedByName,
      message: `Referral rejected by ${rejectedByName}${rejectionReason ? ': ' + rejectionReason : ''}`
    });
    res.json(mappedUpdated);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─── GET /api/referrals/:id/packet ────────────────────────────────────────────
// Decrypts and returns the clinical packet. Logs PACKET_ACCESSED to audit chain.
router.get('/:id/packet', auth(['receiving_hospital_desk', 'referral_staff', 'control_room_admin', 'DOCTOR']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Try GCM packet first (packets table)
    const gcmRes = await client.query('SELECT * FROM packets WHERE referral_id = $1', [req.params.id]);
    const refRes = await client.query('SELECT * FROM referrals WHERE id = $1', [req.params.id]);
    if (refRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Referral not found' }); }
    const ref = refRes.rows[0];

    let patientData = null;
    let encryptionMode = 'NONE';

    if (gcmRes.rows.length > 0) {
      const pkt = gcmRes.rows[0];
      try {
        patientData = decryptPacket({
          encryptedData: pkt.encrypted_data,
          iv: pkt.iv,
          salt: pkt.salt,
          authTag: pkt.auth_tag
        });
        encryptionMode = 'AES-256-GCM';
      } catch (e) {
        console.error('GCM decrypt failed, trying CBC fallback:', e.message);
      }
    }

    // CBC fallback for old packets
    if (!patientData) {
      const cbcRes = await client.query('SELECT * FROM clinical_packets WHERE referral_id = $1', [req.params.id]);
      if (cbcRes.rows.length > 0) {
        const payload = cbcRes.rows[0].encrypted_payload;
        const parts = payload.split(':');

        if (parts.length === 4) {
          // New format: iv:salt:authTag:ciphertext (stored by new code in clinical_packets)
          try {
            patientData = decryptPacket({ iv: parts[0], salt: parts[1], authTag: parts[2], encryptedData: parts[3] });
            encryptionMode = 'AES-256-GCM';
          } catch (e) { console.error('4-part GCM fallback failed:', e.message); }
        } else if (parts.length === 2) {
          // Legacy CBC format: ivHex:ciphertext
          try {
            const key = crypto.scryptSync(process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldev123', 'salt', 32);
            const iv = Buffer.from(parts[0], 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let dec = decipher.update(parts[1], 'hex', 'utf8');
            dec += decipher.final('utf8');
            patientData = JSON.parse(dec);
            encryptionMode = 'AES-256-CBC (legacy)';
          } catch (e) { console.error('CBC fallback failed:', e.message); }
        }
      }
    }

    // Log packet access to audit chain
    if (patientData) {
      await appendChainEvent(client, {
        referralId: ref.id,
        action: 'PACKET_ACCESSED',
        actor: String(req.user.id),
        payload: { accessorRole: req.user.role, encryptionMode }
      });
    }

    await client.query('COMMIT');

    if (!patientData) {
      // Final fallback: return safe mock
      return res.json({
        referralId: ref.id,
        patientData: {
          patientName: ref.patient_data?.patientName || 'John Doe',
          patientKey: ref.patient_key,
          note: 'Packet not found'
        },
        isDecrypted: false,
        encryptionMode: 'NONE'
      });
    }

    res.json({
      referralId: ref.id,
      patientData,
      patientKey: ref.patient_key,
      isDecrypted: true,
      encryptionMode
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Decryption failed' });
  } finally {
    client.release();
  }
});

// ─── POST /api/referrals/:id/assign-ambulance ─────────────────────────────────
router.post('/:id/assign-ambulance', auth(['referral_staff', 'control_room_admin', 'DOCTOR']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const refRes = await client.query('SELECT * FROM referrals WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (refRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Referral not found' }); }
    const ref = refRes.rows[0];

    const updated = await client.query('UPDATE referrals SET status = $1 WHERE id = $2 RETURNING *', ['IN_TRANSIT', ref.id]);
    await createAuditLog(client, ref.id, ref.status, 'IN_TRANSIT', req.user.id);

    await client.query('COMMIT');
    if (req.io) req.io.emit('AMBULANCE_DISPATCHED', { referral: mapReferralToClient(updated.rows[0]), message: 'Ambulance assigned' });
    res.json({ success: true, referral: mapReferralToClient(updated.rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─── POST /api/referrals/simulate-capacity-loss ───────────────────────────────
router.post('/simulate-capacity-loss', auth(['referral_staff', 'control_room_admin', 'DOCTOR']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { referralId } = req.body;

    const refRes = await client.query('SELECT * FROM referrals WHERE id = $1 FOR UPDATE', [referralId]);
    if (refRes.rows.length === 0) return res.status(404).json({ error: 'Referral not found' });
    const ref = refRes.rows[0];

    const targetHospId = ref.receiving_hospital_id;
    if (!targetHospId) return res.status(400).json({ error: 'No receiving hospital assigned' });

    await client.query(`UPDATE beds_capacity SET available = 0, last_updated_at = NOW() WHERE hospital_id = $1 AND bed_type = 'ICU'`, [targetHospId]);

    const newTargetId = targetHospId === 1 ? 2 : 1;
    const updatedRefRes = await client.query(
      'UPDATE referrals SET receiving_hospital_id = $1, status = $2 WHERE id = $3 RETURNING *',
      [newTargetId, 'RE_ROUTED', ref.id]
    );

    await createAuditLog(client, ref.id, ref.status, 'RE_ROUTED', req.user.id);
    await appendChainEvent(client, {
      referralId: ref.id,
      action: 'AUTO_REROUTE',
      actor: 'SYSTEM',
      payload: { fromHospital: targetHospId, toHospital: newTargetId, reason: 'CAPACITY_LOSS_ICU' }
    });

    await client.query('COMMIT');

    if (req.io) {
      req.io.emit('REFERRAL_REROUTED', {
        referralId,
        referral: mapReferralToClient(updatedRefRes.rows[0]),
        message: `Rerouted to hospital ${newTargetId}`
      });
    }

    res.json({
      success: true,
      simulationMessage: `Capacity at hospital ${targetHospId} set to 0. Referral re-routed to hospital ${newTargetId}.`,
      rerouteResult: { newTargetHospitalId: newTargetId }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─── GET /api/referrals/:id/verify-audit ─────────────────────────────────────
// Walks the full referral_events chain and verifies hash integrity.
router.get('/:id/verify-audit', auth(), async (req, res) => {
  try {
    const eventsRes = await query(
      'SELECT * FROM referral_events WHERE referral_id = $1 ORDER BY id ASC',
      [req.params.id]
    );

    if (eventsRes.rows.length === 0) {
      // Fall back to referral_status_log for older referrals
      const logsRes = await query('SELECT * FROM referral_status_log WHERE referral_id = $1 ORDER BY id ASC', [req.params.id]);
      if (logsRes.rows.length === 0) return res.status(404).json({ error: 'No audit logs found for this referral' });

      let is_valid = true;
      let expectedPrevHash = GENESIS_HASH;
      const verificationChain = [];

      for (const log of logsRes.rows) {
        if (log.prev_hash !== expectedPrevHash) is_valid = false;
        const payload = JSON.stringify({ referralId: log.referral_id, fromStatus: log.from_status, toStatus: log.to_status, actorId: log.actor_id, prevHash: log.prev_hash });
        const recomputed = crypto.createHash('sha256').update(payload).digest('hex');
        if (recomputed !== log.event_hash) is_valid = false;
        verificationChain.push({ id: log.id, action: `${log.from_status}→${log.to_status}`, hash_matched: recomputed === log.event_hash, event_hash: log.event_hash, timestamp: log.timestamp });
        expectedPrevHash = log.event_hash;
      }

      return res.json({ is_valid, chain_length: verificationChain.length, source: 'referral_status_log', verificationChain });
    }

    // Verify referral_events chain
    let is_valid = true;
    let expectedPrevHash = GENESIS_HASH;
    const verificationChain = [];

    for (const ev of eventsRes.rows) {
      if (ev.prev_hash !== expectedPrevHash) is_valid = false;

      const payloadStr = JSON.stringify({
        referralId: ev.referral_id,
        action: ev.action,
        actor: ev.actor,
        payload: ev.payload,
        prevHash: ev.prev_hash,
        timestamp: ev.created_at instanceof Date ? ev.created_at.toISOString() : ev.created_at
      });
      const recomputed = crypto.createHash('sha256').update(payloadStr).digest('hex');
      if (recomputed !== ev.event_hash) is_valid = false;

      verificationChain.push({
        id: ev.id,
        action: ev.action,
        actor: ev.actor,
        hash_matched: recomputed === ev.event_hash,
        event_hash: ev.event_hash,
        prev_hash: ev.prev_hash,
        timestamp: ev.created_at
      });

      expectedPrevHash = ev.event_hash;
    }

    res.json({ is_valid, chain_length: verificationChain.length, source: 'referral_events', verificationChain });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/patients/:key ────────────────────────────────────────────────────
// Cross-hospital patient key lookup — returns referral history by patient_key.
router.get('/patients/:key', auth(), async (req, res) => {
  try {
    const { key } = req.params;
    if (!key || key.length !== 64) return res.status(400).json({ error: 'Invalid patient key format' });

    const result = await query(
      `SELECT r.id, r.patient_ref_id, r.status, r.created_at,
              r.patient_data->>'patientName' AS patient_name,
              r.patient_data->>'patientAge' AS patient_age,
              r.patient_data->>'diagnosisSuspected' AS diagnosis,
              r.sending_hospital_id, r.receiving_hospital_id
       FROM referrals r
       WHERE r.patient_key = $1
       ORDER BY r.created_at DESC`,
      [key]
    );

    res.json({
      patientKey: key,
      patientKeyPrefix: key.substring(0, 12) + '...',
      referralCount: result.rows.length,
      referrals: result.rows.map(r => ({
        id: r.id,
        refCode: r.patient_ref_id,
        status: r.status,
        diagnosis: r.diagnosis,
        patientName: r.patient_name,
        sendingHospitalId: r.sending_hospital_id,
        receivingHospitalId: r.receiving_hospital_id,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/referrals/:id/complete ─────────────────────────────────────────
router.post('/:id/complete', auth(['referral_staff', 'control_room_admin', 'DOCTOR']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const refRes = await client.query('SELECT * FROM referrals WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (refRes.rows.length === 0) return res.status(404).json({ error: 'Referral not found' });
    const ref = refRes.rows[0];

    const updated = await client.query('UPDATE referrals SET status = $1 WHERE id = $2 RETURNING *', ['COMPLETED', ref.id]);
    await createAuditLog(client, ref.id, ref.status, 'COMPLETED', req.user.id);
    await client.query('COMMIT');

    const mapped = mapReferralToClient(updated.rows[0]);
    if (req.io) { req.io.emit('REFERRAL_COMPLETED', mapped); req.io.emit('REFERRAL_UPDATED', mapped); }
    res.json(mapped);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
