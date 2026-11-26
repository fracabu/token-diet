// Demo of the monitor with made-up data, for screenshots and for trying it out.
// Usage: node demo.mjs [--port 4800] [--no-open]
// Writes to a throw-away data dir (<tmp>/token-diet-demo): your real data in ~/.token-diet is never touched.
// The run plays out over about a minute: haiku scans, sonnet writes, opus verifies.
import { spawn, exec } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CODE_DIR = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || 4800;
const noOpen = args.includes('--no-open');
const home = join(os.tmpdir(), 'token-diet-demo');
fs.rmSync(home, { recursive: true, force: true });
fs.mkdirSync(home, { recursive: true });
const events = join(home, 'events.jsonl');
const limits = join(home, 'limits.jsonl');

const iso = ms => new Date(ms).toISOString();
const write = (file, o) => fs.appendFileSync(file, JSON.stringify(o) + '\n');
const now = Date.now();

// Plan usage before the job: 5-hour window at 12%, week at 41%.
const h5r = Math.floor((now + 3 * 3600e3) / 1000), d7r = Math.floor((now + 4 * 86400e3) / 1000);
write(limits, { t: iso(now - 120e3), h5: 12, h5r, d7: 41, d7r });

write(events, { t: iso(now), phase: '_', title: 'docs rewrite · 6 chapters', phases: [['scan', 'haiku'], ['write', 'sonnet'], ['verify', 'opus'], ['wrap-up', 'session']] });

const chapters = ['01-install', '02-quickstart', '03-config', '04-api', '05-errors', '06-faq'];
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
const plan = [];
let t = 1500;
chapters.forEach((c, i) => {
  const s0 = t + i * 900;
  plan.push([s0, { job: c, phase: 'scan', status: 'start', note: 'started', model: 'haiku', effort: 'low' }]);
  plan.push([s0 + 3500, { job: c, phase: 'scan', status: 'done', note: 'outline ok', model: 'haiku', tokens: rnd(70e3, 120e3), sec: rnd(60, 110) }]);
  const w0 = s0 + 4500 + i * 1500;
  plan.push([w0, { job: c, phase: 'write', status: 'start', note: 'started', model: 'sonnet', effort: 'high' }]);
  plan.push([w0 + 6000, { job: c, phase: 'write', status: 'step', note: 'draft written, checking examples' }]);
  plan.push([w0 + 14000 + i * 1200, { job: c, phase: 'write', status: 'done', note: 'draft ready', model: 'sonnet', tokens: rnd(150e3, 230e3), sec: rnd(380, 780) }]);
  const v0 = w0 + 15500 + i * 1200;
  plan.push([v0, { job: c, phase: 'verify', status: 'start', note: 'started', model: 'opus', effort: 'high' }]);
  if (i === 4) plan.push([v0 + 5000, { job: c, phase: 'verify', status: 'step', note: '2 code samples fixed' }]);
  // the last two chapters stay "running" so the screenshot shows live cells
  if (i < 4) plan.push([v0 + 9000, { job: c, phase: 'verify', status: 'done', note: i === 1 ? 'OK, 1 broken link fixed' : 'OK', model: 'opus', tokens: rnd(120e3, 190e3), sec: rnd(280, 520) }]);
});
plan.sort((a, b) => a[0] - b[0]);

let h5 = 12, d7 = 41;
for (const [dt, ev] of plan) {
  setTimeout(() => {
    write(events, { t: iso(Date.now()), ...ev });
    if (ev.status === 'done') { h5 += ev.model === 'opus' ? 3 : ev.model === 'sonnet' ? 2 : 0.3; d7 += ev.model === 'haiku' ? 0.05 : 0.4; write(limits, { t: iso(Date.now()), h5: Math.round(h5), h5r, d7: +d7.toFixed(1), d7r }); }
  }, dt);
}

const srv = spawn(process.execPath, [join(CODE_DIR, 'server.mjs'), events, String(port)], { stdio: 'inherit', env: { ...process.env, TOKEN_DIET_HOME: home } });
const url = `http://localhost:${port}`;
if (!noOpen) setTimeout(() => exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`), 600);
const end = plan[plan.length - 1][0] + 2000;
console.log(`[demo] ${url}  (data: ${home}) · the run lasts ~${Math.round(end / 1000)}s, the server stays up: Ctrl+C to stop`);
process.on('SIGINT', () => { srv.kill(); process.exit(0); });
