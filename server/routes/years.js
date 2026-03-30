const express = require('express');
const router = express.Router();
const { getDatabase, generateId, nowTimestamp } = require('../database');

// GET /api/years
router.get('/', (req, res) => {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM years ORDER BY start_date ASC, year_number ASC').all();
  res.json(rows);
});

// GET /api/years/max
router.get('/max', (req, res) => {
  const db = getDatabase();
  const row = db.prepare('SELECT MAX(year_number) as max_year FROM years').get();
  res.json({ maxYear: row.max_year });
});

// GET /api/years/:id
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM years WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '年份不存在' });
  res.json(row);
});

// POST /api/years
router.post('/', (req, res) => {
  const db = getDatabase();
  const id = generateId();
  const now = nowTimestamp();
  const { yearNumber, startDate, endDate, isDefault } = req.body;

  if (isDefault) {
    db.prepare('UPDATE years SET is_default = 0').run();
  }

  db.prepare(
    'INSERT INTO years (id, year_number, start_date, end_date, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, yearNumber, startDate, endDate, isDefault ? 1 : 0, now, now);

  const created = db.prepare('SELECT * FROM years WHERE id = ?').get(id);
  res.json(created);
});

// PUT /api/years/:id
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const { yearNumber, startDate, endDate, isDefault } = req.body;

  if (isDefault) {
    db.prepare('UPDATE years SET is_default = 0').run();
  }

  db.prepare(
    'UPDATE years SET year_number = ?, start_date = ?, end_date = ?, is_default = ?, updated_at = ? WHERE id = ?'
  ).run(yearNumber, startDate, endDate, isDefault ? 1 : 0, now, req.params.id);

  const updated = db.prepare('SELECT * FROM years WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/years/:id
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM years WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
