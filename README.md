# MAZos — Loop Cockpit

One screen that answers **what ships next** and turns it into a gated agent loop with machine receipts.

MAZos never executes agent work. It defines loops, gates them before launch, hands the operator a copy-paste prompt, then captures hard evidence per iteration — verify exit code, commit range, diff size, criteria state — and folds that into one verdict.

## The screen (four zones, decision order)

1. **Ship Next** — Shipping Spine rows per product (FlowLens, JobFilter, Recall, OpenFlowKit, MAZos): objective, next action, evidence, blocker. Buttons: Context Pack, → New Loop (prefilled), Handoff prompt.
2. **Loop Deck** — one card per Loop. A Loop = goal + repo + verify action + two prompts (PLAN / BUILD) + receipts. Buttons: Plan prompt, Build prompt, Run verify, Log receipt, Gate, Stop. New Loop drawer gates every draft through task scoring; **no verify action, no save**.
3. **Decisions** — open human gates from loops. Invisible when empty.
4. **Shipped** — last 7 days of commits across repos + ~6 proven ops actions + run history.

Secondary page: `/hermes` (agent profiles). That's all.

## The Loop primitive

- **PLAN prompt**: gap analysis → writes `.loops/<id>/plan.md` in the target repo. No commits.
- **BUILD prompt**: exactly ONE plan item, smallest diff, run verify, commit.
- **Log receipt**: MAZos runs the loop's registered verify action (allowlisted command), inspects `git log prevReceipt..HEAD` + `git diff --shortstat`, hashes `criteria.json` (tamper detection), and appends a machine receipt. You cannot click your way to a completed loop.
- **Complete** is refused unless the last receipt passed and every criterion passes.
- Trust: ★ badge at ≥5 passing receipts; circuit opens on repeated identical failure; a "running" loop with no receipts for 3 days auto-stops.

Design law: Karpathy's generation-verification loop (verification is the bottleneck; short leash; autonomy earned per-task), Ralph-style plan/build split with filesystem memory, Anthropic's tamper-proof criteria files. See `docs/` and the v2 build prompt in the claude-obsidian vault.

## Run

```bash
npm run dev -- -p 3046   # app
npm run bridge            # 3047 → 3046 proxy for the hosted site
```

Hosted: `https://mazos-command-centre.vercel.app` (reads local data through the bridge; degrades to hosted API when the bridge is off). Auto-start on login: scheduled task **MAZos Local Stack** → `scripts/start-mazos-local-stack.ps1` (uses the production server when `.next` exists).

## Safety posture

No auto agent execution — agents launch only via copied prompts. The only shell surface is the pre-registered `commandRegistry` allowlist (per-repo `verify_*` build actions + ops actions). Local-first; `data/` is gitignored. No email, no cron, no LLM calls from MAZos.

## API (14 routes)

`/api/mazos` · `action` · `context-pack` · `decisions` · `health` · `hermes-profile` · `loop-factory` · `loop-receipts` · `loops` · `project-status` · `repos` · `runs` · `shiplog` · `shipping-spine`

External agents: read `shipping-spine` and `repos` first; contracts preserved from v1.
