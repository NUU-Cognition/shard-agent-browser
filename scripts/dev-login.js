#!/usr/bin/env node
// flint shard ab login [mode] [url] [--name <s>] [--port <n>] [--clone <name|path>]
// Open a HEADED session you can sign into. State persists for saved/real modes.
//   saved  → managed profile, log in once, persists (mock keychain)
//   real   → your real-clone Chrome (real Keychain); already has your logins, use to add/refresh
//   throwaway → warns (nothing will persist)
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = process.env.FLINT_ROOT || process.cwd();
const CFG_PATH = path.join(ROOT, 'Shards', '(Shards) Local State', 'ab-profile-config.md');

function readConfig() {
  const cfg = {};
  try {
    const m = fs.readFileSync(CFG_PATH, 'utf8').match(/^---\n([\s\S]*?)\n---/);
    if (m) for (const line of m[1].split('\n')) { const mm = line.match(/^([\w-]+):\s*(.*)$/); if (mm) cfg[mm[1]] = mm[2].trim(); }
  } catch {}
  return cfg;
}

const cfg = readConfig();
const argv = process.argv.slice(2);
const flags = {}; const pos = [];
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a === '--name') flags.name = argv[++i]; else if (a === '--port') flags.port = argv[++i]; else if (a === '--clone') flags.clone = argv[++i]; else pos.push(a); }
const mode = (pos[0] || cfg['ab-default-mode'] || 'saved').toLowerCase();
const url = pos[1] || 'about:blank';

if (mode === 'throwaway') {
  console.error('⚠ throwaway mode does not persist logins — use "saved" or "real". Aborting.');
  process.exit(1);
}

// Delegate to the open script in HEADED + FRESH mode so the headed window definitely appears.
const openJs = path.join(process.env.FLINT_SHARD || path.join(ROOT, 'Shards', 'Agent Browser'), 'scripts', 'open.js');
const openDev = path.join(ROOT, 'Shards', '(Dev Local) Agent Browser', 'scripts', 'dev-open.js');
const script = fs.existsSync(openJs) ? openJs : openDev;
const args = [script, mode, url, '--headed', '--fresh'];
if (flags.name) args.push('--name', flags.name);
if (flags.port) args.push('--port', flags.port);
if (flags.clone) args.push('--clone', flags.clone);
const r = spawnSync('node', args, { encoding: 'utf8' });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');

console.log('\n→ A headed window is open. Sign into your site(s) now.');
if (mode === 'saved') console.log('  Your logins persist in the managed profile for future runs.');
if (mode === 'real') console.log('  This is your real-clone (real OS keystore). New logins persist in the clone (not your real Chrome).');
console.log('  When done you can leave it warm, or close it:  flint shard ab stop ' + (flags.name || mode));
