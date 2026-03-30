const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

// GET /api/salary/calculate?year=&month=
router.get('/calculate', (req, res) => {
  const db = getDatabase();
  const year = parseInt(req.query.year);
  const month = parseInt(req.query.month);

  const workers = db.prepare('SELECT * FROM workers').all();

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const result = workers.map(worker => {
    const attendances = db.prepare(
      'SELECT * FROM attendance WHERE worker_id = ? AND date BETWEEN ? AND ?'
    ).all(worker.id, startDate, endDate);

    const normalDays = attendances.filter(a => a.status === 'present').length;
    const halfDays = attendances.filter(a => a.status === 'half_day').length;
    const leaveDays = attendances.filter(a => a.status === 'leave').length;
    const absentDays = attendances.filter(a => a.status === 'absent').length;
    const overtimeHours = attendances.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);

    const normalSalary = worker.daily_wage * (normalDays + halfDays * 0.5);
    const overtimeSalary = overtimeHours * (worker.overtime_wage || 0);
    const totalSalary = normalSalary + overtimeSalary;

    return {
      workerId: worker.id,
      workerName: worker.name,
      normalDays,
      halfDays,
      checkInDays: normalDays + halfDays * 0.5,
      leaveDays,
      absentDays,
      overtimeHours,
      normalSalary: Math.round(normalSalary),
      overtimeSalary: Math.round(overtimeSalary),
      totalSalary: Math.round(totalSalary)
    };
  });

  res.json(result);
});

// GET /api/salary/yearly
router.get('/yearly', (req, res) => {
  const db = getDatabase();

  // Look up year date range from years table
  let yearStart, yearEnd;
  const defaultYear = db.prepare('SELECT * FROM years WHERE is_default = 1').get();
  if (defaultYear) {
    yearStart = defaultYear.start_date;
    yearEnd = defaultYear.end_date;
  } else {
    const settings = getSettingsMap(db);
    yearStart = settings['yearStartDate'];
    yearEnd = settings['yearEndDate'];
    if (!yearStart || !yearEnd) {
      const year = new Date().getFullYear();
      yearStart = `${year}-01-01`;
      yearEnd = `${year}-12-31`;
    }
  }

  res.json(calculateYearlySalary(db, yearStart, yearEnd));
});

