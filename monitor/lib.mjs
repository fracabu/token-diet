// Shared helpers for the token-diet monitor: data directory, one-time migration, argument parsing.
// Runtime data (events, archive, plan limits, server log) lives OUTSIDE the skill folder:
//   $TOKEN_DIET_HOME, or ~/.token-diet when the variable is not set.
import fs from 'node:fs';
import os from 'node:os';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CODE_DIR = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.TOKEN_DIET_HOME
  ? resolve(process.env.TOKEN_DIET_HOME)
  : join(os.homedir(), '.token-diet');

export const FILES = {
  events: join(DATA_DIR, 'events.jsonl'),
  archive: join(DATA_DIR, 'archive'),
  limits: join(DATA_DIR, 'limits.jsonl'),          // written by the status line
  limitsLatest: join(DATA_DIR, 'limits-latest.json'), // written by the status line
  log: join(DATA_DIR, 'server.log'),
};

// Old (Italian) names used by earlier versions, which kept their data inside monitor/.
const LEGACY_FILES = [
  ['eventi.jsonl', 'events.jsonl'],
  ['limiti.jsonl', 'limits.jsonl'],
  ['limiti-ultimo.json', 'limits-latest.json'],
  ['server.log', 'server.log'],
];

// Move a file; never overwrite, never delete something that was not copied completely.
function moveFile(from, to) {
  if (!fs.existsSync(from) || fs.existsSync(to)) return;
  try { fs.renameSync(from, to); return; } catch {}
  try {
    fs.copyFileSync(from, to);
    if (fs.statSync(to).size === fs.statSync(from).size) fs.unlinkSync(from);
  } catch {}
}

// Create the data dir and, on first run, migrate data left inside monitor/ by older versions.
// The migration only targets the default ~/.token-diet: a custom TOKEN_DIET_HOME (the demo, tests)
// must never swallow the user's real data.
export function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (process.env.TOKEN_DIET_HOME) return;
  for (const [oldName, newName] of LEGACY_FILES) moveFile(join(CODE_DIR, oldName), join(DATA_DIR, newName));
  const oldArchive = join(CODE_DIR, 'archivio');
  if (fs.existsSync(oldArchive)) {
    fs.mkdirSync(FILES.archive, { recursive: true });
    for (const f of fs.readdirSync(oldArchive)) moveFile(join(oldArchive, f), join(FILES.archive, f.replace(/^eventi-/, 'events-')));
    try { fs.rmdirSync(oldArchive); } catch {} // only succeeds when empty
  }
}

// Absolute path from a CLI value (relative paths are relative to the current directory).
export const toAbs = p => (isAbsolute(p) ? p : join(process.cwd(), p));

// Minimal argument parser. `spec` maps every accepted flag (aliases included) to
// { key, bool }. Boolean flags never consume the next argument.
export function parseArgs(argv, spec) {
  const opts = {}, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const s = spec[a.slice(2)];
    if (!s) { // unknown flag: skip its value, if any
      if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) i++;
      continue;
    }
    if (s.bool) opts[s.key] = true;
    else { opts[s.key] = argv[i + 1]; i++; }
  }
  return { opts, pos };
}

// Old Italian names -> English (used when reading old events and when parsing old CLI flags).
export const STATUS_ALIASES = { avvio: 'start', passo: 'step', fine: 'done', errore: 'error' };
export const MODEL_ALIASES = { sessione: 'session' };
export const normStatus = s => STATUS_ALIASES[s] || s;
export const normModel = m => MODEL_ALIASES[m] || m;

// Old-style event (Italian keys) or new-style event -> new-style event.
export function normalizeEvent(e) {
  const o = { t: e.t };
  const phase = e.phase ?? e.fase;
  o.phase = phase;
  if (phase === '_') {
    const title = e.title ?? e.giro;
    const phases = e.phases ?? e.fasi;
    if (title != null) o.title = title;
    if (Array.isArray(phases)) o.phases = phases.map(([k, m]) => [k, normModel(m)]);
    return o;
  }
  const job = e.job ?? e.materia;
  if (job != null) o.job = job;
  const status = e.status ?? e.stato;
  if (status != null) o.status = normStatus(status);
  const note = e.note ?? e.nota;
  if (note != null) o.note = note;
  const model = e.model ?? e.modello;
  if (model != null) o.model = normModel(model);
  if (e.effort != null) o.effort = e.effort;
  const tokens = e.tokens ?? e.token;
  if (tokens != null) o.tokens = tokens;
  if (e.sec != null) o.sec = e.sec;
  return o;
}
