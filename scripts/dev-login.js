#!/usr/bin/env node
// flint shard ab login <stable-id>                    # the common case
// flint shard ab login <start|finish|abort|status|url> <stable-id>
//
// Re-capture the saved login behind a (Browser) artifact with kind: browser.
// Split into two verbs on purpose, because the human step sits in the middle:
//
//   start   launch a hosted browser and print its live URL, then EXIT.
//           Deliberately does NOT hold a CDP connection — an attached
//           agent-browser daemon leaves the live view rendering frames but
//           refusing input, which looks exactly like a broken link.
//   <human signs in through the live URL, 2FA and all>
//   finish  attach, save the state file, report what was captured, stop the
//           browser, and verify nothing is left billing.
//   abort   stop the browser without writing anything.
//   status  what is pending, and how long is left on its clock.
//
// The artifact is the source of truth: `stable-id` selects it, `state-file`
// says where to write, and its `provider:` wikilink resolves the API key.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const API = 'https://api.browser-use.com/api/v4';
const CAPTURE_TIMEOUT_MIN = 60;

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  const out = (r.stdout || '').trim();
  const err = (r.stderr || '').trim();
  return { ok: r.status === 0, out, err, msg: [out, err].filter(Boolean).join('\n') };
}
function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }

function flintRoot() {
  let d = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'flint.toml'))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  die('not inside a Flint (no flint.toml found above the working directory)');
}

// Minimal frontmatter reader — enough for the flat scalar keys these artifacts use.
function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv && kv[2] !== '') fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { fm, body: text };
}

function browsersDir(root) { return path.join(root, 'Mesh', 'Types', 'Browsers'); }

function findByStableId(root, stableId) {
  const dir = browsersDir(root);
  if (!fs.existsSync(dir)) die(`no ${path.relative(root, dir)} in this Flint`);
  const hits = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const full = path.join(dir, f);
    const { fm, body } = frontmatter(full);
    if (fm['stable-id'] === stableId) hits.push({ file: full, name: f.replace(/\.md$/, ''), fm, body });
  }
  if (!hits.length) {
    const all = fs.readdirSync(dir).filter(f => f.endsWith('.md'))
      .map(f => frontmatter(path.join(dir, f)).fm['stable-id']).filter(Boolean);
    die(`no (Browser) artifact with stable-id "${stableId}"${all.length ? `\n  known ids: ${all.join(', ')}` : ''}`);
  }
  return hits[0];
}

// The API key lives in the provider artifact's Credentials table, as `bu_...`.
// An env var wins so a key can be kept out of the Mesh without editing anything.
function resolveKey(root, artifact) {
  if (process.env.BROWSER_USE_API_KEY) return process.env.BROWSER_USE_API_KEY;
  const link = (artifact.fm.provider || '').match(/\[\[(.+?)\]\]/);
  const candidates = [];
  if (link) candidates.push(path.join(browsersDir(root), `${link[1]}.md`));
  candidates.push(artifact.file);
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    const k = fs.readFileSync(c, 'utf8').match(/\bbu_[A-Za-z0-9_\-]{20,}/);
    if (k) return k[0];
  }
  die('no API key — set BROWSER_USE_API_KEY, or put one in the provider artifact');
}

function api(method, pathname, key, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(API + pathname);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: {
        'X-Browser-Use-API-Key': key,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(b); } catch { /* non-JSON error body */ }
        if (res.statusCode >= 400) return reject(new Error(`${method} ${pathname} → ${res.statusCode}: ${b.slice(0, 300)}`));
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function pendingPath(stableId) {
  return path.join(os.tmpdir(), `flint-ab-login-${stableId}.json`);
}

function announce(stableId, liveUrl, why) {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`  LOGIN NEEDED — ${stableId}${why ? `  (${why})` : ''}`);
  console.log(`${'─'.repeat(72)}\n`);
  console.log('  A human must open this and sign in:\n');
  console.log(`  ${liveUrl}\n`);
  console.log('  Nothing is attached over CDP, so the live view will accept input.');
  console.log(`  Then run:  flint shard ab login finish ${stableId}\n`);
  console.log('  If you are an agent: relay this URL to the human and stop —');
  console.log('  you cannot complete a sign-in yourself.\n');
}

