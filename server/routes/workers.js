const express = require('express');
const router = express.Router();
const { getDatabase, generateId, nowTimestamp } = require('../database');

// GET /api/workers
router.get('/', (req, res) => {
  const db = getDatabase();
  const { status, search } = req.query;

  if (search) {
    const like = `%${search}%`;
    const rows = db.prepare(
      'SELECT * FROM workers WHERE name LIKE ? OR phone LIKE ?'
    ).all(like, like);
    return res.json(rows);
  }

  if (status) {
    const rows = db.prepare('SELECT * FROM workers WHERE status = ?').all(status);
    return res.json(rows);
  }

  const rows = db.prepare('SELECT * FROM workers').all();
  res.json(rows);
});

// GET /api/workers/:id
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '工人不存在' });
  res.json(row);
});

// POST /api/workers
router.post('/', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const id = req.body.id || generateId();
  const w = req.body;

  db.prepare(`
    INSERT INTO workers (id, name, phone, id_card, worker_type, skill_level, daily_wage, overtime_wage, join_date, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, w.name, w.phone || null, w.idCard || null, w.workerType, w.skillLevel, w.dailyWage, w.overtimeWage || 0, w.joinDate || null, w.status || 'active', w.notes || null, now, now);

  const created = db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
  res.json(created);
});

// PUT /api/workers/:id
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const w = req.body;

  db.prepare(`
    UPDATE workers SET name=?, phone=?, id_card=?, worker_type=?, skill_level=?, daily_wage=?, overtime_wage=?, join_date=?, status=?, notes=?, updated_at=?
    WHERE id=?
  `).run(w.name, w.phone || null, w.idCard || null, w.workerType, w.skillLevel, w.dailyWage, w.overtimeWage || 0, w.joinDate || null, w.status || 'active', w.notes || null, now, req.params.id);

  const updated = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/workers/:id
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM workers WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
