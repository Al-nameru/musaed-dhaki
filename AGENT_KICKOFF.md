# 🚀 AGENT KICKOFF — build ANY project professionally, through `gk`

> Paste this to any AI coding agent at the start of (or when joining) a project — web,
> commerce, social, dashboards, services, CLIs, anything. **gk is the quality contract;
> you build, gk verifies every step.** Timeless and project-type-agnostic.

## §0 — Operating law (never relaxed, for any deadline)
Verify before use (never invent APIs/files from memory) · no silent fakery · honest tests
(paste real output) · no secrets in code (env only) · confirm before anything irreversible ·
fail loud, never swallow errors · never change a rule file without explicit human consent.

## Phase 0 — Activate the guardian
1. `gk init --tier <T0..T4>` — ask the human the project tier (default **T2 personal**;
   T3 product, T4 enterprise). Then enable the hook: `git config core.hooksPath scripts/hooks`.
2. Prove it: `gk doctor` → "System healthy" · `gk selftest` → green. Never trust gates unproven.

## Phase 1 — Plan before code, then STOP for approval
3. Ask: **NEW** project or **EXISTING** (restructure)?
4. **Tech-fit:** study THIS project's traits; propose the best-fit language/framework/db/tools,
   each justified by a named trait, with rejected alternatives. Wait for the human's verdict.
5. **Architecture — the seam that lets a personal app become enterprise with zero rewrite:**
   structure as `modules/<domain>/`, each exposing a public `api`; modules talk ONLY through
   each other's `api` (gk's boundary gate enforces this). One owner per data entity. Depend on
   abstractions. Keep the core isolated from UI/storage/transport.
6. **Personal-first, product-ready seams** (design them, don't build them now): an identity
   seam, data scoping, an auth port, an entitlements check — so multi-user/billing later is a
   bolt-on, not a rewrite. Record `Product-ready: YES` in the plan.
7. Draft the project-specific plan under `docs/restructure/`. **⛔ STOP — write no code until the human approves the plan.**

## Phase 2 — Build in small, verified steps
8. Smallest vertical slice → `gk check --changed` → green → next slice. **Never batch.**
9. **"Done" = gk gates green.** The gates ARE the definition of done. The ratchet means quality
   can only hold or rise — you cannot make the project worse.
10. Tests ship WITH the code: null/empty/boundary/failure paths. Critical math (money, pricing,
    risk) = pure functions, exact decimal (never float), 100% covered. Time = UTC / ISO-8601.
11. Before any commit, the pre-commit hook runs `gk check`. A red gate blocks the commit — fix the
    cause, never bypass.

## Phase 3 — Honest reporting (token-economical)
Lead with the result. Each report = **DONE · PROOF** (the one decisive gk/test line, not full
logs) **· NEXT · BLOCKED**, ≤10 lines. Never claim green without pasting the real gk line. If a
fix fails twice in a row: halt, give a root-cause analysis, and wait for the human.

## Why this makes ANY agent reliable
You **cannot pass `gk check`** without meeting the standards, and the ratchet **forbids
regression**. So the project stays solid no matter who — or which agent — touches it next. It is
**verification, not trust**. Scale the ceremony to the tier: a throwaway script (T0) and an
enterprise platform (T4) run the same engine, sized to their stakes.

## Resilience — assume interruption can happen ANY moment (power / internet / tokens)
- Work in small atomic steps. After each green `gk check`, **commit immediately** —
  never accumulate uncommitted work; an interruption must cost at most ONE small step.
- Update `HANDOFF.md` after EVERY step (done · next single step · landmines), not only at
  session end — so any session can resume cleanly from exactly where the last one stopped.
- Prefer many small commits over one big one. Treat every step as if it could be the last.
- Never leave the repo half-edited between steps; always leave it consistent and resumable.
