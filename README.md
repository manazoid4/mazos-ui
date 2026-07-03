# MazOS Control Deck

Command & Control Interface for MazOS.

## Hermes External Sources

Hermes external agent sources are installed locally at:

`C:\Users\manaz\.hermes\external-sources`

MAZos records the same sources as Git submodules under:

`external/agent-sources`

Registry and instructions:

- `research/mazos/HERMES_EXTERNAL_SOURCES.md`
- `config/external-agent-sources.json`
- live Hermes skill: `C:\Users\manaz\.hermes\skills\external-agent-sources\SKILL.md`

Use these as reference/capability sources only. Do not run global installers, wrap agents, scrape private content, or create recurring loops without explicit confirmation and safety gates.

Installed source families include context compression, web reach, NVIDIA/GPU skills, reusable agent skills, browser automation, recurring loop engineering, and n8n workflow templates. The n8n templates are mirrored as a sparse MAZos submodule because the full repository contains Windows long-path filenames; Hermes should use the full local clone under `C:\Users\manaz\.hermes\external-sources\awesome-n8n-templates`.

## Overview
MazOS Control Deck is a persistent, formalized system providing a React-based UI that interfaces with underlying Hermes skills via YAML configuration files.

## Prerequisites
- Node.js >= 18
- Python >= 3.11
- Hermes Agent

## Installation
Run `.\install.ps1` to provision the environment.

## Operation
```bash
npm start
```
UI available at `http://localhost:9999` (default).

## Hosted Vercel + Local Windows Bridge

The hosted site can run at:

`https://mazos-command-centre.vercel.app`

Vercel cannot directly read `C:\Users\manaz\...` paths from the cloud. To let the hosted site use local repo/vault data, run MAZos locally and start the bridge:

```bash
npm run dev -- -p 3046
npm run bridge
```

The bridge listens on `http://127.0.0.1:3047` and proxies only `/api/mazos/*` to the local app. The hosted UI tries that bridge first when opened from Vercel, then falls back to hosted API data if the bridge is offline.

## Configuration
System state and skill definitions are maintained in YAML format. The React UI polls these configurations to reflect the current state of Hermes skills.

---
*Minimal viable documentation. See ARCHITECTURE.md for system design.*
