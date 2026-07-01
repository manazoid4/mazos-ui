# MAZos Loop Budget

## Daily cap
- L1 report-only: max 60k estimated tokens/run.
- Max subagents/run: 0.
- Max wall time/run: 30 minutes.
- Max high-priority items/run: 3.

## Kill switch
If `loop-pause-all` appears in STATE.md, LOOP.md, CURRENT_TASKS.md, or user message → stop immediately and report paused.

## Escalation
Switch to human handoff when:
- budget hits 80%
- same item appears 3 runs without progress
- repo/vault state conflicts
- action touches credentials/accounts/payments/deployments/scraping/destructive changes

## Current period
| Date | Loop | Runs | Est tokens | Subagents | Notes |
|---|---|---:|---:|---:|---|
| 2026-07-01 | MAZos Daily Triage | 0 | 0 | 0 | setup |
