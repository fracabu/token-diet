// Start the live monitor (if it is not already running) and open it in the browser.
// Usage: node start.mjs [--title "run 3"] [--phases "scan:haiku,write:sonnet,verify:opus,wrap-up:session"]
//                       [--new] [--events file.jsonl] [--port 4799] [--no-open]
//   --new     archive the previous events and start from scratch (a new job)
//   --title   text shown on the command line at the top of the page
//   --phases  declare all columns up front, as phase:model pairs
//   --events  events file to follow (default: <data dir>/events.jsonl)
//   --port    port to listen on (default 4799)
//   --no-open do not open the browser
// Old Italian flags (--nuovo --titolo --fasi --eventi --porta --non-aprire) are still accepted.
// Data lives in $TOKEN_DIET_HOME or ~/.token-diet (see lib.mjs).
import { spawn, exec, execSync } from 'node:child_process';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { CODE_DIR, FILES, ensureDataDir, parseArgs, toAbs, normalizeEvent, normModel } from './lib.mjs';

const SPEC = {
  title: { key: 'title' }, titolo: { key: 'title' },
  phases: { key: 'phases' }, fasi: { key: 'phases' },
  events: { key: 'events' }, eventi: { key: 'events' },
  port: { key: 'port' }, porta: { key: 'port' },
  new: { key: 'new', bool: true }, nuovo: { key: 'new', bool: true },
  'no-open': { key: 'noOpen', bool: true }, 'non-aprire': { key: 'noOpen', bool: true },
  help: { key: 'help', bool: true },
};
const { opts } = parseArgs(process.argv.slice(2), SPEC);
if (opts.help) {
  console.log('usage: node start.mjs [--title "run 3"] [--phases "scan:haiku,write:sonnet,verify:opus,wrap-up:session"] [--new] [--events file.jsonl] [--port 4799] [--no-open]');
  process.exit(0);
}

ensureDataDir();
const port = Number(opts.port || 4799);
const url = `http://localhost:${port}`;
const events = opts.events ? toAbs(opts.events) : FILES.events;

if (opts.new && fs.existsSync(events) && fs.statSync(events).size > 0) {
  fs.mkdirSync(FILES.archive, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.renameSync(events, join(FILES.archive, `events-${stamp}.jsonl`));
}
if (!fs.existsSync(events)) fs.writeFileSync(events, '');

// Header event: shows the title and all the columns right away.
if (typeof opts.title === 'string' || typeof opts.phases === 'string') {
  const ev = { t: new Date().toISOString(), phase: '_' };
  if (typeof opts.title === 'string') ev.title = opts.title;
  if (typeof opts.phases === 'string') {
    ev.phases = opts.phases.split(',').map(x => x.trim().split(':')).filter(x => x[0]).map(([k, m]) => [k, normModel(m)]);
  }
  // Re-running start.mjs with the same title and phases must not pile up identical headers.
  const lines = fs.readFileSync(events, 'utf8').trim().split('\n').filter(Boolean);
  let last = null;
  for (let i = lines.length - 1; i >= 0 && !last; i--) {
    try { const e = normalizeEvent(JSON.parse(lines[i])); if (e.phase === '_') last = e; } catch {}
  }
  const same = last && (ev.title ?? last.title) === last.title && JSON.stringify(ev.phases ?? last.phases) === JSON.stringify(last.phases);
  if (!same) fs.appendFileSync(events, JSON.stringify(ev) + '\n');
}

// Ask a running monitor which events file it follows ({events, pid}); older versions answered on /salute with {eventi, pid}.
async function health() {
  for (const path of ['/health', '/salute']) {
    try {
      const r = await fetch(url + path, { signal: AbortSignal.timeout(800) });
      if (!r.ok) continue;
      const j = await r.json();
      if (j && j.ok) return { events: j.events ?? j.eventi, pid: j.pid };
    } catch {}
  }
  return null;
}

// Same file even when written with / or \ and different case (Windows).
const same = p => { const r = resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; };

let state = await health();
let started = false;
// A monitor following a DIFFERENT file is useless: stop it and start again on the same port with the right file.
if (state && same(state.events) !== same(events)) {
  console.log(`[i] port ${port} had a monitor on another file (${state.events}): restarting it on the right file`);
  try {
    if (state.pid) process.kill(state.pid);
    else if (process.platform === 'win32') execSync(`for /f "tokens=5" %p in ('netstat -ano ^| findstr LISTENING ^| findstr :${port}') do taskkill /PID %p /F`, { stdio: 'ignore', shell: 'cmd.exe' });
  } catch {}
  for (let i = 0; i < 20 && (await health()); i++) await new Promise(r => setTimeout(r, 150));
  state = await health();
  if (state) console.log(`[!] could not stop it: use --port ${port + 1}`);
}
if (!state) {
  const log = fs.openSync(FILES.log, 'a');
  const p = spawn(process.execPath, [join(CODE_DIR, 'server.mjs'), events, String(port)], { detached: true, stdio: ['ignore', log, log], windowsHide: true, env: process.env });
  p.unref();
  started = true;
  for (let i = 0; i < 20 && !(await health()); i++) await new Promise(r => setTimeout(r, 150));
}
if (!opts.noOpen) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}
console.log(`[OK] monitor ${started ? 'started' : 'already running'}: ${url}`);
console.log(`     events: ${events}`);
console.log(`     write:  node "${join(CODE_DIR, 'event.mjs')}" <job> <phase> <status> "note" --model <m>${opts.events ? ` --events "${events}"` : ''}`);
