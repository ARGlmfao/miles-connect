const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getIP: () => ipcRenderer.invoke('get-ip'),
  getWSUrl: () => ipcRenderer.invoke('get-ws-url'),
  getPairingCode: () => ipcRenderer.invoke('get-pairing-code'),
  onWSStatus: (callback) => {
    const subscription = (_event, status) => callback(status);
    ipcRenderer.on('ws-status', subscription);
    return () => ipcRenderer.removeListener('ws-status', subscription);
  },
  onWSError: (callback) => {
    const subscription = (_event, error) => callback(error);
    ipcRenderer.on('ws-error', subscription);
    return () => ipcRenderer.removeListener('ws-error', subscription);
  },
  onWSEvent: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('ws-event', subscription);
    return () => ipcRenderer.removeListener('ws-event', subscription);
  },
  onToggleGamingMode: (callback) => {
    const subscription = (_event, enabled) => callback(enabled);
    ipcRenderer.on('toggle-gaming-mode', subscription);
    return () => ipcRenderer.removeListener('toggle-gaming-mode', subscription);
  },
  sendTestNotification: (data) => ipcRenderer.send('send-test-notification', data),
  setOverlayIgnoreMouse: (ignore) => ipcRenderer.send('set-overlay-ignore-mouse', ignore),
  updateOverlayPosition: (position) => ipcRenderer.send('update-overlay-position', position),
  selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
});
