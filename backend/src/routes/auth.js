const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });

    const result = await query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      id: user.id,
      role: user.role,
      hospital_id: user.hospital_id,
      name: user.name
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldev123', { expiresIn: '8h' });

    res.json({ token, user: payload });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// A refresh token route (for MVP just returns a new token)
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldev123', { ignoreExpiration: true });
    
    const payload = {
      id: decoded.id,
      role: decoded.role,
      hospital_id: decoded.hospital_id,
      name: decoded.name
    };
    const newToken = jwt.sign(payload, process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldev123', { expiresIn: '8h' });
    res.json({ token: newToken });
  } catch(err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
