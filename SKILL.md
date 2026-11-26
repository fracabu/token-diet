---
name: token-diet
description: >-
  Checks whether a task can run on a smaller Claude model or at a lower effort without losing quality,
  and recommends model and effort phase by phase (mechanical work, production, verification), with the
  exact command to apply it; opens a live local monitor showing how the load splits across models and
  how much is saved versus running everything on Opus. Use it before launching sub-agents, workflows or
  long repetitive jobs (batches, series of files, production runs), and when the user asks which model
  or effort to use, whether they can save tokens, or whether they are using a sledgehammer to crack a nut.
when_to_use: >-
  "which model should I use?", "can I use sonnet/haiku?", "what effort?", "can a smaller model do
  this?", "let's save tokens", "downgrade the model", "open the token monitor"; in Italian: "che modello
  uso?", "posso usare sonnet/haiku?", "che effort metto?", "si può fare con un modello più piccolo?",
  "risparmiamo token", "downgradare di modello", "apri il monitor"; or before delegating to 3 or more
  sub-agents, or before a job that repeats the same pattern many times.
---

# token-diet

The goal is the **cost per finished job**, not per request: a cheaper model that gets it wrong and has
to redo it, or lets an error out, costs more. Step down where an error is cheap or gets caught
downstream; stay high where an error leaves the computer or is hard to spot.

Below, `M/<file>` stands for `node "${CLAUDE_SKILL_DIR}/monitor/<file>"`. Data (events, archive, plan usage, server
log) lives in `~/.token-diet/` (or `$TOKEN_DIET_HOME`), never in the skill folder. Talk to the user in
their language.

## Step 0 · Open the monitor (always, as soon as the skill starts)

The user wants to watch, live, how the load splits across models and how much is saved. As the
**first** command, before answering:

```
M/start.mjs --new --title "<short job name>" --phases "<phase>:<model>,<phase>:<model>,..."
```

`--phases` shows all the columns right away (e.g. `scan:haiku,write:sonnet,verify:opus,wrap-up:session`).
If you launch it before deciding the models, run it again afterwards with only `--phases ... --no-open`.

It starts the server if it is not running (port 4799), archives the previous job's events to
`~/.token-diet/archive/` and opens http://localhost:4799. If the port is taken by a monitor following a
**different** events file, it stops it and restarts it on the right file: no need to change port.
If the job keeps its events in a file of its own, add `--events <path>`, and **keep `--new`** for a fresh
launch even when the same job was tried before: it archives the leftovers of a launch that was stopped
(otherwise the monitor reopens with "ghost" rows of agents that never ran). Drop `--new` only to reopen
the monitor on a job that is still running. Re-running `start.mjs` with the same phases does not
duplicate the header.

Then, as you launch the sub-agents, the monitor fills up (phases become columns in order of appearance):

- **The agent**, as its FIRST action (put it in its brief, with `M/` written out as the full
  `node "<skill dir>/monitor/` path: the sub-agent cannot see this skill):
  `M/event.mjs <job> <phase> start "started" --model <m> --effort <e>`.
  ⛔ **Never write the start event yourself before the launch.** If the launch is stopped or refused,
  the monitor keeps showing agents "at work" that never started, and the user thinks tokens are being
  burnt for nothing. When the agent writes it, only agents that really started appear. If a launch
  fails and something was already written, mark it right away with `stop "not started"`.
- **The agent**, at each step: `M/event.mjs <job> <phase> step "<note, max 60 chars, no apostrophes>"`;
  `stop` if it gives up.
- **You**, when the completion notification arrives:
  `M/event.mjs <job> <phase> done "<short outcome>" --model <m> --tokens <subagent_tokens> --sec <duration>`.
  The tokens are the ones in the notification (`subagent_tokens`): without them, the savings don't move.

The savings shown are an estimate: API prices, 85% input / 15% output, versus "everything on Opus".

