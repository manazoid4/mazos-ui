# MAZos Task Gate Report

Generated: 2026-07-04

## Competitor Research Summary

GitHub Copilot coding agent is strong at GitHub-native delegation: assign an issue or prompt, let the agent plan, edit on a branch, run tests, and produce a PR for review. GitHub's newer agent panel makes task launch and progress tracking easier from within GitHub. The gap is that task quality still depends heavily on the human writing a clear issue/prompt before launch.

Claude Code is strong at local project memory, permissions, hooks, and session lifecycle controls. Its memory docs explicitly separate contextual memory from enforceable policy, and hooks can act as deterministic lifecycle checks. The gap is that a user can still start a vague session unless they install and maintain their own preflight policy.

OpenHands is strong on sandboxed execution and lifecycle boundaries. Its Docker sandbox pattern is useful for isolating risky execution from the host. The gap for Maz is that it is not tuned to local Windows repo/vault reality, personal project priorities, or "should I launch this session at all?"

Aider is strong at terminal-first coding with lint/test integration after edits. It can run checks and iterate on failures. The gap is that validation generally happens after an agent has already started editing.

AGENTS.md-style project instructions are useful because they give agents predictable repo context. The gap is that they are static guidance, not an active gate that scores a proposed task against current repo state and personal priorities.

## Gaps MAZos Beats

- Competitors launch vague tasks too easily.
- Success criteria are often absent or implied.
- Safety constraints are scattered across settings, docs, and user memory.
- Dirty repo state is not always surfaced before task launch.
- Validation commands are usually discovered after work begins.
- Personal product priority is weak: generic agents do not know JobFilter money tasks should outrank cosmetic MAZos polish.

## What Was Built

MAZos now has an Agent Task Gate and Mission Planner:

- `/sessions` page for preflight task validation.
- `POST /api/mazos/task-gate` to score a proposed agent task.
- `GET /api/mazos/task-gate` to fetch repo options and latest gate result.
- `POST /api/mazos/mission-plan` to turn rough tasks into launch-ready Hermes missions.
- Task score from 0 to 100.
- Risk levels: `safe`, `caution`, `danger`.
- Prompt repair for vague or incomplete tasks.
- "Research First" toggle.
- "Make Smaller" split into inspect/research, implement core, and test/docs/report sessions.
- Default forbidden actions when the user leaves them blank.
- Append-only gate history and saved mission plans.

## Changed Files

- `src/lib/mazos/taskScoring.ts`
- `src/lib/mazos/taskGate.ts`
- `src/lib/mazos/missionPlanner.ts`
- `src/app/api/mazos/task-gate/route.ts`
- `src/app/api/mazos/mission-plan/route.ts`
- `src/app/sessions/page.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `README.md`
- `MAZOS_TASK_GATE_REPORT.md`

## API Routes

- `GET /api/mazos/task-gate`
- `POST /api/mazos/task-gate`
- `POST /api/mazos/mission-plan`

## UI Changes

- Added `TASK GATE` button to the main MAZos dashboard.
- Added `/sessions` route titled `Agent Task Gate`.
- Added repo selector, task field, success criteria, forbidden actions, agent selector, mode selector, Research First toggle, validation options, score/risk display, blockers/warnings, generated prompt, 3-session split, and mission plan preview.

## Safety Decisions

- The gate does not execute agents.
- `Start Session if Approved` copies the prompt only.
- Missing forbidden actions are replaced with strict defaults.
- Dangerous tasks are blocked.
- Missing repos are blocked.
- Dirty repos warn instead of blocking.
- Broad tasks are split into smaller sessions.
- Validation commands are suggested, not executed by the gate.
- Existing `allow_shell: false` config means this feature remains prompt-first.

## Test Results

- `npm run lint` passed.
- `npm run build` passed.
- `GET http://127.0.0.1:3046/sessions` returned 200.
- `POST http://127.0.0.1:3046/api/mazos/task-gate` returned an approved safe gate result with score 91 for a scoped MAZos task.
- `POST http://127.0.0.1:3046/api/mazos/mission-plan` generated and saved a mission plan markdown file.

## Next Improvements

1. Connect Task Gate to the future Hermes Session Manager so an approved prompt can be passed into a controlled session launcher.
2. Add project-specific priority weights from Shipping Spine so gate scoring reflects live commercial urgency.
3. Add gate-to-flight-recorder receipts so every approved/rejected launch has a durable audit trail.
