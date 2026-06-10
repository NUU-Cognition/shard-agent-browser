#!/usr/bin/env node
// flint shard ab clone [--name <dst>] [--source <ChromeProfileDir>]
// Clone your real Chrome profile (Local State key + profile data, minus caches) into a managed
// dir so a directly-launched Chrome (real OS keystore) inherits your existing logins. For a perfect
// copy, fully quit Chrome first (a live cookie DB may miss the newest entries).
// Chrome root comes from ab-chrome-root in Local State config, else the platform default.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = process.env.FLINT_ROOT || process.cwd();
const CFG_PATH = path.join(ROOT, 'Shards', '(Shards) Local State', 'ab-profile-config.md');
const PROFILES_DIR = path.join(os.homedir(), '.agent-browser', 'profiles');

function expand(p) { return p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p; }
function readConfig() {
  const cfg = {};
  try {
    const m = fs.readFileSync(CFG_PATH, 'utf8').match(/^---\n([\s\S]*?)\n---/);
    if (m) for (const line of m[1].split('\n')) { const mm = line.match(/^([\w-]+):\s*(.*)$/); if (mm) cfg[mm[1]] = mm[2].trim(); }
  } catch {}
  return cfg;
}
function platformChromeRoot() {
  const home = os.homedir();
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome');
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Google', 'Chrome', 'User Data');
  return path.join(home, '.config', 'google-chrome');
}
function chromeRunning() {
  if (process.platform === 'win32') {
    const r = spawnSync('tasklist', ['/FI', 'IMAGENAME eq chrome.exe', '/NH'], { encoding: 'utf8' });
    return /chrome\.exe/i.test(r.stdout || '');
  }
  const name = process.platform === 'darwin' ? 'Google Chrome' : 'chrome';
  return spawnSync('pgrep', ['-x', name], { encoding: 'utf8' }).status === 0;
}
const CLONE_EXCLUDES = ['Cache', 'Code Cache', 'GPUCache', 'Service Worker/CacheStorage', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GrShaderCache', 'component_crx_cache'];
function copyProfileDir(src, dst) {
  if (process.platform === 'win32') {
    // robocopy mirrors src → dst; exit codes 0–7 mean success
    const args = [src, dst, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/XD', ...CLONE_EXCLUDES.map(e => path.join(src, e))];
    const r = spawnSync('robocopy', args, { encoding: 'utf8' });
    return { ok: r.status !== null && r.status <= 7, err: r.stderr };
  }
  const args = ['-a', '--delete'];
  for (const e of CLONE_EXCLUDES) args.push('--exclude', e);
  args.push(src + '/', dst + '/');
  const r = spawnSync('rsync', args, { encoding: 'utf8' });
  return { ok: r.status === 0, err: r.stderr };
}
function dirSize(dir) {
  if (process.platform === 'win32') return '';
  const out = spawnSync('du', ['-sh', dir], { encoding: 'utf8' }).stdout || '';
  return (out.split('\t')[0] || '').trim();
}

const cfg = readConfig();
const argv = process.argv.slice(2);
const flags = {};
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--name') flags.name = argv[++i]; else if (argv[i] === '--source') flags.source = argv[++i]; }
const dstName = flags.name || 'real-clone';
const srcProfile = flags.source || 'Default';
const dst = path.join(PROFILES_DIR, dstName);
const chromeRoot = expand(cfg['ab-chrome-root']) || platformChromeRoot();

if (chromeRunning()) console.log('⚠ Chrome is running — the clone may miss the newest cookies. For a perfect copy, quit Chrome first.');

if (!fs.existsSync(path.join(chromeRoot, 'Local State'))) {
  console.error(`Could not find a Chrome profile root at ${chromeRoot}\n  Set ab-chrome-root in Shards/(Shards) Local State/ab-profile-config.md if Chrome lives elsewhere.`);
  process.exit(1);
}
if (!fs.existsSync(path.join(chromeRoot, srcProfile))) {
  console.error(`Source profile "${srcProfile}" not found under ${chromeRoot}`);
  const dirs = fs.readdirSync(chromeRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && (d.name === 'Default' || /^Profile /.test(d.name))).map(d => d.name);
  if (dirs.length) console.error(`  Available profiles: ${dirs.join(', ')}`);
  process.exit(1);
}

fs.mkdirSync(dst, { recursive: true });
fs.copyFileSync(path.join(chromeRoot, 'Local State'), path.join(dst, 'Local State'));
// copy the source profile dir AS "Default" inside dst (real launch uses --profile-directory=Default)
const r = copyProfileDir(path.join(chromeRoot, srcProfile), path.join(dst, 'Default'));
if (!r.ok) { console.error('profile copy failed: ' + (r.err || '')); process.exit(1); }

const size = dirSize(dst);
console.log(`✓ cloned ${srcProfile} → ${dst}${size ? `  (${size})` : ''}`);
console.log(`  Launch it with:  flint shard ab open real${flags.name ? ` --clone ${dstName}` : ''}  (attaches over CDP with the real OS keystore)`);
console.log(`  ⚠ contains a copy of your real cookies/logins — remove with:  rm -rf "${dst}"`);
