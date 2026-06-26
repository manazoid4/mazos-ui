# MazOS Control Deck

Command & Control Interface for MazOS.

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