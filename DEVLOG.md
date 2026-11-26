# token-diet devlog

How the skill evolves, with real numbers.

## 26 Nov 2026: the first real run

- **The job:** study maps on Italian law for public-sector exam candidates. 9 subjects, each through three phases: scan the sources, write the map from an approved template, verify every fact against the law text. 27 sub-agents in total.
- **The split:** Haiku (effort `low`) to scan, Sonnet (`high`) to write, Opus (`high`) to verify. The coordinating session stayed on Opus.
- **Tokens and cost at API prices** (85% input, 15% output):

  | Model | Tokens | Cost |
  |---|---|---|
  | Haiku | 1.04 M | ≈ $0.17 |
  | Sonnet | 2.26 M | ≈ $7.24 |
  | Opus | 2.08 M | ≈ $13.29 |
  | Total | 5.38 M | ≈ $20.70 |

  The same 5.38 M tokens on Opus would have cost ≈ $34.44: **−40%**.
- **Quality:** the verification phase was not a formality. In most subjects it corrected or tightened wording in the drafts (thresholds made precise, claims fixed) and it flagged errors in the source material. That's the point: the cheap phases can afford mistakes because the expensive one catches them.
- **A second run the same evening** (7 maps, writing on Sonnet and verification on Opus, no Haiku phase): 2.81 M tokens, −25%. Less to save when there is no mechanical phase.

## 26 Nov 2026: lessons from the monitor

- **Never write an agent's `start` event before launching it.** A launch was stopped after seven `start` events had been written in advance: the monitor showed seven agents "at work" that never existed, and it looked as if tokens were burning for nothing. Now each agent writes its own `start` as its first action.
- **A monitor on the wrong file is worse than none.** If the port is taken by a monitor following another job's events, `start.mjs` now restarts it on the right file instead of suggesting another port.
- **`--new` also when a job is relaunched.** The events file of a stopped launch still held seven `start`/`stop` pairs; reopening without archiving would have shown ghost rows.

## 26 Nov 2026: from a personal skill to token-diet

- The skill started in Italian, for one person, as `scegli-modello` ("pick a model"). It is now `token-diet`, in English, with Italian trigger phrases kept.
- Data moved out of the skill folder into `~/.token-diet/`, so the repo never carries anyone's runs. Older Italian events are still read.
- `demo.mjs` added, to try the monitor without a real job.
