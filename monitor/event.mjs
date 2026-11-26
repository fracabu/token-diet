// Append one event to the monitor's events file.
// Usage: node event.mjs <job> <phase> <status> [note...] [--model m] [--effort e] [--tokens n] [--sec s] [--events file.jsonl]
//   status: start | step | done | stop | error   (old names avvio|passo|fine|errore are accepted)
//   Phases become columns in the order they first appear.
//   Old flags --modello, --token, --eventi are accepted. Default file: <data dir>/events.jsonl
import { appendFileSync } from 'node:fs';
import { ensureDataDir, FILES, parseArgs, toAbs, normStatus, normModel } from './lib.mjs';

const USAGE = 'usage: node event.mjs <job> <phase> <status> [note] [--model m] [--effort e] [--tokens n] [--sec s] [--events file]\n  status: start | step | done | stop | error';
const SPEC = {
  model: { key: 'model' }, modello: { key: 'model' },
  effort: { key: 'effort' },
  tokens: { key: 'tokens' }, token: { key: 'tokens' },
  sec: { key: 'sec' },
  events: { key: 'events' }, eventi: { key: 'events' },
};
const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); process.exit(0); }
const { opts, pos } = parseArgs(argv, SPEC);
const [job, phase, statusArg, ...rest] = pos;
if (!job || !phase || !statusArg) { console.error(USAGE); process.exit(1); }

const ev = { t: new Date().toISOString(), job, phase, status: normStatus(statusArg) };
const note = rest.join(' ').trim();
if (note) ev.note = note.slice(0, 120);
if (opts.model) ev.model = normModel(opts.model);
if (opts.effort) ev.effort = opts.effort;
if (opts.tokens) ev.tokens = Number(opts.tokens);
if (opts.sec) ev.sec = Number(opts.sec);

ensureDataDir();
appendFileSync(opts.events ? toAbs(opts.events) : FILES.events, JSON.stringify(ev) + '\n');
console.log('ok');
