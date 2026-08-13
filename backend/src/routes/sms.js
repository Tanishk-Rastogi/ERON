const express = require('express');
const { query } = require('../config/db');

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

module.exports = router;
