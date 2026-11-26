// Minimal Claude Code status line that also feeds the monitor's plan panel.
// It records the plan usage (5-hour and weekly %, documented `rate_limits` field, Pro/Max plans only)
// to <data dir>/limits.jsonl whenever it changes, and prints: model · 5h % · week %.
// settings.json: "statusLine": { "type": "command", "command": "node ~/.claude/skills/token-diet/monitor/statusline.mjs" }
// Already have a status line? Copy the recordLimits() function into it instead.
import fs from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './lib.mjs';

function recordLimits(s) {
  try {
    const rl = s.rate_limits;
    if (!rl || !(rl.five_hour || rl.seven_day)) return;
    if (!fs.existsSync(DATA_DIR)) return; // only once the skill has been used
    const v = { h5: rl.five_hour?.used_percentage, h5r: rl.five_hour?.resets_at, d7: rl.seven_day?.used_percentage, d7r: rl.seven_day?.resets_at };
    const latest = join(DATA_DIR, 'limits-latest.json');
    const now = JSON.stringify(v);
    let before = '';
    try { before = fs.readFileSync(latest, 'utf8'); } catch {}
    if (now === before) return;
    fs.writeFileSync(latest, now);
    fs.appendFileSync(join(DATA_DIR, 'limits.jsonl'), JSON.stringify({ t: new Date().toISOString(), ...v }) + '\n');
  } catch {} // a status line must never fail
}

let raw = '';
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  let s = {};
  try { s = JSON.parse(raw); } catch {}
  recordLimits(s);
  const pct = x => (typeof x === 'number' ? Math.round(x) + '%' : '–');
  const parts = [s.model?.display_name || 'Claude'];
  if (s.rate_limits) parts.push(`5h ${pct(s.rate_limits.five_hour?.used_percentage)}`, `week ${pct(s.rate_limits.seven_day?.used_percentage)}`);
  process.stdout.write(parts.join(' · '));
});