async function start(root, stableId, why) {
  const art = findByStableId(root, stableId);
  // `replay` is the current name for this kind; `browser` is the former name and
  // still appears in existing artifacts. A `persistent` browser is never captured
  // this way — a human signs into it directly and the profile keeps the login.
  if (art.fm.kind === 'persistent') {
    die(`"${stableId}" is kind: persistent — it has no state file to capture.\n` +
        `  A human signs in through its viewer and the login stays in the profile.\n` +
        `  To hand over mid-task, use the await command in its (Browser) artifact.`);
  }
  if (art.fm.kind && !['browser', 'replay'].includes(art.fm.kind)) {
    die(`"${stableId}" is kind: ${art.fm.kind} — login only applies to kind: replay`);
  }
  const stateFile = art.fm['state-file'];
  if (!stateFile) die(`${art.name} has no state-file in frontmatter`);
  const key = resolveKey(root, art);

  const pend = pendingPath(stableId);
  if (fs.existsSync(pend)) {
    const old = JSON.parse(fs.readFileSync(pend, 'utf8'));
    console.log(`⚠ a capture for "${stableId}" is already pending (browser ${old.id}).`);
    if (old.liveUrl) { announce(stableId, old.liveUrl, 'capture already in flight'); return old; }
    console.log(`  finish it:  flint shard ab login finish ${stableId}`);
    console.log(`  or drop it: flint shard ab login abort ${stableId}`);
    process.exit(2);
  }

  // Capture and replay MUST egress from the same place, or the site sees one
  // session token arriving from unrelated IPs and revokes it. `none` disables the
  // managed residential proxy, which lands on a small stable datacenter pool —
  // far friendlier to session reuse than a fresh residential IP per browser.
  const pc = (art.fm['proxy-country'] || 'us').toLowerCase();
  const proxyCountryCode = (pc === 'none' || pc === 'null') ? null : pc;
  const b = await api('POST', '/browsers', key, {
    timeout: CAPTURE_TIMEOUT_MIN,
    proxyCountryCode,
  });
  fs.writeFileSync(pend, JSON.stringify({
    id: b.id, cdpUrl: b.cdpUrl, liveUrl: b.liveUrl, stateFile, artifact: art.file, timeoutAt: b.timeoutAt,
  }, null, 2), { mode: 0o600 });

  // Carry the existing identity into the capture browser so this is a TOP-UP, not a
  // fresh start. Without it, a human who signs into two of three sites silently drops
  // the third: `finish` saves whatever the browser holds, and a blank browser holds
  // only what was just typed. Attach, load, and detach again — the CDP hold has to be
  // released or the live view renders frames but refuses input.
  let carried = 0;
  const abs = path.isAbsolute(stateFile) ? stateFile : path.join(root, stateFile);
  if (fs.existsSync(abs)) {
    const pre = `${stableId}-preload`;
    if (run('agent-browser', ['--session', pre, 'connect', b.cdpUrl]).ok) {
      run('agent-browser', ['--session', pre, 'state', 'load', abs]);
      try { carried = (JSON.parse(fs.readFileSync(abs, 'utf8')).cookies || []).length; } catch { /* ignore */ }
    }
    run('agent-browser', ['--session', pre, 'close']);
  }

  console.log(`\n  Capturing a fresh login for "${stableId}" → ${stateFile}`);
  console.log(`  Browser ${b.id} — ${CAPTURE_TIMEOUT_MIN} minutes on the clock.`);
  console.log(`  Egress: ${proxyCountryCode === null ? 'managed proxy DISABLED (stable datacenter pool)' : `residential proxy, country "${proxyCountryCode}" — rotates per browser, sessions captured here may be revoked on replay`}`);
  console.log(carried
    ? `  Carried in ${carried} existing cookies — sites still signed in stay signed in.\n  You only need to sign in to whatever is broken.`
    : '  Starting from a blank browser — sign in to EVERY site this identity covers.');
  announce(stableId, b.liveUrl, why);
  return b;
}


async function url(root, stableId) {
  const pend = pendingPath(stableId);
  if (!fs.existsSync(pend)) die(`no capture in flight for "${stableId}" — run: flint shard ab login ${stableId}`);
  const p = JSON.parse(fs.readFileSync(pend, 'utf8'));
  if (p.liveUrl) return announce(stableId, p.liveUrl, null);
  // Older pending files did not record it — re-read from the provider rather than
  // making the operator abort and lose a sign-in that may already be done.
  const key = resolveKey(root, findByStableId(root, stableId));
  const b = await api('GET', `/browsers/${p.id}`, key);
  if (!b.liveUrl) die(`browser ${p.id} is ${b.status} and has no live URL — run: flint shard ab login abort ${stableId}, then check again`);
  fs.writeFileSync(pend, JSON.stringify({ ...p, liveUrl: b.liveUrl }, null, 2), { mode: 0o600 });
  announce(stableId, b.liveUrl, null);
}

function summarise(stateFile) {
  const d = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const cookies = d.cookies || [];
  const byDomain = {};
  for (const c of cookies) byDomain[c.domain] = (byDomain[c.domain] || 0) + 1;
  const GOOGLE_AUTH = ['SID', 'HSID', 'SSID', 'SAPISID', 'APISID', 'LSID', '__Secure-1PSID', '__Secure-3PSID'];
  const auth = [...new Set(cookies.filter(c => GOOGLE_AUTH.includes(c.name)).map(c => c.name))];
  return { count: cookies.length, byDomain, auth };
}

