const fs = require('fs');
const path = require('path');

let electronApp;
try {
  electronApp = require('electron').app;
} catch (error) {
  electronApp = null;
}

function getBaseDir() {
  if (electronApp) {
    return electronApp.getPath('userData');
  }
  return path.join(__dirname, '..');
}

function getLogDir() {
  const logDir = path.join(getBaseDir(), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  return logDir;
}

function getLogPaths() {
  const logDir = getLogDir();
  const paths = {
    dir: logDir,
    app: path.join(logDir, 'app.log'),
    error: path.join(logDir, 'error.log')
  };

  for (const filePath of [paths.app, paths.error]) {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '', 'utf8');
    }
  }

  return paths;
}

function serializeMeta(meta) {
  if (meta === undefined || meta === null) {
    return '';
  }
  if (meta instanceof Error) {
    return JSON.stringify({
      name: meta.name,
      message: meta.message,
      stack: meta.stack
    });
  }
  if (typeof meta === 'string') {
    return meta;
  }
  try {
    return JSON.stringify(meta);
  } catch (error) {
    return String(meta);
  }
}

function write(level, message, meta) {
  const logPaths = getLogPaths();
  const timestamp = new Date().toISOString();
  const suffix = serializeMeta(meta);
  const line = `${timestamp} [${level}] ${message}${suffix ? ` ${suffix}` : ''}\n`;

  fs.appendFileSync(logPaths.app, line, 'utf8');
  if (level === 'ERROR' || level === 'FATAL' || level === 'WARN') {
    fs.appendFileSync(logPaths.error, line, 'utf8');
  }

  const consoleMethod = level === 'ERROR' || level === 'FATAL' ? 'error' : level === 'WARN' ? 'warn' : 'log';
  console[consoleMethod](line.trimEnd());
}

function info(message, meta) {
  write('INFO', message, meta);
}

function warn(message, meta) {
  write('WARN', message, meta);
}

function error(message, meta) {
  write('ERROR', message, meta);
}

function setupProcessLogging(processName) {
  const key = `__attendance_logging_${processName}`;
  if (global[key]) {
    return;
  }
  global[key] = true;

  process.on('uncaughtException', (err) => {
    error(`${processName} uncaughtException`, err);
  });

  process.on('unhandledRejection', (reason) => {
    error(`${processName} unhandledRejection`, reason);
  });
}

module.exports = {
  getLogPaths,
  info,
  warn,
  error,
  setupProcessLogging
};