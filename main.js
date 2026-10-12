// FROSTFALL: лаунчер. Показывает меню, проверяет обновления игры на GitHub и запускает игру.
'use strict';
const { app, BrowserWindow, ipcMain, net, session, shell } = require('electron');
const path = require('path'), fs = require('fs'), vm = require('vm');

const RAW = 'https://raw.githubusercontent.com/rewtoo20-cmyk/frostfall/main/';
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');
const USER_GAME = () => path.join(app.getPath('userData'), 'game');
const BUNDLED = path.join(__dirname, 'game');
const DEFAULTS = { fullscreen: false, lowpower: false, nogpu: false, autoupdate: true };

// ---------- настройки ----------
function loadSettings() { try { const d = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')); const s = Object.assign({}, DEFAULTS); for (const k in DEFAULTS) if (typeof d[k] === 'boolean') s[k] = d[k]; return s; } catch (e) { return Object.assign({}, DEFAULTS); } }
function saveSettings(s) { try { fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true }); fs.writeFileSync(SETTINGS_FILE() + '.tmp', JSON.stringify(s)); fs.renameSync(SETTINGS_FILE() + '.tmp', SETTINGS_FILE()); } catch (e) {} }
let settings = DEFAULTS;
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
settings = loadSettings();
if (settings.nogpu) app.disableHardwareAcceleration();

// ---------- версии игры ----------
const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; } return 0; };
const readVer = (dir) => { try { const v = JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf8')); if (/^\d+\.\d+\.\d+$/.test(v.version) && fs.existsSync(path.join(dir, 'index.html'))) return v; } catch (e) {} return null; };
function pickGame() { const u = readVer(USER_GAME()), b = readVer(BUNDLED) || { version: '0.0.0', notes: [] }; return u && cmp(u.version, b.version) > 0 ? { dir: USER_GAME(), ver: u } : { dir: BUNDLED, ver: b }; }

// ---------- обновление ----------
let upd = { state: 'idle', text: '', progress: 0 };
const setUpd = (s) => { upd = Object.assign({}, upd, s); if (win && !win.isDestroyed()) win.webContents.send('upd', upd); };
async function getText(url, ms) { const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms || 15000); try { const r = await net.fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { signal: ac.signal, cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); } finally { clearTimeout(t); } }
let busy = false;
async function checkUpdate(manual) {
  if (busy) return; busy = true;
  try {
    setUpd({ state: 'check', text: 'Проверяю обновления…', progress: 0 });
    const remote = JSON.parse(await getText(RAW + 'version.json', 10000)), cur = pickGame().ver;
    if (!remote || !/^\d+\.\d+\.\d+$/.test(remote.version) || !Array.isArray(remote.files) || remote.files.length > 40 || !remote.files.includes('index.html')) throw new Error('bad manifest');
    if (cmp(remote.version, cur.version) <= 0) { setUpd({ state: 'ok', text: 'У тебя последняя версия ' + cur.version, progress: 1 }); return; }
    const tmp = USER_GAME() + '.tmp'; fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    let i = 0;
    for (const name of remote.files) {
      if (!/^[A-Za-z0-9_.-]{1,40}$/.test(name) || !/\.(js|html|json)$/.test(name)) throw new Error('bad file name');
      setUpd({ state: 'load', text: 'Скачиваю ' + name + '…', progress: i / remote.files.length });
      const body = await getText(RAW + name, 30000);
      if (!body || body.length > 3e6) throw new Error('bad file ' + name);
      if (name.endsWith('.js')) new vm.Script(body, { filename: name }); // проверка, что код целый
      fs.writeFileSync(path.join(tmp, name), body); i++;
    }
    fs.writeFileSync(path.join(tmp, 'version.json'), JSON.stringify({ version: remote.version, files: remote.files, notes: Array.isArray(remote.notes) ? remote.notes.slice(0, 8).map((x) => String(x).slice(0, 80)) : [] }));
    if (!fs.existsSync(path.join(tmp, 'index.html'))) throw new Error('no index');
    fs.rmSync(USER_GAME(), { recursive: true, force: true }); fs.renameSync(tmp, USER_GAME());
    setUpd({ state: 'ok', text: 'Обновлено до версии ' + remote.version, progress: 1 });
  } catch (e) {
    setUpd({ state: 'err', text: manual ? 'Не удалось проверить обновления (нет интернета?)' : 'Играем без обновления', progress: 0 });
  } finally { busy = false; }
}

// ---------- окна ----------
let win = null, gameWin = null;
const ICON = path.join(__dirname, 'build', 'icon.png');
function hardenSession() { session.defaultSession.setPermissionRequestHandler((wc, p, cb) => cb(false)); }
function createLauncher() {
  win = new BrowserWindow({ width: 768, height: 432, resizable: false, frame: false, show: false, backgroundColor: '#0b1020', icon: ICON, title: 'FROSTFALL',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: false } });
  win.setMenu(null); win.loadFile(path.join(__dirname, 'ui', 'index.html'));
  win.once('ready-to-show', () => { win.show(); if (settings.autoupdate) checkUpdate(false); });
  win.webContents.on('will-navigate', (e) => e.preventDefault()); win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('closed', () => { win = null; if (!gameWin) app.quit(); });
}
function openGame() {
  if (gameWin) { gameWin.focus(); return; }
  const g = pickGame();
  gameWin = new BrowserWindow({ width: 1152, height: 648, minWidth: 768, minHeight: 432, backgroundColor: '#0b1020', icon: ICON, title: 'FROSTFALL', show: false, fullscreen: settings.fullscreen, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: false, spellcheck: false } });
  gameWin.setMenu(null);
  gameWin.loadFile(path.join(g.dir, 'index.html'), { search: settings.lowpower ? 'light=1' : '' });
  gameWin.once('ready-to-show', () => { gameWin.show(); if (win) win.hide(); });
  gameWin.webContents.on('will-navigate', (e) => e.preventDefault()); gameWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  gameWin.webContents.on('before-input-event', (e, input) => { if (input.type === 'keyDown' && input.key === 'F11') { gameWin.setFullScreen(!gameWin.isFullScreen()); e.preventDefault(); } });
  gameWin.webContents.on('render-process-gone', (e, d) => { if (d && d.reason === 'clean-exit') return; try { fs.writeFileSync(path.join(app.getPath('userData'), 'crash.flag'), '1'); } catch (e) {} });
  gameWin.on('closed', () => { gameWin = null; if (win) { win.show(); win.focus(); } else app.quit(); });
}

