const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const { startServer } = require('../server/index');
const logger = require('../server/logger');

logger.setupProcessLogging('electron-main');

// Keep a global reference to prevent garbage collection
let mainWindow;
let serverInfo;

const isDev = process.argv.includes('--dev');

async function createWindow() {
  // Start Express server - fixed port in dev for Vite proxy, random in production
  const port = isDev ? 38080 : 0;
  serverInfo = await startServer(port);

  logger.info('Creating browser window', {
    isDev,
    userData: app.getPath('userData'),
    logPaths: logger.getLogPaths(),
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    },
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    serverPort: serverInfo.port
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: '工人考勤管理系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Build a simple menu
  const menuTemplate = [
    {
      label: '文件',
      submenu: [
        {
          label: '刷新',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.reload()
        },
        {
          label: '打开日志目录',
          click: () => shell.openPath(logger.getLogPaths().dir)
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => mainWindow.webContents.toggleDevTools()
        },
        {
          label: '全屏',
          accelerator: 'F11',
          click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen())
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  if (isDev) {
    // In development, load from Vite dev server
    logger.info('Loading renderer from Vite dev server', { url: 'http://localhost:5173' });
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from Express server which serves the built frontend
    logger.info('Loading renderer from production server', { url: `http://127.0.0.1:${serverInfo.port}` });
    mainWindow.loadURL(`http://127.0.0.1:${serverInfo.port}`);
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logger.error('Browser window load failed', {
      errorCode,
      errorDescription,
      validatedURL
    });
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logger.error('Renderer process gone', details);
  });

  mainWindow.on('unresponsive', () => {
    logger.warn('Browser window became unresponsive');
  });

  mainWindow.on('closed', () => {
    logger.info('Browser window closed');
    mainWindow = null;
  });
}

ipcMain.on('renderer-log', (event, payload = {}) => {
  const level = payload.level === 'warn' ? 'warn' : payload.level === 'error' ? 'error' : 'info';
  logger[level](payload.message || 'Renderer log', payload.meta);
});

ipcMain.handle('get-log-paths', async () => logger.getLogPaths());

app.whenReady().then(() => {
  // Set userData path after app is ready
  app.setPath('userData', path.join(app.getPath('appData'), 'attendance-system'));

  logger.info('Electron app ready', {
    userData: app.getPath('userData'),
    logPaths: logger.getLogPaths()
  });
  return createWindow();
}).catch((error) => {
  logger.error('Electron app failed during startup', error);
  throw error;
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (serverInfo && serverInfo.server) {
    serverInfo.server.close();
  }
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    logger.info('Electron app activate event, recreating window');
    createWindow();
  }
});
