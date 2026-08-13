const express = require('express');
const { query, pool } = require('../config/db');

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

// POST /demo/simulate-capacity-loss/:referralId
router.post('/simulate-capacity-loss/:referralId', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const refId = req.params.referralId;
    
    const refRes = await client.query('SELECT * FROM referrals WHERE id = $1 FOR UPDATE', [refId]);
    if (refRes.rows.length === 0) return res.status(404).json({ error: 'Referral not found' });
    const ref = refRes.rows[0];

    const targetHospId = ref.receiving_hospital_id;
    if (!targetHospId) return res.status(400).json({ error: 'No receiving hospital assigned to this referral' });

    // Zero out ICU beds for the target hospital
    await client.query(`UPDATE beds_capacity SET available = 0, last_updated_at = NOW() WHERE hospital_id = $1 AND bed_type = 'ICU'`, [targetHospId]);

    // Re-run matching engine to find next best hospital
    let originLat = 28.7041, originLng = 77.1025; 
    const origRes = await client.query('SELECT location_lat, location_lng FROM hospitals WHERE id = $1', [ref.sending_hospital_id]);
    if (origRes.rows.length > 0) {
      originLat = origRes.rows[0].location_lat;
      originLng = origRes.rows[0].location_lng;
    }

    const hospRes = await client.query(`
      SELECT h.*, 
        json_agg(json_build_object('type', b.bed_type, 'total', b.total, 'available', b.available)) as resources
      FROM hospitals h
      LEFT JOIN beds_capacity b ON h.id = b.hospital_id
      GROUP BY h.id
    `);

    const candidates = [];
    const requiredCapabilities = ref.required_capabilities || [];
    const requiredResources = ['ICU']; // Hardcoded for demo

    for (const hosp of hospRes.rows) {
      if (hosp.id == ref.sending_hospital_id || hosp.id == targetHospId) continue;
      
      const hospCaps = hosp.capabilities || [];
      const hasAllCapabilities = requiredCapabilities.every(reqCap => hospCaps.includes(reqCap));
      if (!hasAllCapabilities && requiredCapabilities.length > 0) continue;

      let hasAllResources = true;
      for (const reqRes of requiredResources) {
        const resPool = hosp.resources.find(r => r.type === reqRes);
        if (!resPool || resPool.available <= 0) {
          hasAllResources = false;
          break;
        }
      }
      if (!hasAllResources) continue;

      const distKm = getHaversineDistanceKm(originLat, originLng, hosp.location_lat, hosp.location_lng);
      candidates.push({ hospitalId: hosp.id, distanceKm: distKm, score: 1 - (distKm/40) });
    }

    candidates.sort((a, b) => b.score - a.score);
    const nextBest = candidates[0];

    let newTargetId = null;
    let newStatus = 'PENDING_MATCH';

    if (nextBest) {
      newTargetId = nextBest.hospitalId;
      newStatus = 'REQUEST_SENT'; // Send soft-hold to new target
    }

    const updatedRefRes = await client.query(`
      UPDATE referrals SET receiving_hospital_id = $1, status = $2 WHERE id = $3 RETURNING *
    `, [newTargetId, newStatus, ref.id]);

    await client.query(`
      INSERT INTO referral_status_log (referral_id, from_status, to_status, actor_id)
      VALUES ($1, $2, $3, NULL)
    `, [ref.id, ref.status, 'RE_ROUTED']);

    await client.query('COMMIT');

    const updatedRef = updatedRefRes.rows[0];

    if (req.io) {
      req.io.emit('REFERRAL_REROUTED', { 
        referral: updatedRef, 
        oldHospitalId: targetHospId, 
        newHospitalId: newTargetId 
      });
      req.io.emit('CAPACITY_UPDATED', {
        hospitalId: targetHospId,
        resourceType: 'ICU',
        availableCount: 0
      });
    }

    res.json({
      success: true,
      message: `Capacity at hospital ${targetHospId} set to 0. Referral re-routed!`,
      referral: updatedRef
    });

  } catch(err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
