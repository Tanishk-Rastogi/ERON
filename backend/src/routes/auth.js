const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { hospitalName, hospitalCode, address, lat, lng } = req.body;
    if (!hospitalName) return res.status(400).json({ error: 'Hospital Name required' });

    const trimmedName = hospitalName.trim();
    
    // Check if hospital exists by name
    const hospRes = await query('SELECT * FROM hospitals WHERE name ILIKE $1', [trimmedName]);
    
    let hosp;
    if (hospRes.rows.length === 0) {
      // Register new custom hospital facility
      const newHospRes = await query(`
        INSERT INTO hospitals (name, location_lat, location_lng, contact_info, tier, capabilities)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [trimmedName, lat || 12.9716, lng || 77.5946, '+91-98765-00999', 1, ['NEUROSURGERY', 'CT_SCAN']]);
      
      hosp = newHospRes.rows[0];

      // Insert default user
      const userRes = await query(`
        INSERT INTO users (hospital_id, role, name, phone, password_hash)
        VALUES ($1, 'control_room_admin', 'Dr. Default', $2, 'hashed_password_mock') RETURNING *
      `, [hosp.id, '+91-' + Math.floor(Math.random()*1000000000)]);

      // Seed standard emergency capabilities & resources
      const initialResources = [
        { bed_type: 'ICU_BED', available: 10, total: 20 },
        { bed_type: 'VENTILATOR', available: 5, total: 10 },
        { bed_type: 'CT_SCAN', available: 2, total: 3 },
        { bed_type: 'TRAUMA_OT', available: 3, total: 5 },
        { bed_type: 'BLOOD_BANK', available: 25, total: 50 },
        { bed_type: 'DOCTORS_ON_DUTY', available: 15, total: 20 }
      ];

      for (const resItem of initialResources) {
        await query(`
          INSERT INTO beds_capacity (hospital_id, bed_type, total, available, last_updated_by)
          VALUES ($1, $2, $3, $4, $5)
        `, [hosp.id, resItem.bed_type, resItem.total, resItem.available, userRes.rows[0].id]);
      }
    } else {
      hosp = hospRes.rows[0];
      if (address || lat) {
        // Update
        const updLat = lat ? lat : hosp.location_lat;
        const updLng = lng ? lng : hosp.location_lng;
        await query('UPDATE hospitals SET location_lat = $1, location_lng = $2 WHERE id = $3', [updLat, updLng, hosp.id]);
        hosp.location_lat = updLat;
        hosp.location_lng = updLng;
      }
    }

    const payload = {
      id: 1, // Mock user ID for now since we're generating tokens on the fly
      hospital_id: hosp.id,
      name: hosp.name,
      role: 'DOCTOR'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldev123', { expiresIn: '8h' });

    res.json({
      token,
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      address: hosp.address || 'Real-time Registered Hospital Facility',
      lat: hosp.location_lat,
      lng: hosp.location_lng,
      role: 'DOCTOR'
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
