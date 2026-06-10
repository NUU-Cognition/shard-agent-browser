#!/usr/bin/env node
// flint shard ab open [mode] [url] [--name <s>] [--headless] [--port <n>] [--fresh] [--clone <name|path>]
// Open (or reattach to) a warm agent-browser session in one of three modes:
//   saved      persistent managed profile (mock keychain), agent-launched
//   throwaway  ephemeral managed profile (nothing saved), agent-launched
//   real       clone of your Default launched as REAL Chrome (real OS keystore), agent attaches over CDP
'use strict';
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const ROOT = process.env.FLINT_ROOT || process.cwd();
const CFG_PATH = path.join(ROOT, 'Shards', '(Shards) Local State', 'ab-profile-config.md');
const PROFILES_DIR = path.join(os.homedir(), '.agent-browser', 'profiles');

// --- platform defaults (overridable via ab-chrome-bin / ab-chrome-root in Local State) ---
function platformDefaults() {
  const home = os.homedir();
  if (process.platform === 'darwin') return {
    chromeBins: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    chromeRoot: path.join(home, 'Library', 'Application Support', 'Google', 'Chrome'),
  };
  if (process.platform === 'win32') return {
    chromeBins: [
      path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ],
    chromeRoot: path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Google', 'Chrome', 'User Data'),
  };
  return { // linux & friends
    chromeBins: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
    chromeRoot: path.join(home, '.config', 'google-chrome'),
  };
}
function defaultChromeBin() {
  const d = platformDefaults();
  return d.chromeBins.find(b => b && fs.existsSync(b)) || d.chromeBins[0];
}

function expand(p) { return p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p; }
function readConfig() {
  const cfg = {};
  try {
    const m = fs.readFileSync(CFG_PATH, 'utf8').match(/^---\n([\s\S]*?)\n---/);
    if (m) for (const line of m[1].split('\n')) {
      const mm = line.match(/^([\w-]+):\s*(.*)$/);
      if (mm) cfg[mm[1]] = mm[2].trim();
    }
  } catch {}
  return cfg;
}
function ab(args, { capture = true } = {}) {
  const r = spawnSync('agent-browser', args, { encoding: 'utf8' });
  if (capture) return (r.stdout || '') + (r.stderr || '');
  return r.status;
}
function listSessions() {
  return ab(['session', 'list'])
    .replace(/^Active sessions:?\s*/i, '')
    .split('\n').map(s => s.trim())
    .filter(s => s && !/^no /i.test(s));
}
function cdpUp(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/json/version', timeout: 1500 }, (res) => {
      res.resume(); resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}
async function waitCdp(port, secs = 20) {
  for (let i = 0; i < secs; i++) { if (await cdpUp(port)) return true; await new Promise(r => setTimeout(r, 1000)); }
  return false;
}

// --- clone Default into a managed dir (Local State key + Default data, minus caches) ---
const CLONE_EXCLUDES = ['Cache', 'Code Cache', 'GPUCache', 'Service Worker/CacheStorage', 'DawnGraphiteCache',
  'DawnWebGPUCache', 'GrShaderCache', 'component_crx_cache'];