// ---------- связь с интерфейсом лаунчера ----------
const ok = (e) => win && e.sender === win.webContents;
ipcMain.handle('state', (e) => { if (!ok(e)) return null; const g = pickGame(); return { game: g.ver.version, notes: g.ver.notes || [], launcher: app.getVersion(), settings, upd }; });
ipcMain.handle('play', (e) => { if (ok(e)) openGame(); });
ipcMain.handle('update', (e) => { if (ok(e)) checkUpdate(true); });
ipcMain.handle('set', (e, k, v) => { if (!ok(e) || !(k in DEFAULTS) || typeof v !== 'boolean') return settings; settings = Object.assign({}, settings, { [k]: v }); saveSettings(settings); return settings; });
ipcMain.handle('min', (e) => { if (ok(e)) win.minimize(); });
ipcMain.handle('close', (e) => { if (ok(e)) app.quit(); });
ipcMain.handle('restart', (e) => { if (ok(e)) { app.relaunch(); app.quit(); } });

app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
app.whenReady().then(() => {
  hardenSession();
  try { if (fs.existsSync(path.join(app.getPath('userData'), 'crash.flag'))) { fs.rmSync(path.join(app.getPath('userData'), 'crash.flag')); if (!settings.nogpu) { settings.nogpu = true; saveSettings(settings); app.relaunch(); app.quit(); return; } } } catch (e) {}
  createLauncher();
});
app.on('window-all-closed', () => app.quit());
