# MAZos

MAZos is Maz's local operator console for prioritising project work, defining bounded agent runs, approving risky actions, verifying outcomes and preserving evidence.

## Current status

### Web/local development mode

The full application currently runs as a Next.js 16 App Router application. Its route handlers read local repository, loop, decision, run, Hermes and vault state.

```bash
npm install
npm run dev
```

The development server listens on port `3046`.

### Windows desktop mode — experimental shell

The repository contains a Tauri v2 Windows shell and can compile installer artifacts. **The installed desktop build is not yet accepted as a standalone MAZos application.**

The current static desktop export removes the Next.js API routes, while most frontend features still depend on `/api/mazos/*`. The Rust backend currently implements only two Git commands. A successful `.exe` or `.msi` build therefore proves packaging, not complete dashboard functionality.

Do not replace an active MAZos installation or publish another desktop release until the acceptance matrix in `docs/product-reset/DESKTOP_RUNTIME_AUDIT.md` passes with no development server or separate bridge running.

```bash
npm run tauri:dev
npm run tauri:build
```

`tauri:dev` uses the Next.js development server and is not proof that the packaged static application works standalone.

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
```

These checks validate code and compilation. Packaged desktop acceptance additionally requires installation and functional testing with all unbundled servers stopped.

## Desktop repair programme

- Tracking issue: `#53`
- Truth audit: `docs/product-reset/DESKTOP_RUNTIME_AUDIT.md`
- Architecture decision: `docs/product-reset/ADR-001-DESKTOP-RUNTIME.md`
- Repair branch: `agent/mazos-desktop-runtime-repair`

No `v1.0.1` release should be created until independent verification confirms the installed app satisfies the documented acceptance criteria.
