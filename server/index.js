const express = require('express');
const path = require('path');
const { toCamelCase } = require('./utils');
const logger = require('./logger');

logger.setupProcessLogging('server');

function createServer() {
  const app = express();

  // Middleware
  app.use(express.json());

  app.use('/api', (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const meta = {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip
      };
      if (res.statusCode >= 400) {
        logger.warn('API request completed with warning', meta);
      } else {
        logger.info('API request completed', meta);
      }
    });
    next();
  });

  // Transform snake_case DB responses to camelCase for frontend
  app.use('/api', (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => originalJson(toCamelCase(data));
    next();
  });

  // API routes
  app.use('/api/workers', require('./routes/workers'));
  app.use('/api/attendance', require('./routes/attendance'));
  app.use('/api/salary/payments', require('./routes/salaryPayment'));
  app.use('/api/salary', require('./routes/salary'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/roles', require('./routes/roles'));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/years', require('./routes/years'));

  // Serve static frontend files in production
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });

  // Error handler
  app.use((err, req, res, next) => {
    logger.error('Express request failed', {
      method: req.method,
      path: req.originalUrl,
      message: err.message,
      stack: err.stack
    });
    res.status(500).json({ success: false, message: '服务器内部错误' });
  });

  return app;
}

function startServer(port = 0) {
  return new Promise((resolve, reject) => {
    const app = createServer();
    const server = app.listen(port, '127.0.0.1', () => {
      const actualPort = server.address().port;
      logger.info('Server started', {
        url: `http://127.0.0.1:${actualPort}`,
        logPaths: logger.getLogPaths()
      });
      resolve({ server, port: actualPort });
    });
    server.on('error', (err) => {
      logger.error('Server failed to start', err);
      reject(err);
    });
  });
}

module.exports = { createServer, startServer };
