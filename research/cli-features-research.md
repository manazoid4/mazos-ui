# AI Coding CLI Tools: UX & Dashboard Feature Research

This report analyzes the tiny, delightful UX features in modern AI coding CLI tools (OpenCode, Codex CLI, Gemini CLI, Claude Code, Aider, Cursor CLI, Crush) and evaluates their potential for integration into **MazOS**, a local Windows desktop dashboard for developer activity.

## Feature Breakdown by Tool

| Tool | Feature | What it does | Why it's useful | MazOS Portability |
| :--- | :--- | :--- | :--- | :--- |
| **Aider** | **Live Repo-Map Token Counter** | Statusline shows exact tokens used by the repository map. | Prevents silent context exhaustion; keeps costs visible. | **High**: Read tree-sitter map sizes; display a persistent context bar per repo. |
| **Aider** | **Auto-Commit Messages** | Automatically stages and commits AI edits with concise, generated messages. | Keeps git history clean without interrupting dev flow. | **High**: Parse `git log` and tag "AI-generated" commits visually on the timeline. |
| **Crush** | **Hot-Swappable Model Picker** | Press `ctrl+l` mid-session to switch the underlying LLM while preserving chat context. | Use cheap models for scaffolding, expensive ones for complex logic. | **High**: A global hotkey palette to swap the active API endpoint for the current session. |
| **Crush** | **LSP-Enhanced Context** | Uses local Language Server Protocol outputs to inject definitions into the prompt. | Reduces hallucination by providing compiler-grade knowledge. | **Medium**: Requires a background LSP client, but valuable for the dashboard's code viewer. |
| **OpenCode** | **Agent Modality Switcher** | Press `Tab` to switch between `build` (edits files) and `plan` (read-only exploration). | Creates safe sandboxes; explore code without fear of accidental changes. | **High**: UI toggle that strips write permissions from the current prompt execution. |
| **Claude Code** | **Conversation Checkpointing** | Saves the state of a complex multi-turn session to be resumed later. | AI tasks span days; prevents losing the "train of thought." | **High**: Read/write session JSON files; display as "Active Contexts" in a sidebar. |
| **Claude Code** | **MCP Server Status Indicators** | Shows the health and connection status of attached Model Context Protocol servers. | Essential for debugging when custom tools fail. | **High**: Widget showing connected MCPs with green/red status dots. |
| **Cursor CLI** | **Context-Percentage Meter** | A visual fuel gauge showing how much of the context window is full. | Intuitive sense of when to clear chat or start a new session. | **High**: Simple math (current tokens / max tokens) rendered as a circular progress bar. |
| **Gemini CLI** | **Project-Specific `GEMINI.md`** | Auto-loads custom behavior, rules, and context from a local markdown file. | Allows teams to enforce coding standards at the directory level. | **High**: Parse `.mazos.md` or `.cursorrules` files; display the active ruleset. |
| **Codex CLI** | **Cost & Usage Dashboards** | Local tracking of daily API usage and token expenditure. | Prevents billing surprises and gamifies efficiency. | **High**: Aggregate token usage across all CLI tools; visualize as a daily burn-down chart. |

## Top 15 Features MazOS Should Steal (Ranked)

Ranked by impact vs. effort, with one-line implementation notes.

| Rank | Feature | Implementation Note |
| :--- | :--- | :--- |
| 1 | **Context-Percentage Fuel Gauge** | Calculate `(current_tokens / model_max) * 100` and render as a sleek circular widget in the top-right corner. |
| 2 | **Session Cost Odometer** | Read token counts from Hermes langfuse API or local SQLite cache; multiply by standard model pricing. |
| 3 | **Agent Modality Switcher (Plan vs. Build)** | UI toggle that appends a `READ_ONLY` system prompt and disables file-write tool execution. |
| 4 | **Mid-Session Model Hot-Swapping** | Dropdown (or `Ctrl+L` palette) that changes the API route for the *next* request while keeping the message history intact. |
| 5 | **Persistent MCP Status Dots** | Ping localhost MCP ports/pipes every 5 seconds; display green/yellow/red status in the footer. |
| 6 | **Repo-Map Activity Heatmap** | Run `git log --since="1 week"` and visualize frequently edited files as a mini-map in the dashboard. |
| 7 | **AI vs. Human Commit Tagging** | Parse `git log`; use regex to identify standard Aider/Cursor commit formats; render with a distinct icon. |
| 8 | **One-Click Session Resumption** | Parse `~/.claude/projects/*.jsonl` or local SQLite histories; show "Recent Trains of Thought" on the home screen. |
| 9 | **Project-Level Rule Badges** | Scan for `.cursorrules`, `AGENTS.md`, or `GEMINI.md`; display active constraints as pill-badges (e.g., "React 19", "Strict TS"). |
| 10 | **LSP Health Indicator** | Check if `tsserver` or `gopls` is running in the background; show a small status icon. |
| 11 | **Diff-Summary Notifications** | When a background CLI modifies a file, run `git diff --stat` and push a Windows toast notification via PowerShell. |
| 12 | **In-Flight Token Streaming Counter** | Hook into the SSE stream of the active LLM request to tick up a token counter in real-time, Matrix-style. |
| 13 | **Local "Drop" / Un-context Buttons** | Chip list of currently loaded files in context, with an `[x]` to instantly remove them from the session state. |
| 14 | **Test-Driven Auto-Lint Hooks** | Watch the file system; on AI edit, trigger `npm run lint` in the background; pipe errors to a dedicated "Fixes Needed" pane. |
| 15 | **Keybind Command Palette (Ctrl+K)** | Implement a global invisible window that summons a Spotlight-style search bar for quick agent instructions. |
