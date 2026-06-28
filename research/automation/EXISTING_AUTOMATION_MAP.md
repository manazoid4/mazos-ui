# Existing Automation Map

## 1. Repositories Scanned
- JobFilter
- Recall
- FlipSignal
- InkWeave
- OpenFlowKit
- Zawiya

## 2. GitHub Actions (.github/workflows)
None detected in primary scans.

## 3. Scheduled Tasks (Cron)
None explicitly defined in source code. JobFilter uses Vercel for hosting, potential cron in `vercel.json` (requires secondary check).

## 4. n8n Workflows
None detected in source code. If n8n is running locally, it is outside the project repositories.

## 5. Agent Instructions (AGENTS.md)
Found strict execution models across projects:
- **JobFilter**: Brutalist sales tone. "NO CHASING", "NO COMPETING".
- **InkWeave**: No-nonsense author focus. "ONE PRICE, FULL BOOK".
- **OpenFlowKit**: Privacy-first, local-first voice system. 

## Conclusion
Most automation appears to be conceptual or intended for MazOS. No active, hidden crons were found polluting the local environment.
