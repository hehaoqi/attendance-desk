const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');
const logger = require('../logger');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const db = getDatabase();
  const { username, password } = req.body;

  if (!username || !password) {
    logger.warn('Login rejected: empty username or password', { username: username || '' });
    return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || user.password !== password || user.status !== 'active') {
    logger.warn('Login failed', {
      username,
      userExists: Boolean(user),
      status: user ? user.status : null
    });
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  logger.info('Login succeeded', { username, userId: user.id, role: user.role });

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      realName: user.real_name,
      role: user.role
    }
  });
});

// GET /api/auth/check
router.get('/check', (req, res) => {
  res.json({ authenticated: true });
});

module.exports = router;
