# Hermes External Agent Sources

Updated: 2026-07-01

## Purpose

These repositories are installed as local Hermes knowledge sources and recorded in MAZos as Git submodules. Hermes should use them as reference material and capability patterns, not blindly execute their installers or copy code into MazOS.

Local Hermes source root:

`C:\Users\manaz\.hermes\external-sources`

MAZos Git submodule root:

`C:\Users\manaz\Projects\mazos-ui\external\agent-sources`

## Installed Sources

| Source | Local path | MAZos pointer | Revision | Use when |
|---|---|---|---|---|
| Headroom | `C:\Users\manaz\.hermes\external-sources\headroom` | `external/agent-sources/headroom` | `4f560bcc` | Context compression, token reduction, cross-agent memory, MCP compression, reversible retrieval. |
| Agent Reach | `C:\Users\manaz\.hermes\external-sources\agent-reach` | `external/agent-sources/agent-reach` | `e87bcdb` | Giving agents web reach: webpages, YouTube, RSS, GitHub, Reddit/X/Instagram with explicit user-configured login boundaries. |
| NVIDIA Skills | `C:\Users\manaz\.hermes\external-sources\nvidia-skills` | `external/agent-sources/nvidia-skills` | `55f8f7a` | NVIDIA/GPU/CUDA/Jetson/NeMo/cuOpt/RAG/AI blueprint work, especially when verified agent skill governance matters. |
| Claude Skills | `C:\Users\manaz\.hermes\external-sources\claude-skills` | `external/agent-sources/claude-skills` | `4a3c05b6` | Large skill library patterns, commands, agent roles, workflow references. |
| Claude Skills CLAUDE.md | `C:\Users\manaz\.hermes\external-sources\CLAUDE.alirezarezvani-claude-skills.md` | included by source note | n/a | Copy-paste agent operating rules and skill orchestration guidance. |
| Maxun | `C:\Users\manaz\.hermes\external-sources\maxun` | `external/agent-sources/maxun` | `ca458fed` | Browser automation, web data extraction, scraping workflow architecture. Use only within legal/ToS-safe boundaries. |
| Loop Engineering | `C:\Users\manaz\.hermes\external-sources\loop-engineering` | `external/agent-sources/loop-engineering` | `b623b5f` | Designing safe recurring agent loops, triage loops, PR babysitters, CI sweepers, loop audits, cost checks, and stop conditions. |
| Awesome n8n Templates | `C:\Users\manaz\.hermes\external-sources\awesome-n8n-templates` | `external/agent-sources/awesome-n8n-templates` | `2d78bc6` | n8n workflow templates, webhook/integration automation examples, no-code automation patterns, and workflow blueprint inspiration. |
| TheAgency | `C:\Users\manaz\.hermes\external-sources\the-agency` | `external/agent-sources/the-agency` | n/a | Multi-agent Claude Code dev framework: captain/tech-lead/reviewer agent classes, ISCP, quality gates. |
| TheAgency Starter | `C:\Users\manaz\.hermes\external-sources\the-agency-starter` | `external/agent-sources/the-agency-starter` | n/a | Starter/installer variant of TheAgency framework. |
| TheAgency Workshop | `C:\Users\manaz\.hermes\external-sources\the-agency-workshop` | `external/agent-sources/the-agency-workshop` | n/a | AI-augmented dev workshop demo: Claude Code + TheAgency + Valueflow. |
| This Happened | `C:\Users\manaz\.hermes\external-sources\this-happened` | `external/agent-sources/this-happened` | n/a | Issue-reporting and distributed tracing tool with auto state capture. |

Note: the MAZos `awesome-n8n-templates` submodule uses a sparse checkout because the full repository contains Windows long-path template filenames. The full local clone is available for Hermes at `C:\Users\manaz\.hermes\external-sources\awesome-n8n-templates`.

## Unresolved Source

The user requested `https://github.com/alirezarezvani/claude`. GitHub returned:

`Could not resolve to a Repository with the name 'alirezarezvani/claude'.`

