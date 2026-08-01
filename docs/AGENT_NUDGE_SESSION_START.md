# Agent Nudge Session Start — MAZos Integration Plan

Agent Nudge owns the paid Session Start Assurance feature. MAZos is its first dogfood client.

## User outcome

On the NOW screen, Maz sees at most three evidence-backed choices:

- **Resume** interrupted work;
- **Review** work waiting on a gate or verification;
- **Start** the highest-value verified next action.

One click copies or launches a compact prompt through Agent Nudge. Target time: under 30 seconds from opening MAZos.

## MAZos scope

1. Call authenticated local `GET http://127.0.0.1:47831/v1/session-start?project=<id>`.
2. Add one compact “Start here” strip to NOW; do not add another dashboard page.
3. Show kind, reason, freshness, project/branch, next action, and verify command.
4. Reuse Agent Nudge prompt preview and runner launch. Do not create a MAZos execution path.
5. Record `launched`, `dismissed`, or `completed` through Agent Nudge receipts.
6. When Agent Nudge is offline, retain the existing MAZos context-pack flow and label assurance offline.

## Boundary

MAZos can keep its private local chat inspection separate. It must never send transcript content, prompt bodies, command bodies, secrets, or provider payloads to Agent Nudge. The integration exchanges only bounded structured task/repo evidence and receipt actions.

## Build order

1. Agent Nudge ships the card schema, ranking, authenticated API, Pro gate, and prompt preview.
2. MAZos adds a typed client plus fallback state.
3. MAZos adds the NOW strip and copy/launch actions.
4. Dogfood for seven days on Agent Nudge and one revenue repo.

## Acceptance

- at most three cards;
- no new page or background poller;
- useful prompt available in under 30 seconds;
- no duplicate completed-task card;
- Agent Nudge offline does not break NOW;
- zero transcript transfer;
- `npm test`, `npm run lint`, and `npm run build` pass.

The full product contract, research rationale, paid boundary, and ship gate live in Agent Nudge at `docs/SESSION-START-ASSURANCE.md`.
