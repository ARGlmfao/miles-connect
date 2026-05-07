import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, dialog } from 'electron';
import path from 'path';
import os from 'os';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let overlayWindow;
let tray;
let wss;
let isQuitting = false;
let pairingCode = '';
let udpClient;
let overlayReady = false;
let overlayQueue = [];

const isDev = !app.isPackaged;
const iconPath = path.join(app.getAppPath(), isDev ? 'public/icon.ico' : 'dist/icon.ico');
const trayPath = path.join(app.getAppPath(), isDev ? 'public/tray.ico' : 'dist/tray.ico');

const appIcon = nativeImage.createFromPath(iconPath);
const trayIcon = nativeImage.createFromPath(trayPath);

// Config
const WS_PORT = 8787;
const recentNotifications = new Map();

function normalize(str) {
  if (!str) return '';
  return str.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

function isDuplicateNotification(message) {
  // Manual test events bypass dedupe (unless within 2s)
  if (message.isTest) {
    const lastTest = recentNotifications.get('INTERNAL_TEST_EVENT') || 0;
    if (Date.now() - lastTest < 2000) {
      console.log('[DUPLICATE CHECK] Blocked rapid test event');
      return true;
    }
    recentNotifications.set('INTERNAL_TEST_EVENT', Date.now());
    return false;
  }

  if (message.type !== 'notification' && message.type !== 'call') return false;

  const appName = normalize(message.app || message.package || (message.type === 'call' ? 'phone' : ''));
  const title = normalize(message.title || message.name || '');
  const text = normalize(message.text || message.number || '');

  // Requirement: Fix duplicate call overlay (Phone/Contacts/WhatsApp/Truecaller notification mirroring)
  // We block these if they are just system notification mirrors of a call we are already handling
  if (message.type === 'notification') {
    const isCallApp = appName.includes('phone') || appName.includes('contact') || appName.includes('whatsapp') || appName.includes('truecaller');
    const isCallText = title.includes('call') || title.includes('ringing') || title.includes('incoming');
    
    if (isCallApp && isCallText) {
      console.log('[DUPLICATE CHECK] Blocked call-related system notification to avoid duplicate overlays');
      return true;
    }
  }

  // Exact same normalized app + title + text within 8 seconds
  const key = `${message.type}|${appName}|${title}|${text}`;
  const now = Date.now();
  const windowSize = 8000;

  // Prune entries older than 30 seconds
  for (const [k, ts] of recentNotifications.entries()) {
    if (now - ts > 30000) recentNotifications.delete(k);
  }

  if (recentNotifications.has(key) && (now - recentNotifications.get(key) < windowSize)) {
    console.log('[DUPLICATE CHECK RESULT] IGNORED (Duplicate within 8s):', key);
    return true;
  }

  recentNotifications.set(key, now);
  console.log('[DUPLICATE CHECK RESULT] PASSED:', key);
  return false;
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function generatePairingCode() {
  const animals = ['TIGER', 'LION', 'WOLF', 'BEAR', 'EAGLE', 'SHARK', 'PANDA', 'DEER', 'HAWK', 'LIGER'];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const number = Math.floor(1000 + Math.random() * 9000);
  return `${animal}-${number}`;
}

import dgram from 'dgram';

function startUdpBroadcast() {
  if (udpClient) return;

  udpClient = dgram.createSocket('udp4');
  
  udpClient.on('error', (err) => {
    console.error('UDP Client Error:', err);
    udpClient.close();
    udpClient = null;
  });

  udpClient.bind(() => {
    udpClient.setBroadcast(true);
    console.log('UDP Broadcast started on port 8788');
    
    setInterval(() => {
      try {
        const message = JSON.stringify({
          type: 'phonebridge_discovery',
          code: pairingCode,
          wsUrl: `ws://${getLocalIP()}:${WS_PORT}`,
          deviceName: os.hostname() || "Miles Connect"
        });
        
        const buffer = Buffer.from(message);
        udpClient.send(buffer, 0, buffer.length, 8788, '255.255.255.255');
      } catch (e) {
        console.error('Failed to send UDP broadcast:', e);
      }
    }, 1000);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: 'Miles Connect',
    icon: appIcon,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    show: false,
    type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#overlay`);
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'overlay' });
  }

  overlayWindow.webContents.on('did-finish-load', () => {
    console.log('[OVERLAY WINDOW READY] Overlay page loaded');
    overlayReady = true;
    processOverlayQueue();
  });

  overlayWindow.on('closed', () => {
    console.log('[OVERLAY WINDOW CLOSED] Resetting state');
    overlayWindow = null;
    overlayReady = false;
    if (!isQuitting) {
      // Recreate immediately to be ready for next notification
      createOverlayWindow();
    }
  });
}

function processOverlayQueue() {
  if (!overlayReady || overlayQueue.length === 0) return;
  
  console.log(`[PROCESS QUEUE] Sending ${overlayQueue.length} queued messages`);
  while (overlayQueue.length > 0) {
    const msg = overlayQueue.shift();
    sendToOverlayInternal(msg);
  }
}

function sendToOverlayInternal(message, retryCount = 0) {
  console.log('OVERLAY REQUESTED');

  const isWindowReady = overlayWindow && 
                       !overlayWindow.isDestroyed() && 
                       overlayWindow.webContents && 
                       !overlayWindow.webContents.isLoading() &&
                       overlayReady;

  if (!isWindowReady) {
    if (retryCount === 0) {
      console.log('[OVERLAY NOT READY] Retrying in 300ms...');
      if (!overlayWindow || overlayWindow.isDestroyed()) {
        createOverlayWindow();
      }
      setTimeout(() => sendToOverlayInternal(message, 1), 300);
    } else {
      console.log('[OVERLAY NOT READY] Still not ready after retry, queueing message');
      overlayQueue.push(message);
    }
    return;
  }

  try {
    // Show window without stealing focus
    overlayWindow.showInactive();
    // Ensure click-through is enabled after showing
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    
    overlayWindow.webContents.send('ws-event', message);
    console.log('OVERLAY IPC SENT');
  } catch (err) {
    console.error('[OVERLAY ERROR] Failed to send to overlay:', err);
    if (retryCount === 0) {
      console.log('[OVERLAY ERROR RETRY] Retrying in 300ms...');
      setTimeout(() => sendToOverlayInternal(message, 1), 300);
    }
  }
}

function setupTray() {
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Miles Connect', click: () => mainWindow.show() },
    { label: 'Toggle Gaming Mode', type: 'checkbox', checked: false, click: (item) => {
      mainWindow.webContents.send('toggle-gaming-mode', item.checked);
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => {
      isQuitting = true;
      app.quit();
    }}
  ]);

  tray.setToolTip('Miles Connect');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow.show());
}