The accessible related repository is `https://github.com/alirezarezvani/claude-skills`, and the linked `CLAUDE.md` was installed from that repo.

## Hermes Usage Rules

1. Search this registry first when the user asks for agent skills, web reach, browser automation, context compression, or loop automation.
2. Read the relevant local README or `SKILL.md` before suggesting commands.
3. Prefer local paths over web fetches unless the user asks for latest upstream docs.
4. Do not run installers that modify global agent configs without a clear user instruction.
5. Do not use Agent Reach or Maxun to bypass authentication, scrape private content, or violate platform terms.
6. For repeated/automated work, use Loop Engineering to define stop conditions, budget, run logs, and human gates.
7. For large context/log-heavy work, consider Headroom first, but do not wrap agents automatically without user confirmation.
8. For NVIDIA skills, verify the specific skill folder and signed-skill guidance before relying on it for GPU/Jetson/NeMo work.
9. For n8n workflow design, use Awesome n8n Templates as examples only: read the README/category/template locally, adapt the pattern, configure credentials manually, and do not blindly activate imported workflows.

## Copy-Paste Hermes Prompt

```text
Hermes: load this as durable MAZos operating context.

External agent sources are installed locally at:
C:\Users\manaz\.hermes\external-sources

Use them like this:
- Headroom: use for context compression, token savings, reversible retrieval, shared cross-agent memory, and MCP/proxy compression. Read C:\Users\manaz\.hermes\external-sources\headroom\README.md before suggesting commands. Do not wrap Claude/Codex/OpenCode automatically unless I explicitly ask.
- Agent Reach: use when I ask an agent to research the web, read webpages, extract YouTube subtitles, read RSS, search GitHub, or configure X/Reddit/Instagram/Facebook access. Read C:\Users\manaz\.hermes\external-sources\agent-reach\README.md and prefer safe/dry-run setup. Never bypass platform auth or scrape private content.
- NVIDIA Skills: use for CUDA, Jetson, NeMo, cuOpt, GPU, RAG blueprint, DeepStream, medical AI, and NVIDIA platform work. Read the relevant skill under C:\Users\manaz\.hermes\external-sources\nvidia-skills\skills before acting.
- Claude Skills: use as a large library of reusable agent skills, commands, and role patterns. Read C:\Users\manaz\.hermes\external-sources\claude-skills\README.md and C:\Users\manaz\.hermes\external-sources\CLAUDE.alirezarezvani-claude-skills.md when designing agent workflows.
- Maxun: use for browser automation and web extraction architecture. Keep it legal, consent-based, and ToS-aware. Do not use it for credential theft, private scraping, or bypassing access controls.
- Loop Engineering: use whenever I ask for recurring automations, monitors, PR/CI loops, daily triage, dependency sweepers, or autonomous agent workflows. Start with C:\Users\manaz\.hermes\external-sources\loop-engineering\README.md and require stop conditions, budgets, run logs, and human gates.
- Awesome n8n Templates: use when I ask for n8n workflows, no-code automations, webhook/integration flows, workflow templates, Zapier-style automations, or automation blueprints. Read C:\Users\manaz\.hermes\external-sources\awesome-n8n-templates\README.md and the relevant local category/template first. Adapt patterns; do not import credentials, skip manual credential review, or blindly activate workflows.

MAZos repo records these sources as submodules under:
C:\Users\manaz\Projects\mazos-ui\external\agent-sources

Note: the n8n templates submodule in MAZos is sparse because the full repo has Windows long-path filenames. Use the full local Hermes clone for template files:
C:\Users\manaz\.hermes\external-sources\awesome-n8n-templates

Important: alirezarezvani/claude was not accessible from GitHub; use alirezarezvani/claude-skills and the installed CLAUDE.md instead.

When I ask for “use the external skills” or “make Hermes smarter”, do not load every repo. Pick the smallest relevant source, read its README/SKILL.md first, and give me a practical next action or implementation plan.
```
