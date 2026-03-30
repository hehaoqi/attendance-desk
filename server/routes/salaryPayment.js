const express = require('express');
const router = express.Router();
const { getDatabase, generateId, nowTimestamp } = require('../database');

const PAYMENT_SELECT_SQL = `
  SELECT
    sp.id,
    sp.worker_id,
    COALESCE(w.name, sp.worker_name) AS worker_name,
    sp.payment_date,
    sp.amount,
    sp.remarks,
    sp.payment_method,
    sp.payment_period,
    sp.created_at,
    sp.updated_at
  FROM salary_payments sp
  LEFT JOIN workers w ON w.id = sp.worker_id
`;

// GET /api/salary/payments
router.get('/', (req, res) => {
  const db = getDatabase();
  const { workerId, startDate, endDate } = req.query;

  let payments;
  if (workerId && startDate && endDate) {
    payments = db.prepare(
      `${PAYMENT_SELECT_SQL} WHERE sp.worker_id = ? AND sp.payment_date BETWEEN ? AND ? ORDER BY sp.payment_date DESC, sp.created_at DESC`
    ).all(workerId, startDate, endDate);
  } else if (workerId) {
    payments = db.prepare(
      `${PAYMENT_SELECT_SQL} WHERE sp.worker_id = ? ORDER BY sp.payment_date DESC, sp.created_at DESC`
    ).all(workerId);
  } else if (startDate && endDate) {
    payments = db.prepare(
      `${PAYMENT_SELECT_SQL} WHERE sp.payment_date BETWEEN ? AND ? ORDER BY sp.payment_date DESC, sp.created_at DESC`
    ).all(startDate, endDate);
  } else {
    payments = db.prepare(`${PAYMENT_SELECT_SQL} ORDER BY sp.payment_date DESC, sp.created_at DESC`).all();
  }

  res.json(payments);
});

// GET /api/salary/payments/worker/:workerId
router.get('/worker/:workerId', (req, res) => {
  const db = getDatabase();
  const { startDate, endDate } = req.query;

  let payments;
  if (startDate && endDate) {
    payments = db.prepare(
      `${PAYMENT_SELECT_SQL} WHERE sp.worker_id = ? AND sp.payment_date BETWEEN ? AND ? ORDER BY sp.payment_date DESC, sp.created_at DESC`
    ).all(req.params.workerId, startDate, endDate);
  } else {
    payments = db.prepare(
      `${PAYMENT_SELECT_SQL} WHERE sp.worker_id = ? ORDER BY sp.payment_date DESC, sp.created_at DESC`
    ).all(req.params.workerId);
  }

  res.json(payments);
});

// GET /api/salary/payments/:id
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const row = db.prepare(`${PAYMENT_SELECT_SQL} WHERE sp.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ message: '记录不存在' });
  res.json(row);
});

// POST /api/salary/payments
router.post('/', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const p = req.body;
  const id = p.id || generateId();

  const worker = db.prepare('SELECT name FROM workers WHERE id = ?').get(p.workerId);
  if (!worker) {
    return res.status(400).json({ message: '工人不存在' });
  }
  const workerName = worker.name;

  db.prepare(`
    INSERT INTO salary_payments (id, worker_id, worker_name, payment_date, amount, remarks, payment_method, payment_period, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, p.workerId, workerName, p.paymentDate, p.amount, p.remarks || null, p.paymentMethod || null, p.paymentPeriod || null, now, now);

  const created = db.prepare(`${PAYMENT_SELECT_SQL} WHERE sp.id = ?`).get(id);
  res.json(created);
});

// PUT /api/salary/payments/:id
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const p = req.body;

  const worker = db.prepare('SELECT name FROM workers WHERE id = ?').get(p.workerId);
  if (!worker) {
    return res.status(400).json({ message: '工人不存在' });
  }

  db.prepare(`
    UPDATE salary_payments SET worker_id=?, worker_name=?, payment_date=?, amount=?, remarks=?, payment_method=?, payment_period=?, updated_at=?
    WHERE id=?
  `).run(p.workerId, worker.name, p.paymentDate, p.amount, p.remarks || null, p.paymentMethod || null, p.paymentPeriod || null, now, req.params.id);

  const updated = db.prepare(`${PAYMENT_SELECT_SQL} WHERE sp.id = ?`).get(req.params.id);
  res.json(updated);
});

// PUT /api/salary/payments/:id/remarks
router.put('/:id/remarks', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const { remarks } = req.body;

  db.prepare('UPDATE salary_payments SET remarks=?, updated_at=? WHERE id=?').run(remarks, now, req.params.id);

  const updated = db.prepare(`${PAYMENT_SELECT_SQL} WHERE sp.id = ?`).get(req.params.id);
  res.json(updated);
});

// DELETE /api/salary/payments/:id
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM salary_payments WHERE id = ?').run(req.params.id);
  res.status(200).send();
});

module.exports = router;
