#!/usr/bin/env node
// flint shard ab stop [name] [--all]
// Close a warm session. With no name: closes the single warm session if there is exactly one,
// otherwise lists what's warm and asks for a name (never guesses).
'use strict';
const { spawnSync } = require('child_process');

function ab(args) { const r = spawnSync('agent-browser', args, { encoding: 'utf8' }); return (r.stdout || '') + (r.stderr || ''); }
function listSessions() {
  return ab(['session', 'list'])
    .replace(/^Active sessions:?\s*/i, '')
    .split('\n').map(s => s.trim())
    .filter(s => s && !/^no /i.test(s));
}
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function printRemaining(closed) {
  sleep(500); // daemon teardown is async — give the registry a beat so the list isn't stale
  const rest = listSessions().filter(s => s !== closed);
  console.log('\nRemaining: ' + (rest.length ? rest.join(', ') : '(none)'));
}

const argv = process.argv.slice(2);
if (argv.includes('--all')) {
  console.log(ab(['close', '--all']).trim() || '✓ all sessions closed');
  printRemaining();
  process.exit(0);
}

const sessions = listSessions();
let name = argv.find(a => !a.startsWith('--'));

if (!name) {
  if (sessions.length === 0) { console.log('No warm sessions to stop.'); process.exit(0); }
  if (sessions.length > 1) {
    console.log('Several sessions are warm — pass a name (or --all):');
    for (const s of sessions) console.log(`  flint shard ab stop ${s}`);
    process.exit(1);
  }
  name = sessions[0];
}

if (!sessions.includes(name)) {
  console.log(`Session "${name}" is not warm.` + (sessions.length ? ` Warm: ${sessions.join(', ')}` : ' Nothing is running.'));
  process.exit(1);
}

console.log((ab(['--session', name, 'close']).trim() || '✓ closed') + `  (session "${name}")`);
printRemaining(name);
