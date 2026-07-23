# ADR-001: MAZos desktop runtime

- Status: **Accepted and implemented; CI validated, installed-GUI acceptance pending**
- Date: 2026-07-23
- Tracking: #53
- Draft PR: #54

## Context

The previous desktop conversion combined a static Tauri frontend with Next.js API-dependent pages but removed `src/app/api` from the desktop export. Rust exposed only two Git commands. The installer could compile while most useful panels had no standalone backend.

Porting the complete orchestration surface to Rust would duplicate working TypeScript loop, decision, action and evidence logic.

## Decision

Use this architecture:

```text
Tauri desktop shell
  -> authenticated Next.js standalone backend supervised by Tauri
      -> existing /api/mazos runtime
      -> existing TypeScript domain/orchestration modules
      -> application-local writable state
      -> registered local tools and repositories

Static Tauri frontend
  -> pre-mount desktop fetch adapter
      -> ephemeral token
      -> random loopback backend port
```

Tauri remains the security and lifecycle shell. TypeScript remains the product/domain runtime.

## Implemented controls

- The Windows build creates the standalone Next.js backend before producing the static frontend.
- `node.exe` and standalone server resources are packaged into the installer.
- Tauri chooses a random loopback port and starts the backend itself.
- Tauri creates an ephemeral UUID token and exposes it only through typed IPC.
- Next Proxy protects `/api/mazos/*` with that token and restricts allowed desktop origins.
- A pre-mount frontend adapter redirects existing `/api/mazos/*` calls to the packaged backend.
- Writable data and research output use application-local directories.
- Tauri stops the supervised child process on application exit.
- Backend startup failure is visible instead of silently hiding panels.
- CSP is non-null.
- Workspace configuration is validated and canonicalised.
- Rust Git commands accept registered workspace IDs, not renderer-supplied arbitrary paths.

## CI evidence

The Windows pull-request workflow proved:

1. unit tests;
2. TypeScript check;
3. normal web build;
4. Rust check;
5. strict desktop architecture contract;
6. standalone backend generation;
7. static frontend generation;
8. authenticated API request success;
9. unauthenticated API request rejection;
10. allowed-origin CORS preflight;
11. EXE installer generation;
12. MSI installer generation;
13. installer artifact upload.

## Remaining acceptance work

CI does not prove the installed webview experience. Before merge or release, install the CI artifact on Windows with all unbundled services stopped and complete `DESKTOP_ACCEPTANCE_MATRIX.md`.

Still to test manually:

- installed application launch;
- every visible panel and action;
- no missing API calls in the webview;
- child-process shutdown from the installed app;
- persisted state after restart;
- no extra console window;
- actual installer upgrade/uninstall behaviour.

## Follow-up architecture work

The compatibility fetch adapter intentionally preserves the existing UI while avoiding a rewrite. Components should migrate incrementally to one typed MAZos client. Direct page-local `/api/mazos/*` wrappers are warnings, not the long-term interface.

SQLite/event-state migration, agent process cancellation and deeper action allowlisting remain separate vertical slices; they are not prerequisites for proving the sidecar packaging boundary.

## Security requirements retained

- No arbitrary shell strings from the renderer.
- Workspace paths selected from a confirmed registry.
- Structured command arguments.
- Loopback-only backend binding.
- Ephemeral desktop token.
- Redaction before persistence.
- Explicit approval before external, destructive, financial or credential-sensitive actions.
- No hosted page may directly execute unrestricted local actions.

## Rejected alternatives

### Static export plus a few Tauri commands

Rejected because it leaves most application features absent and creates a permanently split implementation.

### Full Rust rewrite

Rejected because it duplicates the existing engine before product usefulness warrants the cost.

### Hosted dashboard as the authoritative local controller

Rejected because browser-to-local control is brittle and expands the trust boundary.
