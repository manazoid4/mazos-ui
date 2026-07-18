# ARCHITECTURE — MAZos v2 Loop Cockpit

## Shape

Next.js app, one page (`/`), one secondary page (`/hermes`), 14 API routes, ~22 lib modules. Local-first on Windows; hosted mirror on Vercel reads local data through a 3047→3046 bridge.

```
Browser (/) ── mazosFetch ──► /api/mazos/* (local :3046, or bridge :3047 when hosted)
                                   │
                     src/lib/mazos/* (fs + git, server-side)
                                   │
        data/mazos/*.jsonl (gitignored)  +  .loops/<id>/ in TARGET repos
```

## Core flow

1. `shippingSpine` (playbooks × projectStatus × git evidence) → Ship Next rows.
2. `loopFactory.generateLoopDraft` gates a goal+repo+verifyAction through `taskScoring` → saved Loop scaffolds `.loops/<id>/{plan.md,criteria.json,progress.md}` in the target repo.
3. `loopEngine` renders PLAN / BUILD prompts (plan-build split); state = fold of `loop-runs.jsonl` events + machine receipts.
4. `loopReceipts.captureLoopRunReceipt` = runAction(verify) + `git log prev..HEAD` + `git diff --shortstat` + criteria hash/tamper check → appended to `loop-receipts.jsonl`.
5. `loops` route refuses `complete` without a passing receipt + all criteria passing. Gates append to `decisions.jsonl`.

## Execution surface

Exactly one: `commandRegistry` allowlist → `runCommand` (spawns without a shell; npm shimmed through `cmd /c` on Windows). Per-repo `verify_*` actions + ~6 ops actions. Nothing else executes anything.

## Key files

- `src/lib/mazos/loopEngine.ts` — Loop type, prompts, state fold, circuit breaker, zombie auto-stop
- `src/lib/mazos/loopReceipts.ts` — machine receipts, criteria tamper detection
- `src/lib/mazos/loopFactory.ts` — draft + gate + scaffold
- `src/lib/mazos/shippingSpine.ts` + `playbooks.ts` — ship-next verdict (FlowLens included)
- `src/lib/mazos/commandRegistry.ts` + `runCommand.ts` — the allowlisted exec surface
- `scripts/mazos-local-bridge.mjs` — origin-allowlisted `/api/mazos/*` proxy
- `scripts/start-mazos-local-stack.ps1` — logon auto-start (prod server when built)
