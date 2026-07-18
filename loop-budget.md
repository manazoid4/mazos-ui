# Loop Budgets — v2

Budgets are counted in iterations and receipts, not wall-clock minutes (MAZos cannot observe agent time; the old minutes counter is what made the zombie loop absurd).

- Default: max 10 iterations per loop, no-progress stop after 2, circuit breaker on 2 identical failures.
- Evidence of spend: data/mazos/loop-receipts.jsonl (machine receipts) and data/mazos/runs/ (verify runs).