async function finish(root, stableId) {
  const pend = pendingPath(stableId);
  if (!fs.existsSync(pend)) die(`no pending capture for "${stableId}" — run: flint shard ab login start ${stableId}`);
  const p = JSON.parse(fs.readFileSync(pend, 'utf8'));
  const art = findByStableId(root, stableId);
  const key = resolveKey(root, art);
  const session = `${stableId}-capture`;
  const abs = path.isAbsolute(p.stateFile) ? p.stateFile : path.join(root, p.stateFile);

  const c = run('agent-browser', ['--session', session, 'connect', p.cdpUrl]);
  if (!c.ok) die(`could not attach to the capture browser: ${c.msg}\n  it may have hit its timeout — run: flint shard ab login abort ${stableId}`);

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const s = run('agent-browser', ['--session', session, 'state', 'save', abs]);
  if (!s.ok) die(`state save failed: ${s.msg}`);
  try { fs.chmodSync(abs, 0o600); } catch { /* best effort */ }

  let sum;
  try { sum = summarise(abs); } catch (e) { die(`state file unreadable after save: ${e.message}`); }

  console.log(`\n✓ saved ${p.stateFile}  (${sum.count} cookies, ${Object.keys(sum.byDomain).length} domains)`);
  for (const [d, n] of Object.entries(sum.byDomain).sort()) console.log(`    ${d}: ${n}`);
  console.log(sum.auth.length
    ? `\n  google auth cookies: ${sum.auth.join(', ')}`
    : '\n  ⚠ no Google auth cookies (SID/HSID/SAPISID) — if this identity covers Google, the sign-in did not take');
  if (!sum.count) console.log('  ⚠ ZERO cookies captured — the browser was not signed in to anything');

  run('agent-browser', ['--session', session, 'close']);
  try { await api('PATCH', `/browsers/${p.id}`, key, { action: 'stop' }); } catch (e) { console.log(`  ⚠ stop failed: ${e.message}`); }
  fs.unlinkSync(pend);

  let active = null;
  try { active = (await api('GET', '/browsers?filterBy=active&pageSize=25', key)).totalItems; } catch { /* non-fatal */ }
  console.log(`\n✓ capture browser stopped${active === null ? '' : ` — ${active} browser(s) still active`}`);
  console.log(`\n  Verify before trusting it: load this state into a fresh browser and check that`);
  console.log(`  the sites you need actually work. Compare the domains above against what`);
  console.log(`  ${path.basename(art.file, '.md')} says this identity covers — a domain missing here is a site`);
  console.log(`  that was NOT signed in, and it will fail on replay.`);
  console.log(`  Then log the capture date in that artifact.\n`);
}

async function abort(root, stableId) {
  const pend = pendingPath(stableId);
  if (!fs.existsSync(pend)) die(`no pending capture for "${stableId}"`);
  const p = JSON.parse(fs.readFileSync(pend, 'utf8'));
  const key = resolveKey(root, findByStableId(root, stableId));
  run('agent-browser', ['--session', `${stableId}-capture`, 'close']);
  try { await api('PATCH', `/browsers/${p.id}`, key, { action: 'stop' }); } catch (e) { console.log(`⚠ stop failed: ${e.message}`); }
  fs.unlinkSync(pend);
  console.log(`✓ capture for "${stableId}" aborted; browser ${p.id} stopped. Nothing was written.`);
}

function status(root, stableId) {
  const ids = stableId ? [stableId] : fs.readdirSync(browsersDir(root)).filter(f => f.endsWith('.md'))
    .map(f => frontmatter(path.join(browsersDir(root), f)).fm['stable-id']).filter(Boolean);
  let any = false;
  for (const id of ids) {
    const pend = pendingPath(id);
    if (!fs.existsSync(pend)) continue;
    any = true;
    const p = JSON.parse(fs.readFileSync(pend, 'utf8'));
    const left = Math.round((new Date(p.timeoutAt) - Date.now()) / 60000);
    console.log(`${id}: capture pending — browser ${p.id}, ${left > 0 ? `~${left} min left` : 'EXPIRED'}`);
    console.log(`  finish: flint shard ab login finish ${id}`);
  }
  if (!any) console.log('no captures pending');
}

(async () => {
  const [cmd, stableId] = process.argv.slice(2);
  const root = flintRoot();
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log('Usage: flint shard ab login <stable-id>            # get a login URL for a human');
    console.log('       flint shard ab login <verb> <stable-id>');
    console.log('  start   same as the bare form — launch a browser, print a live URL');
    console.log('  finish  save the state file, stop the browser, report what was captured');
    console.log('  abort   stop the browser, write nothing');
    console.log('  status  show pending captures');
    console.log('  url     reprint the login URL for a capture already in flight');
    return;
  }
  if (cmd === 'status') return status(root, stableId);
  // Bare `flint shard ab login <stable-id>` is the common case: I hit a login
  // wall, get me a URL to hand the human.
  if (!['start','finish','abort','url'].includes(cmd)) return start(root, cmd);
  if (!stableId) die(`Usage: flint shard ab login ${cmd} <stable-id>`);
  if (cmd === 'url') return url(root, stableId);
  if (cmd === 'start') return start(root, stableId);
  if (cmd === 'finish') return finish(root, stableId);
  if (cmd === 'abort') return abort(root, stableId);
  die(`unknown command "${cmd}" — use <stable-id> | start | finish | abort | status | url`);
})().catch(e => die(e.message));
