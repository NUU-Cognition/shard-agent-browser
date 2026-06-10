#!/usr/bin/env node
// flint shard ab dashboard [start|stop|status]
// Manage the agent-browser observability dashboard (http://localhost:4848), where every
// warm session shows up live.
'use strict';
const { spawnSync } = require('child_process');
const http = require('http');

function ab(args) { const r = spawnSync('agent-browser', ['dashboard', ...args], { encoding: 'utf8' }); return (r.stdout || '') + (r.stderr || ''); }
function status() {
  return new Promise((resolve) => {
    const req = http.get({ host: 'localhost', port: 4848, path: '/api/sessions', timeout: 1200 }, (res) => {
      let b = ''; res.on('data', d => b += d); res.on('end', () => resolve(b));
    });
    req.on('error', () => resolve(null)); req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

(async () => {
  const cmd = (process.argv[2] || 'status').toLowerCase();
  if (cmd === 'start') { console.log(ab(['start']).trim() || 'started'); console.log('  → http://localhost:4848'); return; }
  if (cmd === 'stop') { console.log(ab(['stop']).trim() || 'stopped'); return; }
  // status
  const s = await status();
  if (s === null) { console.log('Dashboard: not running.  Start with: flint shard ab dashboard start'); return; }
  try { const arr = JSON.parse(s); console.log(`Dashboard: running at http://localhost:4848  (${arr.length} session(s): ${arr.map(x => x.session).join(', ') || 'none'})`); }
  catch { console.log('Dashboard: running at http://localhost:4848'); }
})();
