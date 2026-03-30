const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const router = express.Router();
const { getDatabase, nowTimestamp } = require('../database');

const REQUIRED_TABLE_COLUMNS = {
  workers: ['id', 'name', 'worker_type', 'skill_level', 'daily_wage'],
  attendance: ['id', 'worker_id', 'date', 'status', 'overtime_hours'],
  salary_payments: ['id', 'worker_id', 'worker_name', 'payment_date', 'amount'],
  settings: ['setting_key', 'setting_value'],
  users: ['id', 'username', 'password', 'real_name', 'role'],
  roles: ['id', 'name', 'display_name'],
  years: ['id', 'year_number', 'start_date', 'end_date', 'is_default']
};

// GET /api/settings
router.get('/', (req, res) => {
  const db = getDatabase();
  const rows = db.prepare('SELECT setting_key, setting_value FROM settings').all();
  const map = {};
  rows.forEach(r => { map[r.setting_key] = r.setting_value; });
  res.json(map);
});

// PUT /api/settings
router.put('/', (req, res) => {
  const db = getDatabase();
  const now = nowTimestamp();
  const settings = req.body;

  const upsert = db.prepare(`
    INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=excluded.updated_at
  `);

  const saveAll = db.transaction((entries) => {
    for (const [key, value] of entries) {
      upsert.run(key, value, now, now);
    }
  });

  try {
    saveAll(Object.entries(settings));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/settings/stats
router.get('/stats', (req, res) => {
  const db = getDatabase();
  const workers = db.prepare('SELECT COUNT(*) as count FROM workers').get().count;
  const attendance = db.prepare('SELECT COUNT(*) as count FROM attendance').get().count;
  res.json({ workers, attendance, projects: 0 });
});

// GET /api/settings/backup/export
router.get('/backup/export', async (req, res) => {
  const db = getDatabase();
  const backupPath = path.join(os.tmpdir(), `attendance-backup-${Date.now()}.db`);

  try {
    await db.backup(backupPath);

    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const filename = `attendance-backup-${stamp}.db`;

    res.download(backupPath, filename, (err) => {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      if (err && !res.headersSent) {
        res.status(500).json({ success: false, message: '备份导出失败' });
      }
    });
  } catch (err) {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    res.status(500).json({ success: false, message: `备份导出失败: ${err.message}` });
  }
});

// POST /api/settings/backup/import
router.post('/backup/import', express.raw({ type: 'application/octet-stream', limit: '50mb' }), (req, res) => {
  const db = getDatabase();
  const importBuffer = req.body;

  if (!Buffer.isBuffer(importBuffer) || importBuffer.length === 0) {
    return res.status(400).json({ success: false, message: '导入文件不能为空' });
  }

  const tempImportPath = path.join(os.tmpdir(), `attendance-import-${Date.now()}.db`);

  try {
    fs.writeFileSync(tempImportPath, importBuffer);

    const tableRows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all();
    const tableNames = tableRows.map((row) => row.name);

    const importTx = db.transaction(() => {
      db.pragma('foreign_keys = OFF');
      db.exec(`ATTACH DATABASE '${tempImportPath.replace(/'/g, "''")}' AS importdb`);

      const currentVersion = Number(db.prepare('PRAGMA user_version').get()?.user_version || 0);
      const importVersion = Number(db.prepare('PRAGMA importdb.user_version').get()?.user_version || 0);
      if (currentVersion > 0 && importVersion > currentVersion) {
        throw new Error(`备份版本(${importVersion})高于当前系统版本(${currentVersion})，请先升级系统后再导入`);
      }

      for (const tableName of tableNames) {
        const exists = db
          .prepare("SELECT 1 as ok FROM importdb.sqlite_master WHERE type='table' AND name = ?")
          .get(tableName);
        if (!exists) {
          throw new Error(`备份文件结构不兼容，缺少数据表: ${tableName}`);
        }

        const requiredColumns = REQUIRED_TABLE_COLUMNS[tableName];
        if (requiredColumns && requiredColumns.length > 0) {
          const columnRows = db.prepare(`PRAGMA importdb.table_info(${tableName})`).all();
          const columnNames = new Set(columnRows.map((row) => row.name));
          const missingColumns = requiredColumns.filter((col) => !columnNames.has(col));
          if (missingColumns.length > 0) {
            throw new Error(
              `备份文件结构不兼容，表 ${tableName} 缺少字段: ${missingColumns.join(', ')}`
            );
          }
        }

        db.prepare(`DELETE FROM ${tableName}`).run();
        db.prepare(`INSERT INTO ${tableName} SELECT * FROM importdb.${tableName}`).run();
      }

      db.exec('DETACH DATABASE importdb');
      db.pragma('foreign_keys = ON');
      db.pragma('wal_checkpoint(TRUNCATE)');
    });

    importTx();
    res.json({ success: true, message: '数据导入成功' });
  } catch (err) {
    try {
      db.pragma('foreign_keys = ON');
      db.exec('DETACH DATABASE importdb');
    } catch (e) {
      // Ignore detach failure when not attached.
    }
    res.status(400).json({ success: false, message: `数据导入失败: ${err.message}` });
  } finally {
    if (fs.existsSync(tempImportPath)) {
      fs.unlinkSync(tempImportPath);
    }
  }
});

module.exports = router;
