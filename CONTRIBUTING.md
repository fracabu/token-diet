# Contributing to token-diet

Thanks for being here. The goal is simple: help people finish the same work with fewer tokens, without letting quality slip where it matters. Any contribution in that direction is welcome.

## What helps most

1. **Real numbers from your own jobs.** A run with its phases, models, effort and tokens (the monitor archives every run in `~/.token-diet/archive/`) is the best evidence of what works and what doesn't. Open an issue with the figures and one line on the quality of the output. Remove anything private first.
2. **Cases where stepping down went wrong.** A phase that looked mechanical but needed judgement is exactly what the heuristics in `SKILL.md` should learn from.
3. **Tests on macOS and Linux.** The skill has only been tested on Windows 11. Running `node monitor/demo.mjs` and `node monitor/start.mjs --new` on another system makes a valuable issue.
4. **Fixes and ideas.** A bug, a price or model that changed, a clearer way to show the savings.

## How the code is organised

```
SKILL.md              instructions for Claude: phases, five questions, models, effort, how to answer
monitor/
  lib.mjs             data dir, migration from older versions, argument parsing, event normalisation
  start.mjs           starts the server (or reuses it) and opens the page
  event.mjs           appends one event
  server.mjs          serves index.html and streams events and plan usage (Server-Sent Events)
  index.html          the page: no build step, no framework
  statusline.mjs      minimal status line that records plan usage
  demo.mjs            made-up run in a throw-away data dir
docs/                 logo and screenshot for the README
```

Rules for the code:

- **Node standard library only.** No `npm install` for users.
- **Data never lives in the skill folder.** It goes in `~/.token-diet/` or `$TOKEN_DIET_HOME`.
- **Old events must keep working.** Earlier versions wrote events with Italian keys (`materia`, `fase`, `stato`, `modello`, `token`): `normalizeEvent()` in `lib.mjs` and `normalize()` in `index.html` read both.
- **A status line must never fail or slow down.** Wrap everything in `try`, write only when the values change.

## Changing the advice in SKILL.md

- Keep the frontmatter `description` in English; trigger phrases in other languages are welcome in `when_to_use`.
- A new rule needs a reason: the cost of the error it prevents. Write it next to the rule.
- If you update model names or prices, update the date in the table heading and the `PRICES` table in `monitor/index.html`.

## Before opening a pull request

- `node --check` passes on every `.mjs` file.
- `node monitor/demo.mjs` opens a page with no errors in the browser console.
- No personal data, tokens or real event files in the diff.

## License

By contributing you agree that your contribution is released under the [MIT License](LICENSE).
