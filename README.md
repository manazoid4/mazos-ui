# MazOS Cockpit

The command center for Maz's automated workflows, loops, and systems.

## Dual Architecture

MazOS is built as a **Next.js 16 (App Router)** application that runs in two modes:

1. **Web Dashboard (Vercel)**: Hosted version accessible from anywhere. Proxies local data via a Node.js bridge when on your home network.
2. **Windows Desktop App (Tauri v2)**: Native `.exe` application running locally. Uses high-performance Rust IPC to bypass HTTP and read local repositories, git logs, and Hermes state directly.

### Running Locally (Web)

```bash
npm install
npm run dev -- -p 3046
```

### Running Locally (Desktop)

Requires Rust MSVC toolchain installed.

```bash
npm run tauri:dev    # Hot-reloading native window
npm run tauri:build  # Builds the production .exe installers
```

## Features

- **Action Matrix:** Trigger predefined agentic flows.
- **Toolkit Panel:** Shows the top loaded Hermes skills and active MCP servers.
- **CLI Stats Strip:** Context fuel gauge and daily token cost tracking.
- **Loops Grid:** Visual layout of background tasks and long-running routines.
- **Decision Inbox:** Approve/deny pending tasks requiring human gating.

## Deployment

- **Web:** Pushes to `main` auto-deploy to Vercel.
- **Desktop:** The GitHub Actions workflow `.github/workflows/tauri-build.yml` compiles the Windows `.exe` on any new version tag (`git tag v1.0.0 && git push --tags`) and attaches it to a GitHub Release.
