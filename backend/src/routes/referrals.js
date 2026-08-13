const express = require('express');
const { query, pool } = require('../config/db');
const auth = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function estimateEtaMinutes(distanceKm, priority = 'URGENT') {
  const speedKmH = priority === 'CRITICAL' ? 42 : 35;
  const hours = distanceKm / speedKmH;
  return Math.max(3, Math.round(hours * 60) + 2);
}

// POST /api/referrals/match
router.post('/match', auth(), async (req, res) => {
  try {
    const { requiredCapabilities = [], requiredResources = [], originHospitalId, priority = 'URGENT' } = req.body;
    
    let originLat = 28.7041, originLng = 77.1025; // Default if not found
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
      const hasAllCapabilities = requiredCapabilities.every(reqCap => hospCaps.includes(reqCap));
      if (!hasAllCapabilities && requiredCapabilities.length > 0) continue;

      let hasAllResources = true;
      let totalHeadroomSum = 0;
      let resourceCount = 0;

      for (const reqRes of requiredResources) {
        const resPool = hosp.resources.find(r => r.type === reqRes);
        if (!resPool || resPool.available <= 0) {
          hasAllResources = false;
          break;
        }
        totalHeadroomSum += (resPool.available / (resPool.total || 1));
        resourceCount++;
      }

      if (!hasAllResources && requiredResources.length > 0) continue;

      const distKm = getHaversineDistanceKm(originLat, originLng, hosp.location_lat, hosp.location_lng);
      const etaMinutes = estimateEtaMinutes(distKm, priority);

      const capabilityScore = hasAllCapabilities ? 1.0 : 0.5;
      const capacityHeadroomScore = resourceCount > 0 ? (totalHeadroomSum / resourceCount) : 0.5;
      const normalizedEtaScore = Math.max(0, 1 - (distKm / 40));
      const specialistBonus = 0.0; 

      const finalScore = (0.40 * capabilityScore) + (0.15 * capacityHeadroomScore) + (0.35 * normalizedEtaScore) + (0.10 * specialistBonus);

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

  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/referrals
router.post('/', auth(['referral_staff', 'control_room_admin']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { targetHospitalId, requiredCapabilities, requiredResources, patientData } = req.body;
    const originHospitalId = req.user.hospital_id;
    const patientRefCode = `PAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const status = targetHospitalId ? 'REQUEST_SENT' : 'PENDING_MATCH';

    const refResult = await client.query(`
      INSERT INTO referrals (patient_ref_id, sending_hospital_id, receiving_hospital_id, required_capabilities, status)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [patientRefCode, originHospitalId, targetHospitalId || null, requiredCapabilities || [], status]);
    
    const referral = refResult.rows[0];

    await client.query(`
      INSERT INTO referral_status_log (referral_id, from_status, to_status, actor_id)
      VALUES ($1, 'CREATED', $2, $3)
    `, [referral.id, status, req.user.id]);

    // Apply Bed Hold State Machine (AVAILABLE -> TEMPORARILY_HELD)
    if (targetHospitalId && requiredResources && requiredResources.length > 0) {
      for (const resType of requiredResources) {
        const bedRes = await client.query('SELECT * FROM beds_capacity WHERE hospital_id = $1 AND bed_type = $2 FOR UPDATE', [targetHospitalId, resType]);
        if (bedRes.rows.length > 0) {
          const bed = bedRes.rows[0];
          if (bed.available > 0) {
            await client.query('UPDATE beds_capacity SET available = available - 1, last_updated_at = NOW() WHERE id = $1', [bed.id]);
            await client.query(`
              INSERT INTO bed_status_log (bed_capacity_id, from_status, to_status, actor_id)
              VALUES ($1, 'AVAILABLE', 'TEMPORARILY_HELD', $2)
            `, [bed.id, req.user.id]);
          }
        }
      }
    }

    // Encrypt packet (Module 8)
    if (patientData) {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldev123', 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(JSON.stringify(patientData), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const payload = iv.toString('hex') + ':' + encrypted;

      await client.query(`
        INSERT INTO clinical_packets (referral_id, encrypted_payload, created_by)
        VALUES ($1, $2, $3)
      `, [referral.id, payload, req.user.id]);
    }

    await client.query('COMMIT');

    if (req.io) {
      req.io.emit('REFERRAL_CREATED', { referral });
    }

    res.status(201).json(referral);
  } catch(err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/referrals
router.get('/', auth(), async (req, res) => {
  const result = await query('SELECT * FROM referrals ORDER BY created_at DESC');
  res.json(result.rows);
});

// GET /api/referrals/:id
router.get('/:id', auth(), async (req, res) => {
  const result = await query('SELECT * FROM referrals WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// POST /api/referrals/:id/accept
router.post('/:id/accept', auth(['receiving_hospital_desk']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check legal transition
    const refRes = await client.query('SELECT * FROM referrals WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (refRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const ref = refRes.rows[0];

    // Verify it's actually for this hospital
    if (ref.receiving_hospital_id != req.user.hospital_id) {
       return res.status(403).json({ error: 'Referral is not targeted at your hospital' });
    }

    if (ref.status === 'HOSPITAL_CONFIRMED' || ref.status === 'COMPLETED') {
       return res.status(409).json({ error: `Cannot transition from ${ref.status} to HOSPITAL_CONFIRMED directly` });
    }

    const updated = await client.query('UPDATE referrals SET status = $1 WHERE id = $2 RETURNING *', ['HOSPITAL_CONFIRMED', ref.id]);
    
    await client.query(`
      INSERT INTO referral_status_log (referral_id, from_status, to_status, actor_id)
      VALUES ($1, $2, 'HOSPITAL_CONFIRMED', $3)
    `, [ref.id, ref.status, req.user.id]);

    // TEMPORARILY_HELD -> RESERVED (Module 3)
    // For simplicity in MVP, we just record the transition for any held beds
    // In a real app we'd link specific beds to the referral. 
    await client.query(`
      INSERT INTO bed_status_log (bed_capacity_id, from_status, to_status, actor_id)
      SELECT id, 'TEMPORARILY_HELD', 'RESERVED', $1 FROM beds_capacity WHERE hospital_id = $2
    `, [req.user.id, ref.receiving_hospital_id]);

    await client.query('COMMIT');
    
    if (req.io) req.io.emit('REFERRAL_ACCEPTED', { referral: updated.rows[0] });
    res.json(updated.rows[0]);
  } catch(err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/referrals/:id/packet
router.get('/:id/packet', auth(), async (req, res) => {
  try {
    const pktRes = await query('SELECT * FROM clinical_packets WHERE referral_id = $1', [req.params.id]);
    if (pktRes.rows.length === 0) return res.status(404).json({ error: 'Packet not found' });

    const refRes = await query('SELECT * FROM referrals WHERE id = $1', [req.params.id]);
    const ref = refRes.rows[0];

    // RBAC: Only sender, receiver, or control room can view
    if (req.user.role !== 'control_room_admin' && req.user.hospital_id != ref.sending_hospital_id && req.user.hospital_id != ref.receiving_hospital_id) {
       return res.status(403).json({ error: 'Unauthorized to view this clinical packet' });
    }

    const payload = pktRes.rows[0].encrypted_payload;
    const [ivHex, encrypted] = payload.split(':');
    
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldev123', 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    res.json({
      id: pktRes.rows[0].id,
      referralId: ref.id,
      decryptedPayload: JSON.parse(decrypted),
      isDecrypted: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Decryption failed' });
  }
});

module.exports = router;
