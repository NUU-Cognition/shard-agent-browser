#!/usr/bin/env node
// flint shard ab profiles
// Show managed profiles, real Chrome profiles, active warm sessions, and dashboard status.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const ROOT = process.env.FLINT_ROOT || process.cwd();
const CFG_PATH = path.join(ROOT, 'Shards', '(Shards) Local State', 'ab-profile-config.md');
const PROFILES_DIR = path.join(os.homedir(), '.agent-browser', 'profiles');

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
function ab(args) { const r = spawnSync('agent-browser', args, { encoding: 'utf8' }); return (r.stdout || '') + (r.stderr || ''); }
function listSessions() {
  return ab(['session', 'list'])
    .replace(/^Active sessions:?\s*/i, '')
    .split('\n').map(s => s.trim())
    .filter(s => s && !/^no /i.test(s));
}
function dirSize(dir) {
  if (process.platform === 'win32') return '';
  const out = spawnSync('du', ['-sh', dir], { encoding: 'utf8' }).stdout || '';
  return (out.split('\t')[0] || '').trim();
}
function dashboard() {
  return new Promise((resolve) => {
    const req = http.get({ host: 'localhost', port: 4848, path: '/api/sessions', timeout: 1200 }, (res) => {
      let body = ''; res.on('data', d => body += d); res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve(null)); req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

(async () => {
  const cfg = readConfig();
  console.log('Agent Browser — profiles & sessions\n');

  const cfgState = fs.existsSync(CFG_PATH) ? CFG_PATH : '(missing — run the shard setup: flint shard setup ab)';
  console.log(`Default mode: ${cfg['ab-default-mode'] || '(unset)'}  · headed: ${cfg['ab-headed'] || 'true'}`);
  console.log(`Config: ${cfgState}`);

  console.log('\nManaged profiles (dirs under ~/.agent-browser/profiles):');
  try {
    const dirs = fs.readdirSync(PROFILES_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
    if (!dirs.length) console.log('  (none yet)');
    const cloneName = path.basename(cfg['ab-real-clone-path'] || 'real-clone');
    for (const d of dirs) {
      const full = path.join(PROFILES_DIR, d.name);
      const isClone = d.name === cloneName || /clone/i.test(d.name);
      const size = dirSize(full);
      console.log(`  - ${d.name}${size ? `  (${size})` : ''}${isClone ? '  [real-profile clone — real logins, sensitive]' : '  [managed]'}`);
    }
  } catch { console.log('  (none yet)'); }

  console.log('\nReal Chrome profiles on this machine:');
  const rc = ab(['profiles', '--json']);
  try {
    const arr = JSON.parse(rc).data || [];
    if (!arr.length) console.log('  (none found)');
    for (const p of arr) console.log(`  - ${p.directory}  (${p.name})`);
  } catch { console.log('  ' + rc.trim().split('\n').slice(0, 4).join('\n  ')); }

  console.log('\nActive warm sessions:');
  const sessions = listSessions();
  console.log(sessions.length ? sessions.map(s => `  - ${s}`).join('\n') : '  (none)');

  const dash = await dashboard();
  console.log('\nDashboard (http://localhost:4848):');
  if (dash === null) console.log('  not running — start with: flint shard ab dashboard start');
  else {
    try { const s = JSON.parse(dash); console.log(`  running — ${s.length} session(s): ${s.map(x => x.session).join(', ') || '(none)'}`); }
    catch { console.log('  running'); }
  }
})();
