const express = require('express');
const router = express.Router();
const { getDatabase, generateId, nowTimestamp } = require('../database');

// GET /api/attendance
router.get('/', (req, res) => {
  const db = getDatabase();
  res.json(db.prepare('SELECT * FROM attendance').all());
});

// GET /api/attendance/today-stats
router.get('/today-stats', (req, res) => {
  const db = getDatabase();
  const today = new Date().toISOString().substring(0, 10);
  const records = db.prepare('SELECT * FROM attendance WHERE date = ?').all(today);

  const workerIds = new Set(records.map(r => r.worker_id));
  const present = records.filter(r => r.status === 'present').length;
  const halfDay = records.filter(r => r.status === 'half_day').length;
  const leave = records.filter(r => r.status === 'leave').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const totalOvertime = records.reduce((sum, r) => sum + (r.overtime_hours || 0), 0);

  res.json({ totalWorkers: workerIds.size, present, halfDay, leave, absent, totalOvertime });
});

// GET /api/attendance/trend
router.get('/trend', (req, res) => {
  const db = getDatabase();
  const { start, end } = req.query;
  const records = db.prepare('SELECT * FROM attendance WHERE date BETWEEN ? AND ?').all(start, end);

  const grouped = {};
  records.forEach(r => {
    if (!grouped[r.date]) grouped[r.date] = [];
    grouped[r.date].push(r);
  });

  const result = [];
  let current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    const dateStr = current.toISOString().substring(0, 10);
    const dayRecords = grouped[dateStr] || [];
    result.push({
      date: dateStr,
      present: dayRecords.filter(a => a.status === 'present').length,
      halfDay: dayRecords.filter(a => a.status === 'half_day').length,
      leave: dayRecords.filter(a => a.status === 'leave').length,
      absent: dayRecords.filter(a => a.status === 'absent').length
    });
    current.setDate(current.getDate() + 1);
  }
  res.json(result);
});

// GET /api/attendance/worker/:workerId
router.get('/worker/:workerId', (req, res) => {
  const db = getDatabase();
  res.json(db.prepare('SELECT * FROM attendance WHERE worker_id = ?').all(req.params.workerId));
});

// GET /api/attendance/date/:date
router.get('/date/:date', (req, res) => {
  const db = getDatabase();
  res.json(db.prepare('SELECT * FROM attendance WHERE date = ?').all(req.params.date));
});

// GET /api/attendance/range
router.get('/range', (req, res) => {
  const db = getDatabase();
  const { start, end } = req.query;
  res.json(db.prepare('SELECT * FROM attendance WHERE date BETWEEN ? AND ?').all(start, end));
});

// POST /api/attendance/batch-upsert
router.post('/batch-upsert', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const records = Array.isArray(req.body?.records) ? req.body.records : [];

  if (records.length === 0) {
    return res.status(400).json({ message: '批量记录不能为空' });
  }

  const dedupMap = new Map();
  for (const item of records) {
    if (!item?.workerId || !item?.date) continue;
    // 请求内去重：同工人同日期仅保留最后一条记录。
    dedupMap.set(`${item.workerId}@@${item.date}`, item);
  }
  const dedupedRecords = Array.from(dedupMap.values());
  const dedupedCount = records.length - dedupedRecords.length;

  if (dedupedRecords.length === 0) {
    return res.status(400).json({ message: '去重后无有效补卡记录' });
  }

  const upsertStmt = db.prepare(`
    INSERT INTO attendance (id, worker_id, date, clock_in_time, clock_out_time, status, overtime_hours, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(worker_id, date) DO UPDATE SET
      status = excluded.status,
      overtime_hours = excluded.overtime_hours,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `);

  let successCount = 0;

  const batchTx = db.transaction((items) => {
    for (const item of items) {
      if (!item?.workerId || !item?.date || !item?.status) {
        throw new Error('存在无效记录：workerId/date/status 不能为空');
      }

      upsertStmt.run(
        generateId(),
        item.workerId,
        item.date,
        item.clockInTime || null,
        item.clockOutTime || null,
        item.status,
        item.overtimeHours || 0,
        item.notes || null,
        now,
        now
      );
      successCount += 1;
    }
  });

  try {
    batchTx(dedupedRecords);
    res.json({
      success: true,
      total: records.length,
      dedupedTotal: dedupedRecords.length,
      dedupedCount,
      successCount,
      failCount: dedupedRecords.length - successCount
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/attendance/:id
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM attendance WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '考勤记录不存在' });
  res.json(row);
});

// POST /api/attendance
router.post('/', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const a = req.body;
  const id = a.id || generateId();

  db.prepare(`
    INSERT INTO attendance (id, worker_id, date, clock_in_time, clock_out_time, status, overtime_hours, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, a.workerId, a.date, a.clockInTime || null, a.clockOutTime || null, a.status, a.overtimeHours || 0, a.notes || null, now, now);

  const created = db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);
  res.json(created);
});

// PUT /api/attendance/:id
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const a = req.body;

  db.prepare(`
    UPDATE attendance SET worker_id=?, date=?, clock_in_time=?, clock_out_time=?, status=?, overtime_hours=?, notes=?, updated_at=?
    WHERE id=?
  `).run(a.workerId, a.date, a.clockInTime || null, a.clockOutTime || null, a.status, a.overtimeHours || 0, a.notes || null, now, req.params.id);

  const updated = db.prepare('SELECT * FROM attendance WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/attendance/:id
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM attendance WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
