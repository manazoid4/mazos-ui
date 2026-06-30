# MazOS Local Cockpit Postmortem — UX + Implementation Audit

Date: 2026-06-30  
Repo: `C:/Users/manaz/Projects/mazos-ui`  
Scope: pre-redesign audit of Local Cockpit UX, routes, data flows, action model, dashboard usefulness.

## Executive summary

MazOS Cockpit is directionally right: local command centre, dark “Jarvis” dashboard, repo/vault/Recall actions, safe allowlisted commands. Current implementation still feels like a developer debug panel wrapped in polished UI.

Main failure: the dashboard reports machine facts, not useful decisions. It tells Maz what is online/offline, dirty/clean, stdout/stderr, paths/scripts. It rarely answers: “what should I do next, why, from which source, with what confidence?”

Redesign should keep the single cockpit page but shift cards from raw telemetry → interpreted intelligence.

Principle: fewer buttons, more useful summaries.

## Current state

### Main UI

File: `src/app/page.tsx`

Sections:
- topbar mission/repo/offline counters
- “What should I do now?”
- Service Radar
- Today’s Execution
- Recall Ingest
- Vault / Memory
- Repo Command Centre
- Action Groups
- Run Console

Strength:
- compact, working app shell
- safe action registry
- useful dark cockpit visual base
- already has Recall ingest + vault scan + repo scan concepts
- client-side refresh combines `/api/mazos`, `/repos`, `/health`, `/runs`

Weakness:
- too many undifferentiated actions
- output-oriented, not decision-oriented
- logs/stdout dominate usefulness
- cards do not summarize “meaning”
- action groups repeat repo buttons
- no clear modal/popup summaries
- “Service Radar” model mismatches user reality

## Major UX findings

### 1. Service Radar makes no sense as currently defined

Files:
- `src/lib/mazos/serviceHealth.ts`
- `config/control-panel.yaml`
- `src/app/page.tsx`

Problem:
- some projects are online but not localhost
- some repos are products, not local daemons
- “offline” reads like broken even when service is deployed, paused, static, or intentionally not running
- mixes dev server health with product availability

Fix:
Replace “Service Radar” with “Project Radar”.

Model:
```ts
type ProjectRadarItem = {
  id: string;
  label: string;
  repoPath?: string;
  localUrl?: string;
  prodUrl?: string;
  githubUrl?: string;
  mode: 'local-dev' | 'deployed' | 'repo-only' | 'vault-only' | 'unknown';
  localStatus?: 'online' | 'offline' | 'not-configured';
  prodStatus?: 'online' | 'offline' | 'unknown' | 'not-configured';
  lastGitActivity?: string;
  dirty?: boolean;
  nextAction: string;
};
```

UX:
- show “Local”, “Live”, “Repo”, “Next”
- never say simply “offline”
- wording:
  - “Local dev not running”
  - “Live site configured”
  - “Repo only”
  - “No URL configured”
- top summary should be:
  - `2 live`
  - `1 local running`
  - `3 repos need review`
not:
  - `3 offline`

### 2. Intake needs proper “source capture”, not URL textarea

Files:
- `src/app/page.tsx`
- `src/app/api/mazos/ingest/route.ts`

User need:
- Instagram
- YouTube
- X
- PDFs
- cleaner process
- researched/emulated behavior

Better workflow:
1. Paste/drop source
2. Auto-detect source
3. Show detected type + expected capability
4. Choose intent:
   - Save to Recall
   - Summarize
   - Extract tasks
   - Research/emulate
   - Add to Obsidian
5. Process or queue
6. Show clean result card:
   - title
   - source
   - summary
   - extracted prompts/patterns/tasks
   - saved location
   - failures

Add source types:
```ts
type IntakeSourceType =
  | 'youtube'
  | 'instagram'
  | 'x'
  | 'pdf'
  | 'webpage'
  | 'text'
  | 'unknown';
```

MVP PDF support:
- UI: file input + URL path
- Backend: one multipart route using `request.formData()` + `File.arrayBuffer()`
- queue PDF with explicit `sourceType:'pdf'`
- do not fake extraction until parser exists

### 3. Vault / Memory must open clear popups with summarized content

Files:
- `src/app/page.tsx`
- `src/lib/mazos/commandRegistry.ts`

Problem:
- user expects clicking Vault/Memory buttons to reveal useful summarized content
- current “Latest files” path dump is not memory
- raw result in console feels boring/technical

Fix:
Create modal/detail drawer state:
```ts
const [modal, setModal] = useState<{title:string; body:string; kind:string} | null>(null);
```

Each Vault/Memory button should open a popup with:
- Summary
- Top active projects
- Open tasks
- Decisions
- Useful prompts/work patterns
- Source files
- Copy prompt / copy summary

### 4. Repo cards/action groups should stop dumping logs

Files:
- `src/app/page.tsx`
- `src/lib/mazos/repoScanner.ts`
- `src/lib/mazos/runCommand.ts`
- `src/lib/mazos/logStore.ts`

Fix:
Repo cards should show interpreted state:
- `Ready`
- `Needs commit`
- `Build failing`
- `Missing config`
- `No local repo`
- `Deploy/live unknown`

Each card should have:
- Status summary
- last meaningful activity
- top risk
- next best action
- “Ask specialist” button

Specialized agent concept:
- button does not dump logs
- button creates or opens a specialist prompt/result:
  - Repo Scout
  - Vault Scout
  - Recall Intake Scout
  - JobFilter Money Scout

