// Live monitor for sub-agents: serves index.html and streams events (Server-Sent Events).
// Usage: node server.mjs [events-file] [port]     (default file: <data dir>/events.jsonl, default port 4799)
// Also follows limits.jsonl in the data dir, written by the status line (plan usage: 5 hours, week).
// Events are streamed as they are written; the dashboard understands both old (Italian keys) and new events.
import http from 'node:http';
import fs from 'node:fs';
import { join } from 'node:path';
import { CODE_DIR, FILES, ensureDataDir, toAbs } from './lib.mjs';

ensureDataDir();
const FILE = process.argv[2] ? toAbs(process.argv[2]) : FILES.events;
const PORT = Number(process.argv[3] || 4799);
if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '');

const clients = new Set();
function send(res, name, line) { res.write((name ? `event: ${name}\n` : '') + `data: ${line}\n\n`); }

// Follow a JSONL file and send every new line to the clients under the given event name.
function follow(file, name, resetOnTruncate) {
  const s = { lines: [], read: 0, tail: '' };
  s.poll = () => {
    let st;
    try { st = fs.statSync(file); } catch { return; }
    if (st.size < s.read) { // file truncated or replaced: start over
      s.read = 0; s.tail = ''; s.lines.length = 0;
      if (resetOnTruncate) for (const c of clients) c.write('event: reset\ndata: {}\n\n');
    }
    if (st.size === s.read) return;
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(st.size - s.read);
    fs.readSync(fd, buf, 0, buf.length, s.read);
    fs.closeSync(fd);
    s.read = st.size;
    const parts = (s.tail + buf.toString('utf8')).split('\n');
    s.tail = parts.pop();
    for (const p of parts) {
      const line = p.trim();
      if (!line) continue;
      try { JSON.parse(line); } catch { continue; }
      s.lines.push(line);
      for (const c of clients) send(c, name, line);
    }
  };
  s.poll();
  setInterval(s.poll, 400);
  return s;
}
const events = follow(FILE, '', true);
const limits = follow(FILES.limits, 'limits', false);

http.createServer((req, res) => {
  if (req.url.startsWith('/stream')) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    for (const l of limits.lines.slice(-500)) send(res, 'limits', l);
    for (const l of events.lines) send(res, '', l);
    res.write('event: ready\ndata: {}\n\n');
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }
  if (req.url.startsWith('/health') || req.url.startsWith('/salute')) {
    res.end(JSON.stringify({ ok: true, events: FILE, pid: process.pid }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(fs.readFileSync(join(CODE_DIR, 'index.html')));
}).listen(PORT, () => console.log(`monitor: http://localhost:${PORT}  (events: ${FILE})`));
