# MAZos Desktop Runtime Truth Audit

Status: **repair required before v1.0.1**  
Tracking issue: #53  
Branch: `agent/mazos-desktop-runtime-repair`

## Executive finding

The repository contains a valid Tauri v2 shell and can produce Windows installer artifacts, but the packaged application is not yet proven to be a standalone MAZos desktop application.

The desktop export removes `src/app/api`, while the frontend still relies on `/api/mazos/*` for the main dashboard, loops, decisions, runs, projects, Hermes profiles, Toolkit and statistics. The Rust backend currently exposes only `git_status` and `git_log_recent`.

A successful compiler exit therefore proves packaging, not product functionality.

## Evidence map

| Area | Current implementation | Packaged desktop implication | Status |
|---|---|---|---|
| Main frontend | Calls `/api/mazos/*` and retains the localhost bridge path | Static export has no Next API server | Broken/unproven |
| Desktop build | Temporarily moves `src/app/api` outside the app, then runs static export | All server route handlers disappear from the bundle | Confirmed |
| Tauri IPC | `git_status`, `git_log_recent` | Covers only a small subset of displayed features | Incomplete |
| Toolkit | Client fetches `/api/mazos/toolkit`; route uses a hard-coded profile fallback and curated skill list | Route is absent in static export | Broken/unproven |
| Statistics | Client fetches `/api/mazos/stats`; route returns null values | Route is absent in static export; metrics are placeholders | Broken/unproven |
| Hermes profiles | Implemented through Next API handlers | No equivalent packaged backend command | Broken/unproven |
| Loop engine | Implemented through Next API handlers and local files | No equivalent packaged backend command | Broken/unproven |
| Decisions | Implemented through Next API handlers and local files | No equivalent packaged backend command | Broken/unproven |
| Actions/triage | Node/PowerShell execution through Next API handlers | No complete Tauri equivalent | Broken/unproven |
| Security | Tauri CSP is null; renderer can supply Git working directories | Missing least-privilege boundary | Repair required |
| v1.0.0 workflow | Tag predates workflow correction and targets only NSIS EXE | Release claim exceeds tagged workflow | Incorrect release state |
| Visual redesign | Existing committed CSS remains light, purple, gradient-heavy and rounded | Claimed dark/yellow redesign is absent | Not implemented |

## Product acceptance requirement

An installed build must be tested with all of the following stopped:

- Next.js development server;
- MAZos localhost bridge;
- any manually launched Node process;
- any unbundled helper service.

The build passes only when the installed app can:

1. launch and show an explicit runtime status;
2. load registered projects;
3. show repository health;
4. load loops;
5. load decisions;
6. load recent runs and evidence;
7. execute only registered safe actions;
8. show Toolkit data with honest semantics;
9. show real statistics or a clear unavailable state;
10. open Hermes profile controls where supported;
11. display failures rather than silently hiding panels;
12. cancel child processes;
13. close without leaving processes running;
14. reopen with persisted state;
15. produce no missing `/api` route errors.

## Architecture decision required

The current mixed model must be replaced by one coherent desktop backend:

### Candidate A — packaged TypeScript service

Reuse the existing TypeScript orchestration and route logic behind a packaged, authenticated local service supervised by Tauri.

### Candidate B — complete Rust backend

Port every required local capability to typed Tauri commands and remove dependence on Next route handlers.

The provisional recommendation is Candidate A because the current useful engine is already Node/TypeScript-heavy. A small proof must validate packaging, authenticated IPC, event streaming, cancellation and clean shutdown before migration begins.

## Safety decisions

Until the runtime passes the acceptance matrix:

- do not replace the active local MAZos directory;
- do not describe the desktop build as complete;
- do not publish `v1.0.1`;
- do not retag `v1.0.0`;
- do not merge this repair branch;
- do not use compilation alone as verification.
