const { contextBridge, ipcRenderer } = require('electron');
const versionArgument = process.argv.find(arg => arg.startsWith('--palamedes-version='));
const version = versionArgument ? versionArgument.slice('--palamedes-version='.length) : 'unknown';

// No filesystem, shell, raw IPC, environment, or credential access crosses this bridge.
contextBridge.exposeInMainWorld('palamedesDesktop', Object.freeze({
  version,
  checkForUpdates: () => ipcRenderer.invoke('palamedes:check-updates'),
  minimize: () => ipcRenderer.send('palamedes:minimize'),
  close: () => ipcRenderer.send('palamedes:close'),
}));
