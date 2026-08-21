const express = require('express');
const { query } = require('../config/db');

const router = express.Router();

// ─── Twilio Setup ───────────────────────────────────────────────────────────
let twilioClient = null;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN);
    console.log('[SMS] Twilio client initialized. FROM:', TWILIO_FROM);
  } catch (e) {
    console.warn('[SMS] Failed to initialize Twilio client:', e.message);
  }
} else {
  console.log('[SMS] Twilio credentials not set. SMS will use mock bypass.');
}

function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// POST /api/sms/webhook
// Simulated SMS Gateway for finding beds offline
router.post('/webhook', async (req, res) => {
  try {
    const { fromPhone, body } = req.body;
    const rawText = (body || '').trim().toUpperCase();

    // Parse e.g. "CT 500 URGENT" or "ICU 500 CRITICAL"
    const parts = rawText.split(/\s+/);
    const reqKey = parts[0] || 'ICU';
    
    let capabilityMap = { 'CT': 'CT_SCAN', 'ICU': 'ICU', 'VENT': 'VENTILATOR', 'NEURO': 'NEUROSURGERY' };
    let resourceMap = { 'CT': 'CT_SCAN', 'ICU': 'ICU', 'VENT': 'VENTILATOR' };

    const cap = capabilityMap[reqKey] || 'ICU';
    const resType = resourceMap[reqKey] || 'ICU';

    const originLat = 28.7041, originLng = 77.1025; // Default reference point for SMS

    const hospRes = await query(`
      SELECT h.*, json_agg(json_build_object('type', b.bed_type, 'total', b.total, 'available', b.available)) as resources
      FROM hospitals h LEFT JOIN beds_capacity b ON h.id = b.hospital_id GROUP BY h.id
    `);

    const candidates = [];
    for (const hosp of hospRes.rows) {
      if (cap && !(hosp.capabilities || []).includes(cap)) continue;
      const resPool = (hosp.resources || []).find(r => r.type === resType);
      if (!resPool || resPool.available <= 0) continue;

      const distKm = getHaversineDistanceKm(originLat, originLng, hosp.location_lat, hosp.location_lng);
      candidates.push({ name: hosp.name, distanceKm: distKm, score: 1 - (distKm/40) });
    }
    candidates.sort((a, b) => b.score - a.score);

    let replyText = '';
    if (candidates.length > 0) {
      const top2 = candidates.slice(0, 2).map(m => `${m.name.substring(0, 12)}(${m.distanceKm.toFixed(1)}km)-Avail`).join(' ');
      replyText = `${reqKey}: ${top2}. Open app or call 1923.`;
    } else {
      replyText = `No immediate ${reqKey} capacity found. Escalated to Control Room.`;
    }

    await query('INSERT INTO sms_fallback_log (raw_sms, parsed_requirement, response_sent) VALUES ($1, $2, $3)', [rawText, reqKey, replyText]);

    res.json({ fromPhone, rawText, replyText });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/sms/send ──────────────────────────────────────────────────────
// Real Twilio SMS dispatch. Sends referral details to hospital and patient/guardian.
router.post('/send', async (req, res) => {
  try {
    const { to, body, referralData } = req.body;
    if (!to || !body) return res.status(400).json({ error: 'Missing to or body' });

    // Normalize phone: ensure +91 prefix for Indian numbers
    let normalizedTo = String(to).replace(/\s/g, '');
    if (!normalizedTo.startsWith('+')) {
      normalizedTo = '+91' + normalizedTo.replace(/^91/, '');
    }

    let result = {};
    let mode = 'mock';

    if (twilioClient) {
      // Real Twilio dispatch
      try {
        const msg = await twilioClient.messages.create({
          body,
          from: TWILIO_FROM,
          to: normalizedTo
        });
        result = { sid: msg.sid, status: msg.status, to: normalizedTo };
        mode = 'twilio';
        console.log(`[SMS] Twilio sent to ${normalizedTo}, SID: ${msg.sid}`);
      } catch (twilioErr) {
        console.error('[SMS] Twilio error:', twilioErr.message);
        // Fall back to mock
        result = { sid: 'MOCK-' + Date.now(), status: 'mock-sent', to: normalizedTo, mockError: twilioErr.message };
        mode = 'mock-fallback';
      }
    } else {
      // Mock bypass when Twilio not configured
      result = { sid: 'MOCK-' + Date.now(), status: 'mock-sent', to: normalizedTo };
      mode = 'mock';
      console.log(`[SMS] Mock send to ${normalizedTo}`);
    }

    // Log to sms_fallback_log
    await query(
      'INSERT INTO sms_fallback_log (raw_sms, parsed_requirement, response_sent) VALUES ($1, $2, $3)',
      [body, referralData?.referralCode || 'MANUAL', body]
    );

    res.json({ success: true, mode, ...result });
  } catch(err) {
    console.error('[SMS] Send error:', err);
    res.status(500).json({ error: 'SMS send failed' });
  }
});

// ─── POST /api/sms/send-referral ─────────────────────────────────────────────
// Convenience: compose and send referral SMS to hospital + patient/guardian
router.post('/send-referral', async (req, res) => {
  try {
    const { referralId, hospitalPhone, patientPhone, patientName, diagnosis, hospitalName, priority } = req.body;
    if (!referralId) return res.status(400).json({ error: 'Missing referralId' });

    const results = [];
    const prio = (priority || 'URGENT').toUpperCase();
    const prioEmoji = prio === 'CRITICAL' ? '🔴' : prio === 'URGENT' ? '🟡' : '🟢';

    // Compose SMS body
    const smsBody = `${prioEmoji} ERON ${prio} REFERRAL #${referralId}\nPatient: ${patientName || 'Unknown'}\nDiagnosis: ${diagnosis || 'Emergency'}\nTarget: ${hospitalName || 'Hospital'}\nPlease prepare required resources. Call 1923 for control room.`;

    // Send to hospital
    if (hospitalPhone) {
      let hPhone = String(hospitalPhone).replace(/\s/g, '');
      if (!hPhone.startsWith('+')) hPhone = '+91' + hPhone.replace(/^91/, '');

      if (twilioClient) {
        try {
          const msg = await twilioClient.messages.create({ body: smsBody, from: TWILIO_FROM, to: hPhone });
          results.push({ recipient: 'hospital', phone: hPhone, sid: msg.sid, status: msg.status });
          console.log(`[SMS] Referral ${referralId} → Hospital ${hPhone}, SID: ${msg.sid}`);
        } catch (e) {
          console.error('[SMS] Hospital send error:', e.message);
          results.push({ recipient: 'hospital', phone: hPhone, status: 'failed', error: e.message });
        }
      } else {
        results.push({ recipient: 'hospital', phone: hPhone, status: 'mock-sent', sid: 'MOCK-' + Date.now() });
      }
    }

    // Send to patient/guardian
    if (patientPhone) {
      let pPhone = String(patientPhone).replace(/\s/g, '');
      if (!pPhone.startsWith('+')) pPhone = '+91' + pPhone.replace(/^91/, '');

      const patientSms = `${prioEmoji} ERON Update for ${patientName || 'Patient'}\nReferral #${referralId} is being processed.\nTarget: ${hospitalName || 'Hospital'}\nDial 1923 for emergencies.`;

      if (twilioClient) {
        try {
          const msg = await twilioClient.messages.create({ body: patientSms, from: TWILIO_FROM, to: pPhone });
          results.push({ recipient: 'patient', phone: pPhone, sid: msg.sid, status: msg.status });
          console.log(`[SMS] Referral ${referralId} → Patient ${pPhone}, SID: ${msg.sid}`);
        } catch (e) {
          console.error('[SMS] Patient send error:', e.message);
          results.push({ recipient: 'patient', phone: pPhone, status: 'failed', error: e.message });
        }
      } else {
        results.push({ recipient: 'patient', phone: pPhone, status: 'mock-sent', sid: 'MOCK-' + Date.now() });
      }
    }

    // Log
    await query(
      'INSERT INTO sms_fallback_log (raw_sms, parsed_requirement, response_sent) VALUES ($1, $2, $3)',
      [smsBody, `REFERRAL-${referralId}`, JSON.stringify(results)]
    );

    res.json({ success: true, referralId, smsCount: results.length, results });
  } catch(err) {
    console.error('[SMS] send-referral error:', err);
    res.status(500).json({ error: 'SMS send-referral failed' });
  }
});

module.exports = router;
