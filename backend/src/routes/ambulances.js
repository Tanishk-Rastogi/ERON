const express = require('express');
const { query, pool } = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/ambulances
router.get('/', async (req, res) => {
  const result = await query('SELECT * FROM ambulances');
  res.json(result.rows);
});

// POST /api/referrals/:id/assign-ambulance
router.post('/referrals/:id/assign', auth(['ambulance_dispatcher', 'control_room_admin']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { ambulanceId } = req.body;
    const refId = req.params.id;

    const refRes = await client.query('SELECT * FROM referrals WHERE id = $1 FOR UPDATE', [refId]);
    if (refRes.rows.length === 0) return res.status(404).json({ error: 'Referral not found' });
    const ref = refRes.rows[0];

    const ambRes = await client.query('SELECT * FROM ambulances WHERE id = $1 FOR UPDATE', [ambulanceId]);
    if (ambRes.rows.length === 0) return res.status(404).json({ error: 'Ambulance not found' });
    const amb = ambRes.rows[0];

    await client.query('UPDATE ambulances SET status = $1 WHERE id = $2', ['EN_ROUTE_TO_HOSPITAL', amb.id]);
    
    // Create assignment record
    await client.query('INSERT INTO ambulance_assignments (ambulance_id, referral_id) VALUES ($1, $2)', [amb.id, ref.id]);

    const updatedRef = await client.query('UPDATE referrals SET status = $1 WHERE id = $2 RETURNING *', ['IN_TRANSIT', ref.id]);
    
    await client.query(`
      INSERT INTO referral_status_log (referral_id, from_status, to_status, actor_id)
      VALUES ($1, $2, 'IN_TRANSIT', $3)
    `, [ref.id, ref.status, req.user.id]);

    await client.query('COMMIT');

    if (req.io) {
      req.io.emit('AMBULANCE_DISPATCHED', { referral: updatedRef.rows[0], ambulance: amb });
    }

    res.json(updatedRef.rows[0]);
  } catch(err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Mock Socket.io Location Ping (This would typically be sent directly via websockets, 
// but we provide an endpoint to easily simulate the GPS device pushing updates)
router.post('/ping', async (req, res) => {
  const { ambulanceId, lat, lng } = req.body;
  if (!ambulanceId) return res.status(400).json({ error: 'Ambulance ID missing' });
  
  await query('UPDATE ambulances SET current_lat = $1, current_lng = $2 WHERE id = $3', [lat, lng, ambulanceId]);
  
  if (req.io) {
    req.io.emit('AMBULANCE_LOCATION_UPDATED', { ambulanceId, lat, lng, timestamp: new Date().toISOString() });
  }

  res.json({ success: true });
});

module.exports = router;