**Plan panel**: the real plan percentages (5 hours and week, the same as `/usage`) come from the status
line, which appends them to `~/.token-diet/limits.jsonl` when they change (documented `rate_limits`
field of the status line's stdin, Pro/Max plans only; snippet in the README). The monitor shows how much
of the week the job used and how much "all Opus" would have used. How much each model weighs on the
limits is **not documented** by Anthropic: the estimate uses the ratio of API prices, and the measured
value includes the coordinating session. Always say it this way, never as a certain figure.

## When NOT to use it

- Short tasks (a few minutes, a few calls): the evaluation costs more than it saves. Just do it.
- When the user has already chosen the model for that job: respect it, one line of note at most.

## Procedure

### 1. Split the task into phases

Almost every long job has three phases with different needs. Evaluate them separately:

| Phase | Examples | Usually enough |
|---|---|---|
| **Mechanical** | renaming, converting formats, extracting text, layout, checks with a script, grep, copying data from A to B | Haiku, effort `low` |
| **Production** | writing to an approved template, mid-complexity code with a clear spec, summaries, drafts | Sonnet, effort `medium`/`high` |
| **Judgement and verification** | architecture decisions, hard debugging, checking the correctness of something that ships (data, regulations, numbers, client deliverables), writing the first version of a template that will be copied | Opus, effort `high` |

**The ceiling is Opus 5.5 at effort `high`.** Never recommend or launch anything above it (Fable, or the
`xhigh` and `max` efforts) unless the user asks for it explicitly. Above that ceiling cost and time grow
much faster than quality for this kind of work; the savings come from going *down* from Opus high.

### 2. Evaluate each phase with five questions

1. **What happens if it gets it wrong?** An error that reaches clients, the public, production or money → don't step down. An error caught by the next step (tests, verification, review) → you can step down.
2. **Is there a template to imitate?** If an approved example exists and the job is repeating it, the smaller model holds up much better.
3. **How much new reasoning is needed?** Open choices, trade-offs, edge cases → high model. Clear rules → low model.
4. **How long or repetitive is it?** The longer and more repetitive, the more the savings matter and the more it pays to hand it to a small model.
5. **Does it need a lot of the conversation's context?** A sub-agent starts from zero: if many decisions taken in the session are needed, the brief gets expensive and the risk of misunderstanding grows.

### 3. Before stepping down a model, try stepping down the effort

Anthropic's docs recommend measuring the simpler alternative first: **the same strong model at a lower
effort**. On recent models it often matches a previous model at high effort. One model also means one cache.

### 4. Think about the cache before switching model mid-session

Switching the model of the main session invalidates the prompt cache: the next turn rewrites the whole
context. It only pays off if the remaining work is long. For a short job, stay, or **delegate** the cheap
part to a sub-agent (it has its own context and does not touch the session's cache).

## Models (Anthropic API prices per million tokens, checked 26/11/2026)

| Model | Alias | Input | Output | For |
|---|---|---|---|---|
| Claude Opus 5.5 | `opus` | $4 | $20 | complex reasoning, verification, architecture: the default and the ceiling |
| Claude Sonnet 5.5 | `sonnet` | $2 | $10 | everyday work: code and content with a clear spec |
| Claude Haiku 5.5 | `haiku` | $0.10 | $0.50 | fast and cheap: mechanical work, reading and sorting |

Claude Fable 5.2 (`fable`, $8 / $40) exists above Opus but is outside this skill's range: only on the
user's explicit request.

If the date above is more than a few months old, recheck models and prices (the `claude-api` skill, or
Anthropic's pricing page) before quoting them. On a Claude subscription (Pro/Max) you don't pay per token
but you use up the plan's limits: the ratio between models stays the same.

## Effort

Levels used here: `low`, `medium`, `high`. Higher = more reasoning, more tokens, more time.
Default for Opus 5.5, Sonnet 5.5 and Haiku 5.5: **`medium`**.

- `low`: quick exchanges, mechanical work, simple sub-agents.
- `medium`: everyday work.
- `high`: when verification and edge cases matter. Recommended minimum for work that needs intelligence,
  and the top this skill uses.

`xhigh` and `max` exist above it: only on the user's explicit request (diminishing returns, they can overthink).

## How to apply it in Claude Code

A skill **cannot change the session's model**: you recommend, the user switches.
Sub-agents, instead, are launched directly with the right model.

| Where | How |
|---|---|
| Main session | `/model sonnet` (or `opus`, `haiku`); `/model` opens the picker |
| Session effort | `/effort high`; `/effort status` shows the current one; `/effort auto` goes back to the default |
| At startup | `claude --model sonnet --effort high` |
| Plan with Opus, execute with Sonnet | `/model opusplan` |
| Sub-agent launched now | Agent tool with `model: "sonnet"` (aliases only) and, if needed, `effort` |
| Sub-agent defined in `.claude/agents/*.md` | frontmatter `model: haiku` and `effort: low` |
| Skill invoked with `/name` | frontmatter `model:` and `effort:` (they apply to that turn) |
| All sub-agents | `env.CLAUDE_CODE_SUBAGENT_MODEL` in settings.json |

Sub-agent rule: apply the smaller model **without asking** only if the user has already approved it for
that kind of work (in this session or in memory). Otherwise propose it in one line and go on with the
session's model if they don't answer.

## How you answer

Short, in this format (in the user's language):

```
Model and effort for <task>
- <phase 1>: <model>, effort <level>. Why: <one line>.
- <phase 2>: ...
- Don't step down on: <phase>, because <cost of the error>.
How: <command, or "I'll apply it to the sub-agents">.
Estimated savings: <order of magnitude, e.g. "about half the tokens of phase 2">.
```

If the whole job is high-risk judgement or verification, say it in one line: "stay on Opus, stepping
down here costs more than it saves".

## Examples

- **Series production from an approved template, with legal verification** (e.g. 40 maps of
  regulations): extract texts and lay out → Haiku `low`; write each map from the template → Sonnet
  `high`; check every fact against the law text → Opus `high`. Never Haiku on verification.
- **Rename 300 files by a rule**: Haiku `low`, or a script and no model at all.
- **Debugging an error nobody understands**: stay on the strong model, effort `high`; stepping down wastes time.
- **Read 20 web pages and summarise them**: Sonnet `medium` sub-agents to read, final synthesis in the session.
- **A quick question about the code or a one-line fix**: no evaluation, just answer.
