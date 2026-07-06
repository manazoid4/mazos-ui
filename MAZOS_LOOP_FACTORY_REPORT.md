# MAZos Loop Factory Report

Date: 2026-07-06
Branch: `agents/loop-factory`
Base: `origin/main` at `e79defd`

## What changed

- Added a Loop Factory design spec and implementation plan:
  - `docs/superpowers/specs/2026-07-06-loop-factory-design.md`
  - `docs/superpowers/plans/2026-07-06-loop-factory.md`
- Added pure loop generation/scoring logic in `src/lib/mazos/loopFactory.ts`.
- Added `CUSTOM_LOOPS` path in `src/lib/mazos/paths.ts`.
- Added `POST/GET /api/mazos/loop-factory`.
- Updated `GET/POST /api/mazos/loops` to merge built-in templates with saved custom loops.
- Added a compact Loop Factory panel inside the decluttered `WORK` tab.
- Added focused Node tests in `tests/loopFactory.test.ts`.

## Behavior

Loop Factory turns a plain-English goal into a reusable MAZos loop template. It scores readiness before saving and blocks unsafe drafts from becoming permanent loop-deck noise.

The first generated pattern is `research-intelligence`, designed for competitor/market research loops. It defaults to prompt-first, L1, public/bounded sources, explicit human gates, and source/evidence requirements.

## Persistence

Custom loops are saved locally to:

```text
data/mazos/custom-loops.json
```

Hosted Vercel write failures degrade with `ok:false` instead of crashing.

## Verification

Run:

```powershell
Remove-Item -Recurse -Force .tmp-loop-test -ErrorAction SilentlyContinue
npx tsc --ignoreConfig tests/loopFactory.test.ts src/lib/mazos/loopFactory.ts src/lib/mazos/loopEngine.ts src/lib/mazos/safety.ts src/lib/mazos/handoff.ts src/lib/mazos/paths.ts --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck --ignoreDeprecations 6.0 --types node --outDir .tmp-loop-test
node --test .tmp-loop-test/tests/loopFactory.test.js
npm run lint
npm run build
```

## Notes

- No autonomous execution was added.
- No new top-level tab was added.
- No new dependencies were added.
- Existing generated/local files remain uncommitted.
