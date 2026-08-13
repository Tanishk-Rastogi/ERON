const express = require('express');
const { query, pool } = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/hospitals
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT h.*, 
        json_agg(json_build_object('type', b.bed_type, 'total', b.total, 'available', b.available, 'last_updated_at', b.last_updated_at)) as resources
      FROM hospitals h
      LEFT JOIN beds_capacity b ON h.id = b.hospital_id
      GROUP BY h.id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/hospitals/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT h.*, 
        json_agg(json_build_object('type', b.bed_type, 'total', b.total, 'available', b.available, 'last_updated_at', b.last_updated_at)) as resources
      FROM hospitals h
      LEFT JOIN beds_capacity b ON h.id = b.hospital_id
      WHERE h.id = $1
      GROUP BY h.id
    `, [req.params.id]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/hospitals/:id/capacity
// Quick update endpoint for hospital staff (delta or exact)
router.post('/:id/capacity', auth(['receiving_hospital_desk', 'referral_staff', 'control_room_admin']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { resourceType, delta, exactCount } = req.body;
    const hospitalId = req.params.id;
    const staffId = req.user.id;

    // Verify hospital access unless control room
    if (req.user.role !== 'control_room_admin' && req.user.hospital_id != hospitalId) {
      return res.status(403).json({ error: 'Can only update own hospital capacity' });
    }

    const bedRes = await client.query('SELECT * FROM beds_capacity WHERE hospital_id = $1 AND bed_type = $2 FOR UPDATE', [hospitalId, resourceType]);
    if (bedRes.rows.length === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const bed = bedRes.rows[0];
    let newAvailable = bed.available;

    if (exactCount !== undefined) {
      newAvailable = parseInt(exactCount);
    } else if (delta !== undefined) {
      newAvailable += parseInt(delta);
    } else {
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
