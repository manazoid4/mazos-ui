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

## Configuration
System state and skill definitions are maintained in YAML format. The React UI polls these configurations to reflect the current state of Hermes skills.

---
*Minimal viable documentation. See ARCHITECTURE.md for system design.*
