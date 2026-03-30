const express = require('express');
const router = express.Router();
const { getDatabase, generateId, nowTimestamp } = require('../database');

// GET /api/roles
router.get('/', (req, res) => {
  const db = getDatabase();
  res.json(db.prepare('SELECT * FROM roles').all());
});

// POST /api/roles
router.post('/', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const r = req.body;
  const id = r.id || generateId();

  const menus = typeof r.menus === 'string' ? r.menus : JSON.stringify(r.menus || []);

  db.prepare(`
    INSERT INTO roles (id, name, display_name, description, menus, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, r.name, r.displayName, r.description || null, menus, now, now);

  const created = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  res.json(created);
});

// PUT /api/roles/:id
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const r = req.body;
  const menus = typeof r.menus === 'string' ? r.menus : JSON.stringify(r.menus || []);

  db.prepare(`
    UPDATE roles SET name=?, display_name=?, description=?, menus=?, updated_at=?
    WHERE id=?
  `).run(r.name, r.displayName, r.description || null, menus, now, req.params.id);

  const updated = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/roles/:id
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
