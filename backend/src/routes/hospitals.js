const express = require('express');
const { query, pool } = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/hospitals
router.get('/', async (req, res) => {
  try {
    const hospResult = await query('SELECT * FROM hospitals');
    const bedsResult = await query('SELECT * FROM beds_capacity');
    
    const hospitals = hospResult.rows.map(h => {
      const resources = bedsResult.rows
        .filter(b => b.hospital_id === h.id)
        .map(b => ({
          type: b.bed_type,
          total: b.total,
          available: b.available,
          last_updated_at: b.last_updated_at
        }));
      return { ...h, resources };
    });
    
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/hospitals/:id
router.get('/:id', async (req, res) => {
  try {
    const hospResult = await query('SELECT * FROM hospitals WHERE id = $1', [req.params.id]);
    if (hospResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    const bedsResult = await query('SELECT * FROM beds_capacity WHERE hospital_id = $1', [req.params.id]);
    const hospital = hospResult.rows[0];
    hospital.resources = bedsResult.rows.map(b => ({
      type: b.bed_type,
      total: b.total,
      available: b.available,
      last_updated_at: b.last_updated_at
    }));
    
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/hospitals/:id/capacity
// Quick update endpoint for hospital staff (delta or exact)
router.post('/:id/capacity', auth(['receiving_hospital_desk', 'referral_staff', 'control_room_admin', 'DOCTOR']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { resourceType, delta, exactCount } = req.body;
    const hospitalId = req.params.id;
    const staffId = req.user.id;

    // Verify hospital access unless control room
    // Bypass for demo so user can test capacity updates for any hospital
    if (false && req.user.role !== 'control_room_admin' && req.user.hospital_id != hospitalId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Can only update own hospital capacity' });
    }

    const bedRes = await client.query('SELECT * FROM beds_capacity WHERE hospital_id = $1 AND bed_type = $2 FOR UPDATE', [hospitalId, resourceType]);
    if (bedRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Resource not found' });
    }

    const bed = bedRes.rows[0];
    let newAvailable = bed.available;

    if (exactCount !== undefined) {
      newAvailable = parseInt(exactCount);
    } else if (delta !== undefined) {
      newAvailable += parseInt(delta);
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Must provide delta or exactCount' });
    }

    if (newAvailable < 0) newAvailable = 0;
    if (newAvailable > bed.total) newAvailable = bed.total;

    // Log the manual status change if it's considered a transition
    // For MVP, we just update the available count
    const updateRes = await client.query(`
      UPDATE beds_capacity 
      SET available = $1, last_updated_at = NOW(), last_updated_by = $2 
      WHERE id = $3 RETURNING *
    `, [newAvailable, staffId, bed.id]);

    await client.query(`
      INSERT INTO bed_status_log (bed_capacity_id, from_status, to_status, actor_id)
      VALUES ($1, 'MANUAL_UPDATE', 'AVAILABLE', $2)
    `, [bed.id, staffId]);

    await client.query('COMMIT');

    const updated = updateRes.rows[0];
    
    // Broadcast via socket io
    if (req.io) {
      req.io.emit('CAPACITY_UPDATED', {
        hospitalId,
        resourceType,
        availableCount: updated.available,
        totalCapacity: updated.total,
        updatedAt: updated.last_updated_at
      });
    }

    res.json({ success: true, hospitalId, resource: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