### 5. Action Groups are too broad

File:
- `src/lib/mazos/commandRegistry.ts`

Current categories:
```ts
['Execute','Repos','Recall','JobFilter','Obsidian','System']
```

Problem:
- too many similar prompt buttons
- unclear which buttons do work vs copy prompts
- “manual prompt” actions are logged like completed runs
- user sees fake productivity

Fix:
Separate action types visually:
- Instant
- Opens popup
- Copies prompt
- Runs command
- Queues work

Add `displayMode`:
```ts
type ActionDisplayMode = 'primary' | 'secondary' | 'hidden' | 'modal' | 'copyPrompt' | 'command';
```

### 6. “Run Console” should be hidden/debug, not primary

File:
- `src/app/page.tsx`

Problem:
- useful for developer debugging, not dashboard
- reinforces log dumping
- takes major visual space
- raw JSON from ingest appears as product output

Fix:
- collapse into “Debug drawer”
- default card should be “Latest Result” with interpreted summary
- stdout/stderr only under `Details`

### 7. Current “What should I do now?” is too shallow

File:
- `src/app/page.tsx`

Fix:
Use project/memory summary:
- if active Obsidian tasks exist → show top task
- if intake queue has items → process capture queue
- if dirty repo + no report → summarize changes
- if Recall ingest missing PDF/X → ship intake support
- if no context → ask for mission

## Implementation findings

### Good choices

- Safe allowlisted command registry exists.
- `spawn` uses `shell:false`.
- No arbitrary shell exposed.
- Run logs append to JSONL.
- Repo scanner avoids heavy operations.
- UI is one page; good for cockpit.
- CSS already gives polished dark cockpit base.

### Problems

#### Hardcoded paths/ports

Files:
- `src/lib/mazos/paths.ts`
- `src/lib/mazos/serviceHealth.ts`
- `src/app/api/mazos/route.ts`

Fix:
- use `config/control-panel.yaml` as source of truth
- expose parsed config via `src/lib/mazos/config.ts`
- remove duplicate hardcoding where possible

#### Prompt actions logged as successful runs

File:
- `src/lib/mazos/runCommand.ts`

Copying a prompt is not completing work. This pollutes run history.

Fix:
- add `kind:'prompt'|'command'|'scan'|'ingest'`
- only command/ingest results in “run history”
- prompts go to “Prompt Library” or modal

#### Vault scan counts are misleading

File:
- `src/lib/mazos/commandRegistry.ts`

Problem:
- stops traversal by arbitrary count
- result says `count` but really partial capped scan
- latest files depend on traversal order before sorting

Fix:
- either say `capped:true, cap:200`
- or collect all md metadata with safer cap/time limit
- better: targeted memory files only for dashboard

#### Ingest direct/queued accounting bug risk

File:
- `src/app/api/mazos/ingest/route.ts`

Fix:
- track failed items exactly, not whole direct groups

#### UI error handling weak

File:
- `src/app/page.tsx`

Fix:
- small `api()` wrapper returning `{ok,data,error}`
- show top-level degraded state

#### Accessibility

Fix:
- add visible labels or `aria-label`
- status text with icon/color, not color only
- modal focus trap if adding popup

## Redesign target

Jarvis-style useful local cockpit:
- polished
- calm
- decisive
- summarizes local work
- captures sources
- surfaces memory
- sends specialist agents/prompts
- hides boring logs

Not:
- server monitor
- raw git dashboard
- shell console
- giant action grid

## Recommended page layout

1. Top command strip
   - mission
   - current recommendation
   - capture button
   - memory button

2. Project Radar
   - Recall
   - JobFilter
   - MazOS
   - OpenFlowKit
   - Obsidian
   - each: Local / Live / Repo / Next

3. Capture Inbox
   - URL/PDF/Text
   - detected source
   - intent
   - result summary

4. Memory Snapshot
   - active tasks
   - decisions
   - useful prompts/patterns
   - source links
   - opens modal

5. Specialist Agents
   - Repo Scout
   - Vault Scout
   - Intake Scout
   - Money Scout
   - each returns summary card/modal

6. Debug drawer
   - runs
   - stdout/stderr
   - JSON
   - hidden by default

## Concrete file plan

Add later:
- `src/lib/mazos/config.ts`
- `src/lib/mazos/projectRadar.ts`
- `src/lib/mazos/sourceDetect.ts`
- `src/lib/mazos/memorySummary.ts`
- `src/lib/mazos/specialists.ts`
- `src/app/api/mazos/project-radar/route.ts`
- `src/app/api/mazos/memory/summary/route.ts`
- `src/app/api/mazos/specialist/route.ts`

YAGNI note:
- Do not add component split unless `page.tsx` becomes painful.
- Do not add real agent runtime yet.
- Start with deterministic local reports + copyable prompts.

## Acceptance criteria for redesign

- Dashboard answers “what now?” in first viewport.
- No primary card dumps stdout/stderr.
- “Offline” never shown for a project without clarifying local/prod/repo context.
- Intake supports YouTube, Instagram, X, PDF at UI/model level.
- Unsupported sources queue with clear reason.
- Vault/Memory buttons open summary popup.
- Repo card has next action, not just scripts.
- Debug logs hidden behind details/drawer.
- Every button either:
  - performs visible useful action
  - opens modal
  - copies prompt with confirmation
  - is disabled with reason

## GitHub placement

This report belongs at:

`research/mazos/MAZOS_LOCAL_COCKPIT_POSTMORTEM.md`
