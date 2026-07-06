# Loop Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WORK-tab Loop Factory that generates, scores, saves, and displays reusable MAZos loop templates from plain-English goals.

**Architecture:** Add a pure `src/lib/mazos/loopFactory.ts` module for pattern classification, draft generation, readiness scoring, and flat-file custom-loop persistence. Add `src/app/api/mazos/loop-factory/route.ts` for draft/save calls, update `/api/mazos/loops` to merge built-in and custom templates, and add a compact client panel to `src/app/page.tsx`.

**Tech Stack:** Next.js 16 App Router route handlers, React 19 client component, TypeScript, Node built-in `node:test`, local JSON persistence under `data/mazos`.

---

### Task 1: Pure Loop Factory Module

**Files:**
- Create: `src/lib/mazos/loopFactory.ts`
- Create: `tests/loopFactory.test.ts`
- Modify: `src/lib/mazos/paths.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/loopFactory.test.ts` with Node tests that import `generateLoopDraft`, `scoreLoopReadiness`, and `customLoopId`. Test that a competitor-research goal becomes a `research-intelligence` loop, includes competitor gates, and scores ready.

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
Remove-Item -Recurse -Force .tmp-loop-test -ErrorAction SilentlyContinue
npx tsc --ignoreConfig tests/loopFactory.test.ts src/lib/mazos/loopFactory.ts src/lib/mazos/loopEngine.ts src/lib/mazos/safety.ts src/lib/mazos/handoff.ts src/lib/mazos/paths.ts --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck --ignoreDeprecations 6.0 --types node --outDir .tmp-loop-test
```

Expected: fail because `src/lib/mazos/loopFactory.ts` does not exist.

- [ ] **Step 3: Implement the module**

Define `LoopPatternId`, `LoopFactoryInput`, `LoopFactoryDraft`, `generateLoopDraft()`, `scoreLoopReadiness()`, `customLoopId()`, `readCustomLoops()`, `saveCustomLoop()`, and `allLoopTemplates()`.

- [ ] **Step 4: Run test to verify it passes**

Compile and run:

```powershell
Remove-Item -Recurse -Force .tmp-loop-test -ErrorAction SilentlyContinue
npx tsc --ignoreConfig tests/loopFactory.test.ts src/lib/mazos/loopFactory.ts src/lib/mazos/loopEngine.ts src/lib/mazos/safety.ts src/lib/mazos/handoff.ts src/lib/mazos/paths.ts --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck --ignoreDeprecations 6.0 --types node --outDir .tmp-loop-test
node --test .tmp-loop-test/tests/loopFactory.test.js
```

Expected: pass.

### Task 2: API Routes

**Files:**
- Create: `src/app/api/mazos/loop-factory/route.ts`
- Modify: `src/app/api/mazos/loops/route.ts`

- [ ] **Step 1: Add route handler**

`GET` returns available patterns and custom loop count. `POST` supports `{ action: "draft" }` and `{ action: "save" }`.

- [ ] **Step 2: Merge custom loops into existing deck**

Change `/api/mazos/loops` to use `allLoopTemplates()` instead of `LOOP_TEMPLATES`.

- [ ] **Step 3: Verify API typecheck**

Run `npm run lint`.

Expected: pass.

### Task 3: WORK Tab UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add client types and state**

Add `LoopFactoryDraft`, `LoopPatternId`, and factory state to the page.

- [ ] **Step 2: Add `LoopFactoryPanel`**

Render it in `WORK` directly before the Loop Engineering Deck. Reuse `Panel`, `CopyBlock`, `SafetyBadge`, `.input`, `.ghost`, `.primary`, `.summaryList`, and `.tag`.

- [ ] **Step 3: Wire draft/save**

`Draft Loop` calls `POST /api/mazos/loop-factory` with `action:"draft"`. `Save Template` calls `action:"save"` then reloads loops.

- [ ] **Step 4: Verify browser-independent build**

Run `npm run lint` and `npm run build`.

Expected: both pass.

### Task 4: Documentation and Final Verification

**Files:**
- Modify: `README.md` or add a short feature report.

- [ ] **Step 1: Document the feature**

Add a short `MAZOS_LOOP_FACTORY_REPORT.md` with files changed, behavior, and verification.

- [ ] **Step 2: Final checks**

Run:

```powershell
npm run lint
npm run build
```

Expected: both pass.

- [ ] **Step 3: Commit only scoped files**

Commit the Loop Factory files on `agents/loop-factory`. Do not add `data/`, `tsconfig.tsbuildinfo`, dirty submodule state, or generated vault scan changes.
