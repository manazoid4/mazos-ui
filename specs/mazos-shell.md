# SPEC — MAZos Shell (v3)

Source: handwritten sketch, 2026-07-26. Grounded against `mazos-ui@69c1666` (v2 Loop Cockpit,
Tauri desktop) and `agent-nudge@7356f14` (v0.5.1). Contract for `/build` and `/review`.

**Working copy: `C:\Users\manaz\Projects\mazos-fresh`.** `Projects\mazos-ui` is a stale
checkout of the same repo, 2 commits behind — do not build there.

**MAZos is a Tauri v2 Windows desktop app** as of commit `e25454d` (2026-07-22): `src-tauri/`,
identifier `com.manaz.mazos`, WebView2 shell over the same Next.js frontend. `devUrl` is
localhost:3046; `frontendDist` is `../out`. Consequences for this spec:

- Every panel below still renders in the desktop shell — the frontend is unchanged.
- The theme toggle must persist somewhere the desktop build can read; `localStorage` works in
  WebView2, so no Tauri store dependency is needed.
- Browser-driven verification (`dogfood_mazos`) can only drive `npm run dev` on :3046. The
  packaged WebView2 build exposes no CDP endpoint, so no shipped-app browser automation.
- `nudgeClient` calling `127.0.0.1:47831` is *easier* in the desktop build than in the hosted
  one — no browser CORS/mixed-content constraint — but must still fail open for the Vercel
  mirror, where the daemon is unreachable.

## 1. Thesis

v2 MAZos answers **"what ships next in my businesses"**. The sketch answers a different
question: **"what is my agent workforce doing, what can it do, and what does it know"**.

The sketch is not a replacement. It is a **shell around the loop kernel**:

```
LEFT   = capability   what can the agent do, what did it leave half-done
CENTRE = work         loops (kernel) + knowledge feeding them
RIGHT  = context      live sessions, imports, starting prompts
```

Loop Dashboard sits centre in the sketch. That is deliberate: the loop stays the kernel.
Everything new either **feeds** a loop or **starts** one. Any panel that does neither is cut.

### Non-goal

The sketch omits Ship Next / Decisions / Shipped. Those are **not** deleted — they fold into
the centre column beneath Loop Dashboard. `STATE.md` is explicit: every MAZos hour must
defend itself against a FlowLens hour. A shell that hides "what ships next" fails that test.

### Relationship to prior specs

- `mazos-ui-declutter.md` (5 tabs) and `mazos-next-stage.md` (5 tabs) — **superseded**. The
  shipped v2 rebuild collapsed navigation to a single page; the sketch keeps one page and
  goes to three columns. Tabs do not return.
- `mazos-light-redesign.md` — **partially contradicted**. That spec says *"No toggle — dark
  theme is removed, light is the only theme."* The sketch draws an explicit dark/light
  toggle. See §3 Design; this needs one human ruling before §4 item 1 ships.

## 2. Feature allocation (MAZos vs Agent Nudge)

Agent Nudge already owns the session, task, and context primitives. Do not rebuild them.

| # | Sketch box | Home | Existing code |
|---|---|---|---|
| 1 | Skills enabled | MAZos | none — new |
| 2 | Agent tasks · Run now | MAZos UI | `agent-nudge:core/task-graph.ts` `assuranceTaskSchema` (states incl. `active`, `blocked`, `claimed`) |
| 3 | Finish/scan uncompacted session | **Agent Nudge** (new feature A) | `detectAbandonedTasks`, `previewRestore` (`core/checkpoints.ts`) |
| 4 | Dark / light toggle | MAZos | hardcoded at `src/app/page.tsx:122` |
| 5 | Loop Dashboard | MAZos | `loopEngine.ts` — ships already |
| 6 | Knowledge update | MAZos | `contextPack.ts`, local-knowledge MCP, obsidian vault |
| 7 | Sessions open / recently closed / count | **Agent Nudge** data → MAZos render | `GET /sessions`, `liveSyncStatus`, `toPeerPresence`, `ACTIVE_SESSION_TTL_MS` |
| 8 | Import YouTube / Instagram | MAZos | `youtube-*`, `transcript` skills |
| 9 | Default Prompts ← *"provided by agent nudge"* | **Agent Nudge** (new feature B) | `POST /v1/compile`, `buildContextPack`, `/v1/runners` |

Boxes 3 and 9 follow the sketch's own label: *"curated provided by agent nudge"*. Both are
specified in `agent-nudge/docs/SESSION-START-ASSURANCE.md`.

## 3. Perspectives

### Product
One job: **cut the cost of starting or resuming agent work.** Every panel is measured against
seconds-to-productive-agent. Skills = what it can do. Sessions = what's live. Recovery = what
was lost. Prompts = how to start. Knowledge = what it should read.

