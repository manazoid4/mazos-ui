# Vault Agent Summary

Date: 2026-06-30  
Source: specialized Obsidian-vault scan agent.  
Vault: `C:/Users/manaz/Desktop/Obsidian Main Vault`

## Workflow

- Read order: `wiki/hot.md` → `wiki/index.md` → targeted search → top notes only.
- Memory truth: Obsidian files > chat memory.
- Durable update pattern: append dated sections to `03-MEMORY/CURRENT_TASKS.md`, `03-MEMORY/DECISIONS.md`, project `CURRENT.md`; serious sessions → `04-SESSIONS/YYYY-MM-DD-project-session.md`.
- Style: ultra-terse, direct, pushback-heavy, exact commands/URLs, revenue/YAGNI bias.
- Scope: vault-only for Obsidian memory work; do not scan whole `C:/` as memory.

## Priority repos/projects

### MazOS
- Role: local cockpit/control center.
- Path: `C:/Users/manaz/Projects/mazos-ui`
- GitHub: `https://github.com/manazoid4/mazos-ui`
- Localhost seen in vault: `http://localhost:3044`
- Current cockpit runtime used here: `http://localhost:3046`
- Need: keep dashboard current; verify UI/action API/Recall ingest/build/runtime; commit/push/log.

### JobFilter
- Role: priority revenue project.
- Primary path used in cockpit: `C:/Users/manaz/Desktop/JobFilterV1`
- Other paths seen:
  - `C:/Users/manaz/Desktop/JobFilterV1-github`
  - `C:/Users/manaz/Desktop/JobFilter/JobFilterV1`
  - `C:/Users/manaz/Desktop/jobfilter/jobfilterv1`
- GitHub seen: `https://github.com/manazoid4/JobFilterV1`
- Product: UK tradesmen lead-filter SaaS.
- Fastest revenue path: Twilio env → live WhatsApp → Supabase leads → QR sticker → auth → Stripe.
- Rule: read `wiki/concepts/JobFilter Status.md` and design system before UI.

### Recall
- Role: closest to paying; source capture/import into Obsidian-backed inbox.
- Path: `C:/Users/manaz/Projects/recall`
- Need: repo audit + smoke/build; clarify MVP flow.

### Hermes setup
- Config: `C:/Users/manaz/AppData/Local/hermes/config.yaml`
- Env: `C:/Users/manaz/AppData/Local/hermes/.env`
- Source: `C:/Users/manaz/AppData/Local/hermes/hermes-agent`
- Ref: `https://github.com/witt3rd/oh-my-hermes`
- Rule: use as pattern ref only; verify before adopting.

### Obsidian personal OS
- Canonical vault: `C:/Users/manaz/Desktop/Obsidian Main Vault`
- GitHub: `https://github.com/manazoid4/claude-obsidian`

## Recurring prompts

### Hermes session starter

```txt
Read `C:/Users/manaz/Desktop/Obsidian Main Vault/wiki/hot.md`, `wiki/index.md`, `03-MEMORY/PROJECT_INDEX.md`, `03-MEMORY/CURRENT_TASKS.md`, and `06-SYSTEM/HERMES_RULES.md`. Search the vault before claiming memory. Keep context small. Update tasks/decisions/session summary when durable. Then continue with: <task>.
```

### Obsidian memory fix

```txt
Use targeted vault search only. Build/update indexes. Never scan the whole vault. Never hallucinate unread prior work.
```

### Revenue pushback

```txt
Challenge YAGNI/revenue risk. Prioritize fastest path to paying users. Delete/skip nice-to-have work.
```

## Agent rules

- Canonical vault only: `C:/Users/manaz/Desktop/Obsidian Main Vault`
- Read `wiki/hot.md`, then `wiki/index.md` before broad searches.
- Source docs `.raw` immutable.
- Generated wiki under `wiki/`.
- Do not create extra general-purpose vaults.
- Important memory append-only by default; backup before overwrite.
- Show direct repo URLs for touched repos.
- Email digest: do not claim sent until Resend/runtime visibility verified.

## Active tasks extracted

- MazOS dashboard: show GitHub repo URL, localhost URL, repo/vault buttons.
- MazOS RALPH backlog: UI, action API, Recall ingest, build/runtime smoke, commit/push/log.
- Hermes memory: targeted Obsidian reads/searches, no chat-memory hallucination.
- Review oh-my-hermes selectively; no blind install.
- Email digest delivery: needs recipient + SMTP/Resend config/visibility.
- JobFilter: fastest revenue path = WhatsApp live → Supabase leads → QR → auth → Stripe.
- Recall: audit repo, identify MVP, run smoke/build.

## Cockpit panel implications

1. Today
   - Source: `03-MEMORY/CURRENT_TASKS.md`, `wiki/hot.md`
   - Actions: open vault, open tasks, append session summary.

2. Priority Repos
   - Rows: MazOS, JobFilter, Recall, Hermes, Vault.
   - Fields: path, GitHub, localhost/live URL, last build/status, top next action.

3. Revenue Focus
   - Fields: JobFilter blockers, Recall MVP blocker, fastest paying-user action.
   - Rule: force YAGNI/revenue pushback before nice-to-have work.

4. Memory/Obsidian
   - Fields: hot cache, project index, current tasks, decisions, prompt library.
   - Actions: targeted search, read context pack, append durable update.

5. Agent Rules
   - Fields: vault scope, read-before-claim, append-only memory, exact URL/command style.
   - Action: copy session starter prompt.

6. Digest/Inbox
   - Fields: Local Knowledge status, Recall inbox, email/Resend status.
   - Warning: do not show sent unless runtime confirms.

## Issues found

- Root `CURRENT_TASKS.md` absent; actual file is `03-MEMORY/CURRENT_TASKS.md`.
- JobFilter paths conflict across notes; verify repo before work.
- Project `CURRENT.md` files mostly placeholders.
- Recall/MazOS context packs say build/status needs current verification despite prior MazOS success.
