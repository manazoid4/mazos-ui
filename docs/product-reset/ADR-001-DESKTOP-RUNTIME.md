# ADR-001: MAZos desktop runtime

- Status: **Accepted provisionally; implementation requires a packaging spike**
- Date: 2026-07-23
- Tracking: #53

## Context

MAZos currently combines:

- Next.js client pages;
- Next.js route handlers that access local files, Git, PowerShell and Hermes state;
- a localhost proxy used by the hosted page;
- a Tauri static export;
- two Rust Git commands.

The static desktop build removes the route handlers, while the client continues to depend on them. Porting the complete orchestration surface to Rust immediately would duplicate substantial working TypeScript logic and increase migration risk.

## Decision

Use this target architecture:

```text
Tauri desktop shell
  -> authenticated local MAZos service supervised by Tauri
      -> existing TypeScript domain/orchestration modules
      -> workspace registry
      -> SQLite/event state
      -> registered subprocess adapters
      -> Agent Nudge / Hermes / repositories
```

The browser UI must call one typed MAZos client:

```text
MAZos client
  -> desktop adapter: authenticated local service
  -> hosted adapter: redacted/read-only remote data or unavailable state
```

Components must not call `/api/mazos/*` directly.

## Why this option

- It preserves the working TypeScript loop, decision, action and evidence logic.
- It avoids a high-risk full Rust rewrite before product usefulness is proven.
- It provides a single backend boundary for Tauri packaging.
- It supports process supervision, cancellation and event streaming.
- It keeps the hosted surface separate from unrestricted local control.

## Packaging spike

Before migration, prove a minimal service can:

1. be packaged with the Windows installer;
2. start under Tauri supervision;
3. bind only to loopback or use a local IPC transport;
4. require an ephemeral authentication token;
5. expose `/health` and one read-only project endpoint;
6. stream one event to the UI;
7. stop cleanly when the app exits;
8. recover from a crashed service;
9. produce no extra console window;
10. pass installation from a clean clone/CI artifact.

## Security requirements

- Non-null CSP.
- No arbitrary shell strings from the renderer.
- Workspace paths selected from a confirmed registry.
- Structured command arguments.
- Loopback-only binding if HTTP is used.
- Ephemeral token created by the shell and passed out-of-band.
- Redaction before persistence.
- Explicit approval before external, destructive, financial or credential-sensitive actions.
- No hosted page may directly execute local actions.

## Consequences

### Positive

- Fastest route to preserving existing capability.
- TypeScript remains the primary product/domain language.
- Rust remains a narrow security and lifecycle shell.
- Desktop and hosted modes can have honest, distinct permissions.

### Negative

- The installer must package and supervise a runtime/service.
- Process lifecycle and update compatibility require dedicated tests.
- Existing Next route handlers must be refactored into reusable domain functions rather than imported as HTTP handlers.

## Rejected alternatives

### Continue static export plus a few Tauri commands

Rejected because it creates a permanently split implementation and leaves most features absent.

### Full Rust rewrite now

Rejected because it duplicates the current engine before the product workflow and desktop packaging are validated.

### Hosted Vercel dashboard controlling localhost bridge

Rejected as the authoritative desktop architecture because browser-to-local control is brittle and expands the trust boundary.