### Architecture
MAZos gains a third upstream. It already speaks local `:3046` and bridge `:3047`; add
`:47831` (Agent Nudge daemon, authenticated — the daemon authenticates every request per
`agent-nudge/docs/ARCHITECTURE.md`). One new module `src/lib/mazos/nudgeClient.ts`; no other
file learns the daemon exists. **Fail open**: nudge offline degrades the right column to
"nudge offline" and never blocks loop work — matching Nudge's own failure doctrine.

### Security
- **Transcript rule.** `agent-nudge/AGENTS.md` forbids transcript capture. The
  uncompacted-session scanner therefore gets **two separate implementations, never shared**:
  MAZos reads the user's own `~/.claude/projects/*/*.jsonl` locally (personal tool, own
  machine, nothing transmitted); Agent Nudge reads only its own task ledger and checkpoints.
  Merging them breaches the product's stated privacy promise. Do not merge.
- **Skills toggle writes config.** Mutating `~/.claude/settings.json` runs through
  `commandRegistry` with a rendered diff and explicit confirm. No silent writes.
- **Run now** executes allowlisted `commandRegistry` actions only. Never free-form spawn.
  `runCommand.ts` stays the single exec surface (`ARCHITECTURE.md`: "Nothing else executes
  anything").
- **Instagram** stores no credentials. Manual export/paste only. The sketch's own margin note
  reads "safe secure way". Ship last, or not at all.

### Design
Visual direction has three entries on record; the sketch resolves two of them:
1. Sketch margin: *"gorgeous. Emulate ___"* → **YouMind**, corroborated by
   `specs/mazos-light-redesign.md` ("YouMind-inspired") and
   `agent-nudge/YOUMIND-PORTFOLIO-SYNTHESIS.md`.
2. `mazos-light-redesign.md` — light-only, toggle removed. **Sketch contradicts this** with an
   explicit dark/light switch. One ruling needed (§5.1).
3. `agent-nudge/MAZ-MODE-BUILD-PLAN.md` — DeWalt navy/amber industrial, which
   `agent-nudge/PRODUCT.md` lists as an anti-reference. That conflict is Agent Nudge's to
   settle and does not block MAZos.

Until §5.1 is answered, build structure, not skin. The toggle is the prerequisite for either
outcome, so it ships first regardless.

### Loop discipline
`STATE.md`: the v2 dogfood gate has **never run** (0 of 5 Daily Triage iterations). Building a
shell before the acceptance test passes is exactly the drift `LOOP.md` §14 warns about.
Resolution: **every shell item below ships as a gated loop with a registered verify action.**
The shell build then *is* the dogfood evidence. One rebuild, two problems closed.

### Commercial
MAZos is £0 personal tooling permanently. Agent Nudge carries five paid tiers. Sellable work
belongs in Nudge. Per `MAZ-MODE-BUILD-PLAN.md`, never gate the core: Prompt Supply free,
history and multi-repo Pro.

## 4. Build order

Each item is a MAZos loop with a verify action. No item starts without one.

| # | Item | Verify | Depends |
|---|---|---|---|
| 1 | Theme toggle (dark/light, persisted, replaces `page.tsx:119` hardcode) | `verify_mazos` + both themes render at AA contrast | §5.1 |
| 2 | `nudgeClient.ts` + Sessions panel (open / recently closed / live count) | daemon reachable; panel degrades cleanly when offline | nudge auth token |
| 3 | Skills panel — enumerate skill sources under `~/.claude`, list + last-fired | listed count matches disk count | — |
| 4 | Unfinished-work scanner (MAZos-local transcript read) + Run now | finds a seeded stub task; Run now only fires allowlisted actions | — |
| 5 | Three-column shell; existing four v2 zones fold under centre | every v2 zone still reachable, no data-loading regressions | 1–4 |
| 6 | Knowledge intake (link / github / screenshot) | ingested item retrievable through local-knowledge | — |
| 7 | Default Prompts panel — consumes Nudge Prompt Supply | prompt renders from live daemon, falls back to local library | Nudge feature B |
| 8 | YouTube import | transcript lands in knowledge store | 6 |
| 9 | Instagram import | **gated — blocked on §5.4** | 8 |

## 5. Open decisions (human)

1. **Theme.** Sketch draws a dark/light toggle; `mazos-light-redesign.md` says light-only, no
   toggle. *Recommend: honour the sketch — ship the toggle, default light, keep dark. Amend
   the light-redesign spec rather than the sketch.*
2. **Route.** Does the shell replace `/` or ship at `/shell` until proven?
   *Recommend `/shell`, promote after the dogfood gate passes.*
3. **Agent Nudge v0.5 theme.** Adopt "Session Start Assurance" (features A + B) over the
   parked "Perspective-Aware Routing" in `agent-nudge-v05-plan.md`?
   *Recommend yes — MAZos dogfoods it on day one, which the routing direction cannot claim.*
4. **Instagram auth.** No safe mechanism identified. *Recommend: manual data-export upload
   only, or cut box 8's Instagram half entirely.*
