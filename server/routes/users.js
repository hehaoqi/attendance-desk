const express = require('express');
const router = express.Router();
const { getDatabase, generateId, nowTimestamp } = require('../database');

// GET /api/users
router.get('/', (req, res) => {
  const db = getDatabase();
  res.json(db.prepare('SELECT * FROM users').all());
});

// POST /api/users
router.post('/', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const u = req.body;
  const id = u.id || generateId();

  db.prepare(`
    INSERT INTO users (id, username, password, real_name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, u.username, u.password, u.realName, u.role, u.status || 'active', now, now);

  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(created);
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const u = req.body;

  // If password is empty/null, keep existing password
  if (u.password) {
    db.prepare(`
      UPDATE users SET username=?, password=?, real_name=?, role=?, status=?, updated_at=? WHERE id=?
    `).run(u.username, u.password, u.realName, u.role, u.status || 'active', now, req.params.id);
  } else {
    db.prepare(`
      UPDATE users SET username=?, real_name=?, role=?, status=?, updated_at=? WHERE id=?
    `).run(u.username, u.realName, u.role, u.status || 'active', now, req.params.id);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
