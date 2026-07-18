# AGENTS.md — how agents work with MAZos v2

MAZos is a loop cockpit. You (Hermes / Claude / Codex / OpenCode) never get launched by MAZos — Maz copies a PLAN or BUILD prompt from a Loop card and pastes it to you.

## Read first

1. `GET http://127.0.0.1:3046/api/mazos/shipping-spine` — what ships next, with evidence.
2. `GET /api/mazos/context-pack?project=<name>` — compact repo context.
3. The loop's filesystem memory in the target repo: `.loops/<id>/plan.md`, `.loops/<id>/criteria.json`, `.loops/<id>/progress.md`.

Canonical Obsidian vault: `C:/Users/manaz/Desktop/Obsidian Main Vault`. Indexes first (`03-MEMORY/PROJECT_INDEX.md`, `03-MEMORY/CURRENT_TASKS.md`), targeted search after; never load the whole vault. Session summaries go to `04-SESSIONS/YYYY-MM-DD-project-session.md`.

## Rules inside a loop

- PLAN pass: analysis only, rewrite plan.md, no commits.
- BUILD pass: exactly ONE unchecked plan item, smallest diff, run the verify command, commit, append one line to progress.md.
- NEVER edit criteria.json descriptions or remove items — receipt capture hashes it; tampering renders the iteration failed.
- Hit a human gate → stop and file it (Decision strip). Do not proceed.
- Stop conditions are hard: max iterations, no-progress, repeated identical failure.

## Forbidden (always)

No destructive commands, no force push, no credential changes, no global installs, no private scraping/auth bypass, no push to main — PRs only, and only when Maz asks.

## Infrastructure

- Local app: `http://127.0.0.1:3046` · hosted: `https://mazos-command-centre.vercel.app` · bridge: `http://127.0.0.1:3047` (proxies `/api/mazos/*` only, origin-allowlisted).
- Windows scheduled task `MAZos Local Stack` starts app + bridge at logon (production server when a build exists).
- Tracked repo paths: `src/lib/mazos/paths.ts` is the source of truth — mazos-ui, flowlens (revenue product), JobFilterV1, recall, openflowkit, Obsidian vaults.
