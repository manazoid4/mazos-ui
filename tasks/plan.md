# Maz Works Call Desk — implementation plan

## Outcome

Ship a local-first Windows calling workstation inside MazOS so Maz Works can turn researched local businesses into compliant, evidence-led sales conversations and paid £150 Website Rescue Sprints.

## Scope

### Vertical slice 1 — prospect and compliance record

- Add, edit, search, filter, and archive prospects.
- Persist records locally under the existing MazOS data directory.
- Record TPS, CTPS, internal suppression-list checks, source, and check timestamp.
- Block the call workflow when any register result is unknown, blocked, or stale.

Acceptance:

- A prospect survives refresh and desktop restart.
- An invalid record is rejected at the API boundary.
- A do-not-call outcome immediately suppresses the prospect.

### Vertical slice 2 — bounded website evidence checker

- Check one public HTTP(S) homepage supplied by the operator.
- Reject credentials, localhost, and private/reserved network targets.
- Report reachability, HTTPS, status, title, viewport, description, contact path, form/CTA signals, and actionable findings.
- Store the evidence snapshot on the prospect.

Acceptance:

- Private-network and malformed URLs cannot be fetched.
- The checker times out and caps downloaded HTML.
- Findings are deterministic and covered by tests.

### Vertical slice 3 — live call screen

- Show an honest Maz Works opener, discovery prompts, evidence statement, £150 sprint offer, objection responses, and close.
- Allow one-click copying and stage progress.
- Capture notes, outcome, next action, and follow-up date without leaving the screen.
- Surface the next call-ready prospect and simple pipeline totals.

Acceptance:

- The call button is unavailable until compliance screening is current and clear.
- Saving a call updates the timeline and pipeline.
- The script interpolates the business and strongest verified website finding.

### Vertical slice 4 — desktop delivery

- Link Call Desk from the MazOS cockpit.
- Keep all API traffic compatible with the existing Tauri local backend adapter.
- Document operation, privacy boundary, and legal screening responsibility.
- Run TypeScript, unit tests, Next build, desktop audit/smoke, and Windows packaging.

Acceptance:

- Static desktop export includes `/call-desk/`.
- Local API routes work through the desktop sidecar.
- A Windows installer is produced or the precise packaging blocker is documented.

## Out of scope

- AI voice screening, automated dialling, call recording, purchased-list ingestion, cloud CRM sync, automated TPS/CTPS lookup, bulk crawling, and cold email automation.

## Checkpoints

- Commit 1: domain, persistence, audit safety, tests.
- Commit 2: working Call Desk UI and cockpit navigation.
- Commit 3: docs, verification, and packaging fixes if needed.