// GET /api/salary/annual-summary-with-payments
router.get('/annual-summary-with-payments', (req, res) => {
  const db = getDatabase();
  let yearStart, yearEnd;

  // Look up year date range from years table
  if (req.query.year) {
    const yearRow = db.prepare('SELECT * FROM years WHERE year_number = ?').get(parseInt(req.query.year));
    if (yearRow) {
      yearStart = yearRow.start_date;
      yearEnd = yearRow.end_date;
    }
  }
  if (!yearStart || !yearEnd) {
    const defaultYear = db.prepare('SELECT * FROM years WHERE is_default = 1').get();
    if (defaultYear) {
      yearStart = defaultYear.start_date;
      yearEnd = defaultYear.end_date;
    }
  }
  if (!yearStart || !yearEnd) {
    const settings = getSettingsMap(db);
    yearStart = settings['yearStartDate'];
    yearEnd = settings['yearEndDate'];
    if (!yearStart || !yearEnd) {
      const year = new Date().getFullYear();
      yearStart = `${year}-01-01`;
      yearEnd = `${year}-12-31`;
    }
  }

  const workers = db.prepare('SELECT * FROM workers').all();
  const payments = db.prepare(
    'SELECT * FROM salary_payments WHERE payment_date BETWEEN ? AND ?'
  ).all(yearStart, yearEnd);

  // Group payments by worker
  const paidAmountMap = {};
  payments.forEach(p => {
    paidAmountMap[p.worker_id] = (paidAmountMap[p.worker_id] || 0) + (p.amount || 0);
  });

  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const rows = workers.map(worker => {
    const attendances = db.prepare(
      'SELECT * FROM attendance WHERE worker_id = ? AND date BETWEEN ? AND ?'
    ).all(worker.id, yearStart, yearEnd);

    const dto = {
      workerId: worker.id,
      workerName: worker.name,
      dailyWage: worker.daily_wage
    };

    let yearlyTotal = 0;
    let totalNormalDays = 0;
    let totalHalfDays = 0;

    for (let m = 1; m <= 12; m++) {
      const monthStr = String(m).padStart(2, '0');
      const monthAttendances = attendances.filter(a => {
        const aMonth = parseInt(a.date.substring(5, 7));
        return aMonth === m;
      });

      const normalDays = monthAttendances.filter(a => a.status === 'present').length;
      const halfDays = monthAttendances.filter(a => a.status === 'half_day').length;
      const overtimeHours = monthAttendances.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);

      const monthSalary = Math.round(
        worker.daily_wage * (normalDays + halfDays * 0.5) +
        overtimeHours * (worker.overtime_wage || 0)
      );

      dto[monthKeys[m - 1]] = monthSalary;
      yearlyTotal += monthSalary;
      totalNormalDays += normalDays;
      totalHalfDays += halfDays;
    }

    const totalWorkDays = totalNormalDays + totalHalfDays * 0.5;
    const paidAmount = paidAmountMap[worker.id] || 0;
    let unpaidAmount = yearlyTotal - paidAmount;
    if (unpaidAmount < 0) unpaidAmount = 0;

    dto.totalWorkDays = Math.floor(totalWorkDays);
    dto.yearlyTotal = Math.round(yearlyTotal);
    dto.paidAmount = Math.round(paidAmount);
    dto.unpaidAmount = Math.round(unpaidAmount);

    return dto;
  });

  const summary = rows.reduce((acc, row) => {
    const yearlyTotal = Number(row.yearlyTotal) || 0;
    const paidAmount = Number(row.paidAmount) || 0;
    const unpaidAmount = Number(row.unpaidAmount) || 0;

    acc.total += yearlyTotal;
    acc.paidAmount += paidAmount;
    acc.remainingAmount += unpaidAmount;
    return acc;
  }, { total: 0, paidAmount: 0, remainingAmount: 0 });

  res.json({
    yearStartDate: yearStart,
    yearEndDate: yearEnd,
    rows,
    summary: {
      total: Math.round(summary.total),
      paidAmount: Math.round(summary.paidAmount),
      remainingAmount: Math.round(summary.remainingAmount)
    }
  });
});

function calculateYearlySalary(db, yearStart, yearEnd) {
  const workers = db.prepare('SELECT * FROM workers').all();
  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  return workers.map(worker => {
    const attendances = db.prepare(
      'SELECT * FROM attendance WHERE worker_id = ? AND date BETWEEN ? AND ?'
    ).all(worker.id, yearStart, yearEnd);

    const workerData = { workerId: worker.id, workerName: worker.name };
    let yearlyTotal = 0;

    for (let m = 1; m <= 12; m++) {
      const monthAttendances = attendances.filter(a => {
        return parseInt(a.date.substring(5, 7)) === m;
      });

      const normalDays = monthAttendances.filter(a => a.status === 'present').length;
      const halfDays = monthAttendances.filter(a => a.status === 'half_day').length;
      const overtimeHours = monthAttendances.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);

      const monthSalary = Math.round(
        worker.daily_wage * (normalDays + halfDays * 0.5) +
        overtimeHours * (worker.overtime_wage || 0)
      );

      workerData[monthKeys[m - 1]] = monthSalary;
      yearlyTotal += monthSalary;
    }

    workerData.yearlyTotal = Math.round(yearlyTotal);
    return workerData;
  });
}

function getSettingsMap(db) {
  const rows = db.prepare('SELECT setting_key, setting_value FROM settings').all();
  const map = {};
  rows.forEach(r => { map[r.setting_key] = r.setting_value; });
  return map;
}

module.exports = router;