function copyProfileDir(src, dst) {
  if (process.platform === 'win32') {
    // robocopy mirrors src → dst; /XD excludes dirs; exit codes 0–7 mean success
    const args = [src, dst, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/XD', ...CLONE_EXCLUDES.map(e => path.join(src, e))];
    const r = spawnSync('robocopy', args, { stdio: 'ignore' });
    return r.status !== null && r.status <= 7;
  }
  const args = ['-a', '--delete'];
  for (const e of CLONE_EXCLUDES) args.push('--exclude', e);
  args.push(src + '/', dst + '/');
  return spawnSync('rsync', args, { stdio: 'ignore' }).status === 0;
}
function ensureClone(dst, chromeRoot) {
  if (fs.existsSync(path.join(dst, 'Local State')) && fs.existsSync(path.join(dst, 'Default'))) return false; // already cloned
  fs.mkdirSync(dst, { recursive: true });
  fs.copyFileSync(path.join(chromeRoot, 'Local State'), path.join(dst, 'Local State'));
  copyProfileDir(path.join(chromeRoot, 'Default'), path.join(dst, 'Default'));
  return true;
}

(async () => {
  const cfg = readConfig();
  const argv = process.argv.slice(2);
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--headless') flags.headless = true;
    else if (a === '--headed') flags.headed = true;
    else if (a === '--fresh') flags.fresh = true;
    else if (a === '--name') flags.name = argv[++i];
    else if (a === '--port') flags.port = argv[++i];
    else if (a === '--clone') flags.clone = argv[++i];
    else pos.push(a);
  }
  const mode = (pos[0] || cfg['ab-default-mode'] || 'saved').toLowerCase();
  const url = pos[1] || 'about:blank';
  const session = flags.name || mode;
  // headed by default for these helpers (you usually want to see it); config/flags can override
  const headed = flags.headless ? false : (flags.headed ? true : (cfg['ab-headed'] === 'false' ? false : true));
  const port = parseInt(flags.port || cfg['ab-cdp-port'] || '9222', 10);
  const chromeRoot = expand(cfg['ab-chrome-root']) || platformDefaults().chromeRoot;
  const chromeBin = expand(cfg['ab-chrome-bin']) || defaultChromeBin();

  if (!['saved', 'throwaway', 'real'].includes(mode)) {
    console.error(`Unknown mode "${mode}". Use: saved | throwaway | real`); process.exit(1);
  }

  // If the session is already warm and not --fresh, just navigate (reuse). Daemon caches launch
  // options, so changing headed/profile requires --fresh (close + relaunch).
  if (listSessions().includes(session) && !flags.fresh) {
    if (url !== 'about:blank') ab(['--session', session, 'open', url]);
    console.log(`↻ reused warm session "${session}" (${mode}) → ${ab(['--session', session, 'get', 'url']).trim()}`);
    console.log(`  (use --fresh to relaunch with new options)`);
    return;
  }
  if (flags.fresh) ab(['--session', session, 'close']);

  if (mode === 'real') {
    // --clone <name|path> targets an alternate clone (made with: flint shard ab clone --name <name>)
    const dst = flags.clone
      ? (flags.clone.includes(path.sep) || flags.clone.startsWith('~') ? expand(flags.clone) : path.join(PROFILES_DIR, flags.clone))
      : (expand(cfg['ab-real-clone-path']) || path.join(PROFILES_DIR, 'real-clone'));
    if (!(await cdpUp(port))) {
      if (!fs.existsSync(path.join(chromeRoot, 'Local State'))) {
        console.error(`Chrome profile root not found at ${chromeRoot} — set ab-chrome-root in Local State config.`); process.exit(1);
      }
      const cloned = ensureClone(dst, chromeRoot);
      console.log(cloned ? `cloned Default → ${dst}` : `reusing clone at ${dst}`);
      spawn(chromeBin, ['--user-data-dir=' + dst, '--profile-directory=Default',
        '--remote-debugging-port=' + port, '--no-first-run', '--no-default-browser-check', 'about:blank'],
        { detached: true, stdio: 'ignore' }).unref();
      if (!(await waitCdp(port))) { console.error(`real Chrome CDP did not open on :${port}`); process.exit(1); }
    } else {
      console.log(`real Chrome already serving CDP on :${port}`);
    }
    ab(['--session', session, 'connect', String(port)]);
    if (url !== 'about:blank') ab(['--session', session, 'open', url]);
    console.log(`✓ real session "${session}" attached (real OS keystore, clone: ${dst}) → ${ab(['--session', session, 'get', 'url']).trim()}`);
    return;
  }

  // saved / throwaway → agent-browser launches
  const args = ['--session', session];
  let profileDir = null;
  if (mode === 'saved') {
    // --name gets its own profile dir so distinct identities never share state;
    // the default saved session uses ab-saved-path from Local State.
    profileDir = flags.name
      ? path.join(PROFILES_DIR, session)
      : (expand(cfg['ab-saved-path']) || path.join(PROFILES_DIR, session));
    fs.mkdirSync(profileDir, { recursive: true });
    args.push('--profile', profileDir);
  }
  if (headed) args.push('--headed');
  args.push('open', url);
  ab(args);
  const where = profileDir ? `, profile ${profileDir}` : '';
  console.log(`✓ ${mode} session "${session}" open (${headed ? 'headed' : 'headless'}${where}) → ${ab(['--session', session, 'get', 'url']).trim()}`);
})();
