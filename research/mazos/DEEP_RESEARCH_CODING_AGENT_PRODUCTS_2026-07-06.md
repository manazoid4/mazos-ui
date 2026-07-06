# Deep Research: Coding-Agent Product Landscape

Date: 2026-07-06
Project: MAZos

## Question

What should MAZos learn from current coding-agent products and repos?

## Live GitHub Signals

| Repo | Stars | Forks | Last pushed UTC | Product lesson |
|---|---:|---:|---|---|
| anomalyco/opencode | 182985 | 22673 | 2026-07-06T20:29:01Z | CLI/terminal agent surfaces can become primary workspaces. |
| openai/codex | 95860 | 14231 | 2026-07-06T20:23:04Z | Lightweight local coding agents are mainstream. |
| OpenHands/OpenHands | 79639 | 10155 | 2026-07-06T19:39:02Z | Full agent workspaces need shell/files/browser and reviewable history. |
| cline/cline | 64354 | 6854 | 2026-07-06T17:48:53Z | IDE-integrated agents are strong when they ask before risky actions. |
| Aider-AI/aider | 47121 | 4705 | 2026-05-22T14:02:20Z | Git-native pair programming remains useful because diffs stay explicit. |
| continuedev/continue | 34720 | 4977 | 2026-07-06T13:22:31Z | Open-source coding agents and IDE extensions compete on extensibility. |

## Product Landscape

### OpenHands

Signal:

- OpenHands is a high-star open-source AI-driven development workspace.
- The product category points toward real workspace operation: files, shell, browser, task history, and human review.

MAZos lesson:

- MAZos should not duplicate the agent workspace.
- It should prepare the mission, context, gates, and receipts that make any workspace safer.

### opencode

Signal:

- opencode is one of the strongest GitHub star signals in coding-agent tooling.
- The repo describes itself as an open source coding agent.

MAZos lesson:

- Coding work is moving toward terminal-native command agents.
- MAZos should export loop prompts and handoffs that work in terminal agents, not only browser/Codex UI.

### Codex

Signal:

- Codex is a lightweight coding agent that runs in the terminal.
- Codex Automations add scheduled tasks, triage inbox, and worktree isolation.

MAZos lesson:

- MAZos can be the planner and auditor around Codex.
- Best integration is not "run Codex invisibly"; it is "generate a durable Codex-ready loop with gates and receipts."

### Cline / Continue / Aider

Signal:

- IDE and terminal assistants are strong when they expose diffs, commands, and approval boundaries.
- Aider's Git-native framing shows why explicit patches and commits remain trusted.

MAZos lesson:

- The Loop Factory output should include branch strategy, verify commands, and file-scope limits.
- Every loop should be able to say: "open this in Cline/Codex/OpenCode/Aider with this context and these forbidden moves."

### Cursor / Devin / Replit / Lovable / other commercial agents

Signal from current market reporting:

- Coding-agent products are competing on whole-task delegation, planning, editing, reviewing, and deploying.
- The strongest products reduce friction from idea to running app, but they also create review/comprehension debt.

MAZos lesson:

- MAZos should own the review/comprehension side: proof receipts, source maps, local context, and next-action ranking.
- Do not chase "build anything from a prompt." Focus on "improve the right product with evidence."

## MAZos Differentiation

MAZos should be:

- The cockpit before the agent runs.
- The source-of-truth pack during the agent run.
- The evidence receipt after the agent run.
- The usefulness filter before more loops/features are added.

It should not be:

- A replacement IDE.
- A generic pair programmer.
- A no-code app builder.
- A hidden autonomous deployer.

## Feature Bets

1. Runtime Export Buttons
   - Export the same mission to Codex, Claude, OpenCode, Cline, Aider, or plain Markdown.

2. Worktree Safety Planner
   - Given a task, recommend branch name, files likely touched, verify commands, and whether worktree isolation is required.

3. Agent Receipt Collector
   - Parse a pasted agent result into evidence, commands, touched files, tests, decisions, and next action.

4. Comprehension Debt Meter
   - If agents are shipping faster than receipts/reviews, warn the user.

5. Latest Push Gate
   - Before recommending action on a GitHub project, fetch `pushed_at`, latest commit/PR/checks, and state the snapshot time.

## Sources

- OpenHands repository: https://github.com/OpenHands/OpenHands
- opencode repository: https://github.com/anomalyco/opencode
- OpenAI Codex repository: https://github.com/openai/codex
- Cline repository: https://github.com/cline/cline
- Continue repository: https://github.com/continuedev/continue
- Aider repository: https://github.com/Aider-AI/aider
- OpenAI Codex automations: https://developers.openai.com/codex/app/automations
- Current market search on AI coding-agent products, checked 2026-07-06.

