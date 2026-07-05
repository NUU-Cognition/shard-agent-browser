#!/usr/bin/env node
// flint shard ab browser [list|assign|release] [args]
//   list                              show open browsers and which Orbh session holds each
//   assign <browser> [--session <id>] claim a browser for an Orbh session (default: this one)
//   release [--session <id>]          drop the session's claim
//
// A "browser" is either a warm agent-browser daemon (its --session name, e.g. "flint")
// or a raw CDP Chrome ("cdp:<port>"). The claim is the `browser` key on the Orbh session
// interface — visible in `flint orbh inspect`, gone when the session ends. Driving the
// browser is not scripted: the holder runs `agent-browser --session <name> ...`
// (or `agent-browser --cdp <port> ...`). See knw-ab-cli.
'use strict';
const { spawnSync } = require('child_process');
const http = require('http');

const CDP_PORTS = [9222, 9223, 9224, 9225, 9226, 9227]; // conventional local CDP range

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: r.status === 0, out: ((r.stdout || '') + (r.stderr || '')).trim() };
}
function warmSessions() {
  return run('agent-browser', ['session', 'list']).out
    .replace(/^Active sessions:?\s*/i, '')
    .split('\n').map(s => s.trim())
    .filter(s => s && !/^no /i.test(s));
}
function cdpVersion(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/json/version', timeout: 1200 }, (res) => {
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => { try { resolve(JSON.parse(b).Browser || 'unknown'); } catch { resolve('unknown'); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
function orbhSessions() {
  const r = run('flint', ['orbh', 'active', '--json']);
  if (!r.ok) return [];
  try { const d = JSON.parse(r.out); return d.sessions || d || []; } catch { return []; }
}
function claimOf(sessionId) {
  const r = run('flint', ['orbh', 'session', sessionId, 'get', 'browser']);
  return r.ok ? r.out : '';
}
function claims() {
  const out = [];
  for (const s of orbhSessions()) {
    const b = claimOf(s.id);
    if (b) out.push({ session: s, browser: b });
  }
  return out;
}

async function list() {
  const warm = warmSessions();
  const held = claims();
  const holder = (name) => held.filter(c => c.browser === name)
    .map(c => `${c.session.shortId} "${c.session.title}"`).join(', ');

  console.log('Open browsers\n');
  if (!warm.length) console.log('  warm agent-browser sessions: (none)');
  else for (const w of warm) {
    const h = holder(w);
    console.log(`  ${w}  ${h ? `→ assigned to ${h}` : '(unassigned)'}`);
  }
  const cdp = await Promise.all(CDP_PORTS.map(p => cdpVersion(p).then(v => ({ p, v }))));
  for (const { p, v } of cdp.filter(x => x.v)) {
    const name = `cdp:${p}`;
    const h = holder(name);
    console.log(`  ${name}  (${v})  ${h ? `→ assigned to ${h}` : '(unassigned)'}`);
  }
  if (!warm.length && !cdp.some(x => x.v)) console.log('  (no CDP browsers on :9222-:9227 either — open one with `agent-browser open <url>`)');

  const stale = held.filter(c => !warm.includes(c.browser) && !cdp.some(x => x.v && `cdp:${x.p}` === c.browser));
  for (const c of stale) console.log(`  ⚠ ${c.session.shortId} "${c.session.title}" holds "${c.browser}" but no such browser is open`);
}

async function assign(browser, target) {
  if (!browser) { console.error('Usage: flint shard ab browser assign <name|cdp:port> [--session <orbh-id>]'); process.exit(1); }
  if (!target) { console.error('No target session — pass --session <orbh-id> or run inside an Orbh session.'); process.exit(1); }
  const warm = warmSessions();
  const m = browser.match(/^cdp:(\d+)$/);
  const exists = m ? !!(await cdpVersion(parseInt(m[1], 10))) : warm.includes(browser);
  if (!exists) console.log(`⚠ "${browser}" is not currently open — assigning anyway (open it with \`agent-browser ${m ? `connect ${m[1]}` : `--session ${browser} open <url>`}\`).`);
  for (const c of claims()) {
    if (c.browser === browser && c.session.id !== target && !c.session.id.startsWith(target)) {
      console.log(`⚠ "${browser}" is already assigned to ${c.session.shortId} "${c.session.title}" — reassigning. Coordinate if that session is live.`);
    }
  }
  const r = run('flint', ['orbh', 'session', target, 'set', 'browser', browser]);
  if (!r.ok) { console.error(`failed to set browser key: ${r.out}`); process.exit(1); }
  console.log(`✓ assigned "${browser}" to session ${target}`);
  console.log(`  drive it with:  agent-browser ${m ? `--cdp ${m[1]}` : `--session ${browser}`} <command>`);
}

function release(target) {
  if (!target) { console.error('No target session — pass --session <orbh-id> or run inside an Orbh session.'); process.exit(1); }
  const had = claimOf(target);
  const r = run('flint', ['orbh', 'session', target, 'set', 'browser', '']);
  if (!r.ok) { console.error(`failed to clear browser key: ${r.out}`); process.exit(1); }
  console.log(had ? `✓ released "${had}" from session ${target}` : `session ${target} held no browser — nothing to release`);
}

(async () => {
  const argv = process.argv.slice(2);
  let sessionFlag = null;
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--session') sessionFlag = argv[++i];
    else pos.push(argv[i]);
  }
  const cmd = (pos[0] || 'list').toLowerCase();
  const target = sessionFlag || process.env.ORBH_SESSION_ID || null;
  if (cmd === 'list') return list();
  if (cmd === 'assign') return assign(pos[1], target);
  if (cmd === 'release') return release(target);
  console.error(`Unknown command "${cmd}". Use: list | assign <browser> [--session <id>] | release [--session <id>]`);
  process.exit(1);
})();
