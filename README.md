# MAZos

MAZos is Maz's local operator console for prioritising project work, defining bounded agent runs, approving risky actions, verifying outcomes and preserving evidence.

## Current status

### Web/local development mode

The full application runs as a Next.js 16 App Router application. Its route handlers read local repository, loop, decision, run, Hermes and vault state.

```bash
npm install
npm run dev
```

The development server listens on port `3046`.

### Windows desktop mode — packaged architecture implemented

The repair branch packages two coordinated parts in one Tauri installer:

1. a static frontend served by the Tauri webview;
2. a complete Next.js standalone backend containing the existing `/api/mazos/*` runtime.

Tauri starts the backend on a random loopback port, creates an ephemeral token, redirects MAZos API requests through a pre-mount desktop adapter and stops the supervised child process when the application exits. The backend stores writable runtime data beneath the application-local data directory rather than its read-only installation resources.

Desktop controls include:

- authenticated `/api/mazos/*` access;
- allowed Tauri origins and CORS preflight handling;
- non-null Content Security Policy;
- validated workspace registry;
- Git access through registered workspace IDs rather than arbitrary renderer paths;
- visible backend-start failure instead of silently missing panels.

The Windows pull-request workflow has proved:

- unit tests;
- TypeScript check;
- web build;
- Rust check;
- strict desktop architecture contract;
- standalone frontend/backend asset generation;
- authenticated backend smoke test;
- unauthenticated request rejection;
- EXE and MSI installer generation;
- artifact upload.

This is strong CI and headless-runtime evidence, but **the installed graphical application still requires the manual acceptance matrix in `docs/product-reset/DESKTOP_ACCEPTANCE_MATRIX.md` before merge or release.**

```bash
npm run tauri:dev
npm run tauri:build
```

`tauri:dev` uses the Next.js development server. Release confidence comes from the Windows packaging workflow plus an installed-artifact test with all unbundled services stopped.

## Product areas

- **Priority and project status** — rank work and expose blockers.
- **Bounded runs** — define goals, verification and stopping conditions.
- **Decisions** — pause agents for human approval.
- **Evidence** — collect build, test, diff, commit and run results.
- **Hermes controls** — inspect configured profiles and local capabilities.

## Repository boundaries

MAZos coordinates other projects but does not absorb them:

- Agent Nudge owns cross-agent context, claims and acknowledgement.
- Recall owns personal memory and profile modelling.
- AgentDock owns the enterprise agent-control product.
- JobFilter, FlowLens and OpenFlowKit remain independent products.
- `mazos-site` remains the public engineering portfolio.

## Verification

```bash
npm test
npm run lint
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run check:desktop
```

Windows-only package checks:

```bash
npm run build:desktop
npm run smoke:desktop-backend
npm run tauri:build
```

## Desktop repair programme

- Tracking issue: `#53`
- Draft PR: `#54`
- Truth audit: `docs/product-reset/DESKTOP_RUNTIME_AUDIT.md`
- Installed-app matrix: `docs/product-reset/DESKTOP_ACCEPTANCE_MATRIX.md`
- Architecture decision: `docs/product-reset/ADR-001-DESKTOP-RUNTIME.md`
- Repair branch: `agent/mazos-desktop-runtime-repair`

No `v1.0.1` release should be created until Maz installs the CI artifact and the independent acceptance matrix confirms the graphical app works with no development server or separate bridge running.
