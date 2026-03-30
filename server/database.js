const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let electronApp;
try {
  electronApp = require('electron').app;
} catch (e) {
  electronApp = null;
}

let db;

function getDbPath() {
  // In production, store in user data directory; in dev, store in project root
  const userDataPath = electronApp ? electronApp.getPath('userData') : __dirname;
  return path.join(userDataPath, 'attendance.db');
}

function getDatabase() {
  if (!db) {
    const dbPath = getDbPath();
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDatabase();
  }
  return db;
}

function initDatabase() {
  db.exec(`
    -- 1. 角色表
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      menus TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 2. 用户表
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      real_name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 3. 工人表
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      id_card TEXT,
      worker_type TEXT NOT NULL,
      skill_level TEXT NOT NULL,
      daily_wage REAL NOT NULL,
      overtime_wage REAL DEFAULT 0,
      join_date TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 4. 考勤表
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      date TEXT NOT NULL,
      clock_in_time TEXT,
      clock_out_time TEXT,
      status TEXT,
      overtime_hours REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
      UNIQUE(worker_id, date)
    );

    -- 5. 工资发放表
    CREATE TABLE IF NOT EXISTS salary_payments (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      remarks TEXT,
      payment_method TEXT,
      payment_period TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );

    -- 6. 设置表
    CREATE TABLE IF NOT EXISTS settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 7. 年份表（农历年）
    CREATE TABLE IF NOT EXISTS years (
      id TEXT PRIMARY KEY,
      year_number INTEGER NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_attendance_worker_id ON attendance(worker_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
    CREATE INDEX IF NOT EXISTS idx_salary_worker_id ON salary_payments(worker_id);
    CREATE INDEX IF NOT EXISTS idx_salary_payment_date ON salary_payments(payment_date);
    CREATE INDEX IF NOT EXISTS idx_salary_payment_period ON salary_payments(payment_period);
    CREATE INDEX IF NOT EXISTS idx_years_year_number ON years(year_number);
  `);

  db.exec(`
    UPDATE workers
    SET worker_type = CASE
      WHEN lower(trim(worker_type)) IN ('smoke', 'temporary') OR trim(worker_type) = '临时工' THEN 'temporary'
      WHEN lower(trim(worker_type)) = 'permanent' OR trim(worker_type) = '正式工' THEN 'permanent'
      ELSE worker_type
    END
    WHERE worker_type IS NOT NULL;
  `);

  // Insert default data if tables are empty
  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get().count;
  if (roleCount === 0) {
    seedDefaultData();
  }

  ensureLunarYearsData();
}

function seedDefaultData() {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Default roles
  const insertRole = db.prepare(
    'INSERT INTO roles (id, name, display_name, description, menus, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  insertRole.run('role-001', 'admin', '超级管理员', '拥有系统所有权限', '["workers","attendance","salary","settings","users","roles"]', now, now);
  insertRole.run('role-002', 'manager', '普通管理员', '管理工人和考勤', '["workers","attendance","salary"]', now, now);

  // Default users
  const insertUser = db.prepare(
    'INSERT INTO users (id, username, password, real_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertUser.run('user-001', 'admin', 'admin123', '系统管理员', 'admin', 'active', now, now);

  // Default settings
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (setting_key, setting_value, created_at, updated_at) VALUES (?, ?, ?, ?)'
  );
  insertSetting.run('systemName', '工人考勤管理系统', now, now);
  insertSetting.run('companyName', '', now, now);
  insertSetting.run('seniorDailyWage', '350', now, now);
  insertSetting.run('seniorOvertimeWage', '50', now, now);
  insertSetting.run('mediumDailyWage', '280', now, now);
  insertSetting.run('mediumOvertimeWage', '40', now, now);
  insertSetting.run('normalDailyWage', '220', now, now);
  insertSetting.run('normalOvertimeWage', '30', now, now);

}

function ensureLunarYearsData() {
  const now = nowTimestamp();

  // 预置未来10个农历年（2026-2035），起止日期按春节到下一年春节前一天。
  const presetYears = [
    { yearNumber: 2026, startDate: '2026-02-17', endDate: '2027-02-05', isDefault: 1 },
    { yearNumber: 2027, startDate: '2027-02-06', endDate: '2028-01-25', isDefault: 0 },
    { yearNumber: 2028, startDate: '2028-01-26', endDate: '2029-02-12', isDefault: 0 },
    { yearNumber: 2029, startDate: '2029-02-13', endDate: '2030-02-02', isDefault: 0 },
    { yearNumber: 2030, startDate: '2030-02-03', endDate: '2031-01-22', isDefault: 0 },
    { yearNumber: 2031, startDate: '2031-01-23', endDate: '2032-02-10', isDefault: 0 },
    { yearNumber: 2032, startDate: '2032-02-11', endDate: '2033-01-30', isDefault: 0 },
    { yearNumber: 2033, startDate: '2033-01-31', endDate: '2034-02-18', isDefault: 0 },
    { yearNumber: 2034, startDate: '2034-02-19', endDate: '2035-02-07', isDefault: 0 },
    { yearNumber: 2035, startDate: '2035-02-08', endDate: '2036-01-27', isDefault: 0 }
  ];

  const tx = db.transaction(() => {
    db.prepare('UPDATE years SET is_default = 0, updated_at = ?').run(now);

    const upsertYear = db.prepare(`
      INSERT INTO years (id, year_number, start_date, end_date, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(year_number) DO UPDATE SET
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        is_default = excluded.is_default,
        updated_at = excluded.updated_at
    `);

    presetYears.forEach((item) => {
      upsertYear.run(
        generateId(),
        item.yearNumber,
        item.startDate,
        item.endDate,
        item.isDefault,
        now,
        now
      );
    });
  });

  tx();
}

function generateId() {
  return uuidv4();
}

function nowTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

module.exports = { getDatabase, getDbPath, generateId, nowTimestamp };
