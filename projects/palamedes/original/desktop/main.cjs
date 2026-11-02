const { app, BrowserWindow, dialog, ipcMain, shell, session } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { DAY_MS, shouldCheck, initialState, transition, isTrustedExternalUrl, resolveAssetPath } = require('./update-policy.cjs');

app.setName('Palamedes');
const launchedForCheck = process.argv.includes('--check-updates');
let mainWindow, server, origin, updater;
let updateState = initialState(), checking = false, quitting = false;
let availableInfo = null, lastAttemptAt = null, dailyTimer;

function trustedSender(event) {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame && event.senderFrame.url.startsWith(`${origin}/`));
}
function showWindow() { if (mainWindow && !mainWindow.isDestroyed()) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } }
function openExternal(url) { if (isTrustedExternalUrl(url)) shell.openExternal(url).catch(() => {}); }

async function startServer() {
  const root = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('The app build is missing. Run npm run build before starting the desktop app.');
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.map': 'application/json' };
  server = http.createServer(async (req, res) => {
    if (!origin || !['GET', 'HEAD'].includes(req.method) || req.headers.host !== new URL(origin).host) { res.writeHead(403); res.end(); return; }
    const target = resolveAssetPath(root, req.url || '/');
    if (!target) { res.writeHead(403); res.end(); return; }
    try {
      const stat = await fsp.stat(target);
      if (!stat.isFile()) throw new Error('Not a file');
      res.setHeader('Content-Type', mime[path.extname(target).toLowerCase()] || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net https://tessdata.projectnaptha.com; worker-src 'self' blob:; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'");
      res.setHeader('Content-Length', stat.size);
      res.writeHead(200);
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(target).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  // Keep the origin stable so browser-local workspaces survive app restarts.
  const originFile = path.join(app.getPath('userData'), 'desktop-origin.json');
  let savedPort = 0;
  try { const saved = JSON.parse(await fsp.readFile(originFile, 'utf8')); if (Number.isInteger(saved.port) && saved.port >= 1024 && saved.port <= 65535) savedPort = saved.port; } catch {}
  await new Promise((resolve, reject) => { server.once('error', error => reject(new Error(`Could not open Palamedes' local app port${savedPort ? ` ${savedPort}` : ''}: ${error.message}`))); server.listen(savedPort, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  await fsp.mkdir(app.getPath('userData'), { recursive: true });
  await fsp.writeFile(originFile, JSON.stringify({ port: server.address().port }), 'utf8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Palamedes', width: 1440, height: 980, minWidth: 900, minHeight: 650,
    show: false, backgroundColor: '#10131a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true,
      nodeIntegration: false, nodeIntegrationInWorker: false, webSecurity: true,
      allowRunningInsecureContent: false, spellcheck: false,
      additionalArguments: [`--palamedes-version=${app.getVersion()}`],
    },
  });
  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => { try { if (new URL(url).origin === origin) return; } catch {} event.preventDefault(); openExternal(url); });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.on('closed', () => { mainWindow = null; if (updateState.status !== 'installing') updateState = transition(updateState, 'cancel'); });
  mainWindow.once('ready-to-show', () => { if (!launchedForCheck) mainWindow.show(); });
  return mainWindow.loadURL(`${origin}/`);
}

function stateFile() { return path.join(app.getPath('userData'), 'update-state.json'); }
async function loadAttempt() { try { const saved = JSON.parse(await fsp.readFile(stateFile(), 'utf8')); lastAttemptAt = Number.isFinite(saved.lastAttemptAt) ? saved.lastAttemptAt : null; } catch { lastAttemptAt = null; } }
async function recordAttempt(now) {
  lastAttemptAt = now;
  await fsp.mkdir(app.getPath('userData'), { recursive: true });
  const temporary = `${stateFile()}.tmp`;
  await fsp.writeFile(temporary, JSON.stringify({ lastAttemptAt: now, version: app.getVersion() }), 'utf8');
  await fsp.rename(temporary, stateFile());
}

function setupUpdater() {
  ({ autoUpdater: updater } = require('electron-updater'));
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  if ('autoInstallEvent' in updater) updater.autoInstallEvent = 'manual';
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.setFeedURL({ provider: 'github', owner: 'example', repo: 'Palamedes', private: false });
  updater.on('update-available', info => { availableInfo = info; });
  updater.on('update-not-available', () => { availableInfo = null; });
  updater.on('error', () => { if (updateState.status !== 'installing') updateState = transition(updateState, 'error'); });
  updater.on('download-progress', progress => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle(`Palamedes — downloading update ${Math.round(progress.percent)}%`); });
}

async function checkForUpdates({ manual = false, quiet = true } = {}) {
  if (checking) return { status: 'busy', message: 'An update check or download is already running.' };
  if (!app.isPackaged) return { status: 'development', message: 'Updates are available in an installed release build. Development builds do not update themselves.' };
  if (!updater) return { status: 'starting', message: 'Palamedes is still starting. Try checking again in a moment.' };
  const now = Date.now();
  if (!shouldCheck(lastAttemptAt, now, manual)) return { status: 'skipped', message: 'An automatic check was already attempted within the last 24 hours.' };
  checking = true; availableInfo = null;
  updateState = transition(updateState, 'check');
  try {
    await recordAttempt(now);
    await updater.checkForUpdates();
    if (quitting) return { status: 'cancelled', message: 'The app is closing. No update will be installed.' };
    if (!availableInfo) {
      updateState = transition(updateState, 'not-available');
      return { status: 'up-to-date', message: `Palamedes ${app.getVersion()} is up to date.` };
    }
    updateState = transition(updateState, 'available');
    showWindow();
    const answer = await dialog.showMessageBox(mainWindow, {
      type: 'question', title: 'Palamedes update available',
      message: `Palamedes ${availableInfo.version} is available.`,
      detail: 'Download and install this release, then restart Palamedes? Save or export any work first. Nothing will be downloaded or installed if you choose Not now or close this dialog.',
      buttons: ['Download, install & restart', 'Not now'], defaultId: 1, cancelId: 1, noLink: true,
    });
    if (answer.response !== 0 || quitting || !mainWindow || mainWindow.isDestroyed()) {
      updateState = transition(updateState, 'reject');
      return { status: 'deferred', message: 'Update deferred. No download or installation was approved.' };
    }
    updateState = transition(updateState, 'approve');
    await updater.downloadUpdate();
    if (quitting || !mainWindow || mainWindow.isDestroyed() || !updateState.approved || updateState.status !== 'downloading') {
      updateState = transition(updateState, 'cancel');
      return { status: 'cancelled', message: 'Update installation cancelled.' };
    }
    updateState = transition(updateState, 'downloaded');
    updateState = transition(updateState, 'install');
    // This is the sole install call, guarded by this process's explicit dialog approval.
    updater.quitAndInstall(false, true);
    return { status: 'installing', message: 'Installing the approved update and restarting Palamedes.' };
  } catch (error) {
    updateState = transition(updateState, 'error');
    const message = 'Could not check or apply the update. A published GitHub release must include its installer, latest.yml, and blockmap. Your current installation remains usable. Try again later.';
    if (!quiet && !quitting && mainWindow && !mainWindow.isDestroyed()) await dialog.showMessageBox(mainWindow, { type: 'info', title: 'Palamedes updates', message, detail: String(error?.message || error).slice(0, 500), buttons: ['OK'] });
    return { status: 'error', message };
  } finally {
    checking = false;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle('Palamedes');
  }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.setAppUserModelId('io.github.example.palamedes');
  app.on('second-instance', (_event, argv) => { if (argv.includes('--check-updates')) checkForUpdates({ quiet: true }); else showWindow(); });
  app.on('before-quit', () => { quitting = true; if (updateState.status !== 'installing') updateState = transition(updateState, 'cancel'); clearInterval(dailyTimer); });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => { server?.close(); });
  ipcMain.handle('palamedes:check-updates', event => { if (!trustedSender(event)) throw new Error('Untrusted update request.'); return checkForUpdates({ manual: true, quiet: false }); });
  ipcMain.on('palamedes:minimize', event => { if (trustedSender(event)) mainWindow.minimize(); });
  ipcMain.on('palamedes:close', event => { if (trustedSender(event)) mainWindow.close(); });
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(Boolean(mainWindow && contents === mainWindow.webContents && permission === 'clipboard-sanitized-write')));
    session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) => permission === 'clipboard-sanitized-write' && requestingOrigin === origin);
    await startServer();
    await createWindow();
    await loadAttempt(); setupUpdater();
    const result = await checkForUpdates({ quiet: true });
    if (launchedForCheck && !['installing'].includes(result.status)) { app.quit(); return; }
    dailyTimer = setInterval(() => { checkForUpdates({ quiet: true }); }, Math.min(DAY_MS, 60 * 60 * 1000));
    dailyTimer.unref();
  }).catch(error => { dialog.showErrorBox('Palamedes could not start', String(error?.message || error)); app.quit(); });
}
