# 🔧 REBUILD GUIDE — modernize ANY legacy project, safely, through `gk`

> هذا دليل عام مولّد من GK. خطة Smart Assistant التنفيذية موجودة في
> `docs/restructure/SMART_ASSISTANT_RESTRUCTURE_PLAN.md`.

> For **existing large / old / complex** projects of any kind. Pair with `AGENT_KICKOFF.md`.
> The mechanism: **baseline the mess → lock behaviour with characterization tests → let gk's
> ratchet make quality MONOTONIC**. The project can only get more modern, never regress.

## The law of legacy
Never "improve and break". Every change is **parity-proven** (behaviour identical) and
**gate-green**. The ratchet is the seatbelt: it forbids regression while you modernize.

## Phase 0 — Inventory (capture reality; don't pretend it's clean)
1. `gk init --tier <T>` → `gk baseline` (use `--coverage`). The baseline records the CURRENT
   (bad) numbers — e.g. 200 warnings, 58% coverage, complexity hotspots. **That is your floor,
   not zero.** From here, quality may only hold or rise.
2. X-ray the system with `gk check`: file sizes, complexity findings, **boundary violations**
   (cross-module tangles), the data owners.
3. Spot the seams: where can `modules/<domain>/api` boundaries be drawn?

## Decision — the three roads (record as `docs/adr/ADR-001`)
| Road | Choose when |
|---|---|
| **R1 · refactor-in-place** | code is salvageable; tests exist or can be added. **Default.** |
| **R2 · strangler** | too risky to change in place — grow a new modular side behind a façade, route traffic module-by-module, then delete the old. |
| **R3 · rewrite** | only when the core is irrecoverable AND the spec is well understood. Highest risk — justify hard, never the reflex. |

## Phase 1 — Characterization tests BEFORE any change
4. Lock current behaviour with tests (golden/approval tests for messy code). **No refactor
   begins without a net** — these are your parity oracle.

## Phase 2 — Modernize monotonically
5. Smallest safe slice: extract one `modules/<domain>/api`, move logic behind it, leave a
   façade (strangler). `gk check --changed` must stay parity-green; the ratchet drives
   warnings down, coverage up, complexity down — **never up**.
6. Re-snapshot the floor (`gk baseline`) only AFTER a genuine improvement — the ratchet then
   holds the new, better floor. Quality climbs and locks, one verified step at a time.
7. **Parity-proven cutover:** switch callers to the new `api` only when characterization tests
   pass on both old and new paths. Then delete the old path.

## Phase 3 — Done = modern & solid
Boundaries clean (boundary gate = 0) · complexity capped · coverage at/above floor · 0 errors ·
the ratchet guarding it all. The legacy is now a **modular, tested, contemporary** codebase that
can scale to enterprise (T3/T4) **without another rewrite**.

## Why gk makes this safe, not heroic
You **cannot regress** (ratchet) and you **cannot drift the architecture** (boundary gate).
Modernization becomes a sequence of small, verified, forward-only steps — doable by any agent,
on any project type, of any size.

## Resilience — assume interruption can happen ANY moment (power / internet / tokens)
- Work in small atomic steps. After each green `gk check`, **commit immediately** —
  never accumulate uncommitted work; an interruption must cost at most ONE small step.
- Update `HANDOFF.md` after EVERY step (done · next single step · landmines), not only at
  session end — so any session can resume cleanly from exactly where the last one stopped.
- Prefer many small commits over one big one. Treat every step as if it could be the last.
- Never leave the repo half-edited between steps; always leave it consistent and resumable.