function startWebSocketServer() {
  if (wss) {
    console.log('WS Server already running, skipping start');
    return;
  }

  try {
    wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' });

    wss.on('connection', (ws) => {
      console.log('CLIENT CONNECTED TO WS SERVER');
      if (mainWindow) mainWindow.webContents.send('ws-status', 'connected');
      
      ws.on('message', (data) => {
        try {
          const rawMessage = data.toString();
          console.log('[RAW WS MESSAGE RECEIVED]:', rawMessage);

          const message = JSON.parse(rawMessage);
          message.eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          console.log('[PARSED EVENT] ID:', message.eventId);

          if (isDuplicateNotification(message)) {
            return;
          }
          
          console.log('[ADDING TO RECENT ACTIVITY] Event passed filters');
          if (mainWindow) mainWindow.webContents.send('ws-event', message);
          
          console.log('[OVERLAY PIPELINE] Passing event to overlay');
          sendToOverlayInternal(message);
        } catch (e) {
          console.error('[OVERLAY ERROR] Failed to parse WS message:', e);
        }
      });

      ws.on('close', () => {
        console.log('CLIENT DISCONNECTED FROM WS SERVER');
        if (mainWindow) mainWindow.webContents.send('ws-status', 'disconnected');
      });
    });

    wss.on('error', (err) => {
      console.error('WS SERVER ERROR:', err);
      if (mainWindow) mainWindow.webContents.send('ws-error', err.message);
    });

    console.log(`WS Server started on port ${WS_PORT}`);
  } catch (error) {
    console.error('Failed to start WS server:', error);
  }
}

app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();
  setupTray();
  pairingCode = generatePairingCode();
  startWebSocketServer();
  startUdpBroadcast();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray
  }
});

// IPC handlers
ipcMain.handle('get-ip', () => getLocalIP());
ipcMain.handle('get-ws-url', () => `ws://${getLocalIP()}:${WS_PORT}`);
ipcMain.handle('get-pairing-code', () => pairingCode);

ipcMain.handle('select-audio-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
    ]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.on('send-test-notification', (event, data) => {
  console.log('[TEST EVENT REQUESTED]');
  sendToOverlayInternal({ ...data, isTest: true });
});

ipcMain.on('set-overlay-ignore-mouse', (event, ignore) => {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.on('update-overlay-position', (event, position) => {
  if (!overlayWindow) return;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const overlayWidth = 400;
  const overlayHeight = height;

  let x = width - overlayWidth;
  let y = 0;

  switch(position) {
    case 'top-right': x = width - overlayWidth; y = 0; break;
    case 'top-left': x = 0; y = 0; break;
    case 'bottom-right': x = width - overlayWidth; y = height - overlayHeight; break;
    case 'bottom-left': x = 0; y = height - overlayHeight; break;
  }

  overlayWindow.setBounds({ x, y, width: overlayWidth, height: overlayHeight });
});
