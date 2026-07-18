# MAZos Loop Engineering — v2

One source of truth: the in-app Loop Deck at `http://127.0.0.1:3046`. This file only records doctrine; loop state lives in `data/mazos/loop-runs.jsonl` + `loop-receipts.jsonl` and per-repo `.loops/<id>/` directories — never here.

## Doctrine (the 15 principles, short form)

1. Verification is the bottleneck — every loop has a registered verify action or it cannot be saved.
2. Short leash — receipts flag diffs >300 changed lines.
3. Autonomy is earned per loop (suggest → diff → branch), ceiling set by verifier strength. Never auto-merge.
4. March of nines — ★ trusted only after ≥5 passing machine receipts.
5. One plan item per iteration.
6. Fresh context each pass; `.loops/<id>/` files are the memory.
7. Plan/build split: two prompts, one loop.
8. Backpressure: verify runs mechanically inside receipt capture; a failing verify can never produce a pass receipt.
9. criteria.json is tamper-checked by hash; edits render the iteration failed.
10. Init once (scaffold on save), iterate after.
11. No receipt = the iteration didn't happen.
12. Hard stops: max iterations, no-progress, circuit breaker on repeated identical failure, 3-day zombie auto-stop.
13. The prompt is versioned config — add a rule after every misbehavior, bump promptVersion.
14. Only objectively checkable goals become loops; open-ended goals decompose first.
15. Human stays accountable: specs in, diffs + receipts out.

## Dogfood gate (acceptance test for v2)

Run **Daily Triage** for real: 5 iterations over 5 days with machine receipts in `loop-receipts.jsonl`. If receipts don't accumulate, the design failed and gets another chop.
