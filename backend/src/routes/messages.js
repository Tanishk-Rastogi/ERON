const express = require('express');
const { query } = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(), async (req, res) => {
  res.json([]);
});

router.post('/', auth(), async (req, res) => {
  res.status(201).json({});
});

router.post('/read', auth(), async (req, res) => {
  const { threadId, userId } = req.body;
  if (req.io) {
    req.io.emit('MESSAGES_READ', {
      threadId,
      readByUserId: userId,
      readAt: new Date().toISOString()
    });
  }
  res.json({ success: true });
});

module.exports = router;
