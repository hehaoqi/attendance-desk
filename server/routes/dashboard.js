const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

// GET /api/dashboard/today
router.get('/today', (req, res) => {
  const db = getDatabase();
  const today = new Date().toISOString().substring(0, 10);

  const records = db.prepare('SELECT * FROM attendance WHERE date = ?').all(today);
  const workerIds = new Set(records.map(r => r.worker_id));

  const attendance = {
    totalWorkers: workerIds.size,
    present: records.filter(r => r.status === 'present').length,
    halfDay: records.filter(r => r.status === 'half_day').length,
    leave: records.filter(r => r.status === 'leave').length,
    absent: records.filter(r => r.status === 'absent').length,
    totalOvertime: records.reduce((sum, r) => sum + (r.overtime_hours || 0), 0)
  };

  const totalWorkers = db.prepare("SELECT COUNT(*) as count FROM workers WHERE status = 'active'").get().count;

  res.json({ date: today, attendance, totalWorkers });
});

// GET /api/dashboard/month
router.get('/month', (req, res) => {
  const db = getDatabase();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Month attendance stats
  const records = db.prepare('SELECT * FROM attendance WHERE date BETWEEN ? AND ?').all(startDate, endDate);
  const totalWorkDays = records.filter(a => ['present', 'late'].includes(a.status)).length;
  const totalOvertime = records.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);

  const workerCount = db.prepare("SELECT COUNT(*) as count FROM workers WHERE status = 'active'").get().count;

  // Calculate total salary for the month
  const workers = db.prepare('SELECT * FROM workers').all();
  let totalSalary = 0;
  workers.forEach(worker => {
    const atts = db.prepare(
      'SELECT * FROM attendance WHERE worker_id = ? AND date BETWEEN ? AND ?'
    ).all(worker.id, startDate, endDate);

    const normalDays = atts.filter(a => a.status === 'present').length;
    const halfDays = atts.filter(a => a.status === 'half_day').length;
    const overtimeHours = atts.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);

    totalSalary += Math.round(
      worker.daily_wage * (normalDays + halfDays * 0.5) +
      overtimeHours * (worker.overtime_wage || 0)
    );
  });

  // Paid salary for this month period
  const paymentPeriod = `${year}-${String(month).padStart(2, '0')}`;
  const paidRow = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM salary_payments WHERE payment_period = ?'
  ).get(paymentPeriod);
  const paidSalary = paidRow.total;

  const remainingSalary = Math.round((totalSalary - paidSalary) * 100) / 100;

  res.json({
    month,
    year,
    attendance: { year, month, totalWorkDays, totalOvertime },
    workerCount,
    totalSalary,
    paidSalary,
    remainingSalary
  });
});

// GET /api/dashboard/year
router.get('/year', (req, res) => {
  const db = getDatabase();

  // Look up year date range from years table
  let yearRow;
  if (req.query.year) {
    yearRow = db.prepare('SELECT * FROM years WHERE year_number = ?').get(parseInt(req.query.year));
  }
  if (!yearRow) {
    yearRow = db.prepare('SELECT * FROM years WHERE is_default = 1').get();
  }

  let yearStart, yearEnd;
  if (yearRow) {
    yearStart = yearRow.start_date;
    yearEnd = yearRow.end_date;
  } else {
    // Fallback to settings or calendar year
    const settings = getSettingsMap(db);
    yearStart = settings['yearStartDate'];
    yearEnd = settings['yearEndDate'];
    if (!yearStart || !yearEnd) {
      const year = new Date().getFullYear();
      yearStart = `${year}-01-01`;
      yearEnd = `${year}-12-31`;
    }
  }

  // Calculate yearly salary
  const workers = db.prepare('SELECT * FROM workers').all();
  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  let totalSalary = 0;

  const yearlyData = workers.map(worker => {
    const attendances = db.prepare(
      'SELECT * FROM attendance WHERE worker_id = ? AND date BETWEEN ? AND ?'
    ).all(worker.id, yearStart, yearEnd);

    let workerTotal = 0;
    for (let m = 1; m <= 12; m++) {
      const monthAtts = attendances.filter(a => parseInt(a.date.substring(5, 7)) === m);
      const normalDays = monthAtts.filter(a => a.status === 'present').length;
      const halfDays = monthAtts.filter(a => a.status === 'half_day').length;
      const overtimeHours = monthAtts.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);
      workerTotal += Math.round(
        worker.daily_wage * (normalDays + halfDays * 0.5) +
        overtimeHours * (worker.overtime_wage || 0)
      );
    }
    totalSalary += workerTotal;
    return workerTotal;
  });

  // Paid salary
  const paidRow = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM salary_payments WHERE payment_date BETWEEN ? AND ?'
  ).get(yearStart, yearEnd);
  const paidSalary = paidRow.total;
  const remainingSalary = Math.round((totalSalary - paidSalary) * 100) / 100;

  // Total work days
  const allAttendances = db.prepare(
    'SELECT * FROM attendance WHERE date BETWEEN ? AND ?'
  ).all(yearStart, yearEnd);
  const totalWorkDays = allAttendances.filter(a => a.status === 'present' || a.status === 'half_day').length;

  res.json({
    yearStartDate: yearStart,
    yearEndDate: yearEnd,
    totalSalary,
    paidSalary,
    remainingSalary,
    totalWorkDays,
    workerCount: workers.length
  });
});

function getSettingsMap(db) {
  const rows = db.prepare('SELECT setting_key, setting_value FROM settings').all();
  const map = {};
  rows.forEach(r => { map[r.setting_key] = r.setting_value; });
  return map;
}

module.exports = router;
