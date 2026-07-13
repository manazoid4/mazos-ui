# Active Project Notes

**Updated:** 2026-07-13  
**Portfolio priority:** RoleSignal Core in `manazoid4/SecureShift`  
**This repository's role:** Reference and future control-plane integration for runtime routing, evidence receipts, task gates, local bridge and operator health.

## Canonical context

Read `manazoid4/SecureShift/docs/ROLESIGNAL_AGENT_CONTEXT_PACK.md` before creating RoleSignal controls or prompts.

## Boundary

RoleSignal's jobs, candidate facts, applications and queues belong in SecureShift/Supabase. MAZos may later display health, launch safe prompts and surface decisions, but must not silently start applications or recurring loops.

## Current next action

After the SecureShift pilot works, add read-only RoleSignal status and Task Gate launch prompts to MAZos. Do not build that integration before the core run APIs are stable.

## Agent reminder

Respect current `allow_shell` and recurring-loop safety gates. Preserve evidence quality, explicit approvals and local/cloud separation.
