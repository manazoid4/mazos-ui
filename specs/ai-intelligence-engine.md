# Spec: ai-intelligence-engine

Goal: paste messy AI stuff → MAZos classifies, scores usefulness + trust, and converts the good items into Skill Factory drafts, Loop Factory inputs, and starter packs. Local-first, deterministic (no external API calls), compact UI. Category: "AI command centre for turning scattered AI inputs into verified skills, reusable loops, and productised workflows."

Branch: `agents/ai-intelligence-engine` → PR to main.

Hard rules: no Instagram scraping or login; no auto-installing skills; no running fetched code; no new dashboard page — one compact section on the INTAKE tab; small panels; daily usefulness first.

## R1 — Trust layer (`src/lib/mazos/trust.ts`)
- `computeTrust(factors)` → `{ trustScore 0-100, trustLevel: untrusted|promising|verified|approved, trustGaps: string[] }`.
- Factors: source clarity, usefulness, testability, evidence presence, safety risk, duplication, setup complexity, last verified date, human gate required.
- `buildEvalChecklist({name, expectations, inputs, expectedOutput, safetyChecks, evidence})` → markdown with sections: What should happen / What should not happen / Inputs to test / Expected output / Safety checks / Evidence required / Pass-fail decision.
- Approval floor: an item may only reach `approved` when it has a note, test evidence (or explicit reason), a source link or local explanation, and risk accepted.

## R2 — AI Source Inbox (`src/lib/mazos/aiSourceInbox.ts` + `data/mazos/ai-source-inbox.json` + `/api/mazos/ai-source-inbox`)
- Item fields exactly: id, rawInput, url, sourcePlatform (github|instagram|youtube|x|website|docs|local_note|unknown), sourceType (repo|issue|pull_request|file|ai_tool|skill|prompt|mcp_server|workflow|tutorial|competitor|product_idea|research_note|unknown), title, summary, notes, tags, status (new|research|skill_candidate|loop_candidate|competitor|product_idea|archived|ignored), usefulnessScore 0-100, trustScore 0-100, suggestedAction (research|make_skill|add_to_loop_factory|add_to_competitor_radar|save_for_later|ignore), createdAt, updatedAt.
- POST accepts messy pasted text: extracts URLs, keeps non-URL lines as local_note items, detects github/instagram/youtube/x/docs/website, detects keywords (mcp, skill, prompt, agent, workflow, automation, browser, memory, context, dashboard, ai tool, open source, template, api), dedupes by normalised URL / raw text, classifies, scores usefulness + trust, saves.
- GET returns: items, counts by status, counts by platform, latest 10, top 10 by usefulness, top skill candidate, top loop candidate, recommended next action.
- PATCH updates: status, sourceType, notes, tags, usefulnessScore, trustScore, suggestedAction.
- GitHub sub-typing: /issues/ → issue, /pull/ → pull_request, /blob/ → file, else repo.
- Instagram inputs classify platform instagram, likely type ai_tool|tutorial|prompt|workflow|product_idea|unknown; never fetched.

## R3 — Skill Factory (`src/lib/mazos/skillFactory.ts` + `data/mazos/skill-factory.json` + `/api/mazos/skill-factory`)
- Spec fields exactly: id, name, sourceItemIds, sourceUrls, category (research|coding|context_management|memory|browser|automation|mcp|prompt|data_ingestion|product|safety|unknown), whatItDoes, whenToUse, inputsNeeded, expectedOutput, requiredTools, safetyRisks, setupNotes, testPlan, rejectionReasons, status (draft|needs_research|test_ready|approved|rejected|archived), usefulnessScore, trustScore, riskLevel (low|medium|high), createdAt, updatedAt.
- POST: from sourceItemId or raw text → deterministic rule-based spec (no external APIs). Creating from a source item sets that item's status to `skill_candidate` and links ids both ways.
- GET: all skills, counts by status, top candidates, rejected/archived counts.
- PATCH: status, notes fields, scores, rejectionReasons. Approval enforces R1 floor.
- `skillSpecMarkdown(spec)` copyable format with sections: Name / Source / Category / What it does / When MAZos should use it / Inputs needed / Expected output / Required tools / Safety-limits / Test plan / Keep-reject decision.

## R4 — Loop Factory connection
- Inbox item button `Add to Loop`: appends item URL/notes into the existing Loop Factory sources field, suggests best pattern, switches to WORK tab, does NOT auto-save.
- Pattern map: github repo → github-pulse; market/competitor → research-intelligence; messy saved posts/ideas → founder-inbox; weak feature ideas → useless-feature-reaper; pricing/SaaS/funnel → revenue-radar; build/dev tooling → build-doctor; repeated workflow → intake-drainer.

## R5 — Loop / Skill Pack registry (`src/lib/mazos/loopStore.ts` + `data/mazos/loop-store.json` + `/api/mazos/loop-store`)
- Pack fields exactly: id, name, type (loop_pack|skill_pack|research_pack|mcp_pack|prompt_pack), audience (solo_builder|indie_hacker|agency|developer|researcher|local_business|job_hunter|founder), description, includedLoopIds, includedSkillIds, sourceItemIds, useCases, setupSteps, safetyNotes, proofReceipts, status (draft|test_ready|approved|archived), usefulnessScore, trustScore, installComplexity (low|medium|high), createdAt, updatedAt.
- GET: all, approved, drafts, top by usefulness, counts by type/audience. POST: create pack from selected loops/skills/source items. PATCH: status, notes, score, included items.
- Seed 4 starter draft packs (idempotent): Founder Command Pack (founder-inbox, revenue-radar, research-intelligence, ship-log); AI Research Pack (AI Source Inbox flow, research-intelligence, skill drafting); Hermes Clean Context Pack (useless-feature-reaper, build-doctor, github-pulse, context cleanup prompt); JobFilter Growth Pack (competitor research, lead research, revenue-radar, ship-log).
- `packReadme(pack)` sections: Name / Who it is for / Problem solved / Included loops / Included skills / Setup / How to run / Safety limits / Proof-receipts / Why this is useful.

## R6 — UI: one compact section, INTAKE tab (`src/app/page.tsx`)
- `AI Intelligence Engine` section beside Source Intake. Default view: paste box + counts + recommended next action + latest items. Skill Factory and Loop Store as collapsible sub-views (details/chip switcher), NOT separate top-level panels.
- Instagram helper text verbatim: "For Instagram AI Feed: paste share links, captions, or rough notes from saved posts. MAZos will classify them without needing Instagram access."
- Item buttons: Make Skill (→ skill draft + status skill_candidate), Add to Loop (R4), Archive, Ignore.
- Skill cards: name, category, usefulness, trust, risk, source links, summary + buttons Copy Skill Spec / Mark Test Ready / Approve / Reject / Archive (+ Copy Eval Checklist).
- Pack cards: Approved / Draft / Needs testing groups + buttons Create Pack / Copy Pack README / Mark Test Ready / Archive.

## R7 — Morning Brief integration (`src/lib/mazos/morningBrief.ts`)
- Compact additions: aiInbox {newCount, topSkillCandidate, topLoopCandidate, recommendedAction} and trust {untrustedCount, topRiskySkill, topLowValueItem, cleanupAction}; included in markdown.

## R8 — Tests (`tests/aiIntelligence.test.ts`, node:test via `npx tsx --test`)
- URL extraction; GitHub/Instagram/YouTube classification; skill-candidate classification; dedupe; usefulness scoring; trust scoring; source→skill draft creation; loop pattern suggestion; pack seeding/readme.

## Verify
- `npm run lint` (tsc --noEmit) and `npm run build` green (report pre-existing warnings verbatim).
- `npx tsx --test tests/*.test.ts` green.
- Live API smoke: POST messy paste → items classified/scored; GET summary sane; POST skill-factory from item → draft + linked; PATCH status works; GET loop-store shows 4 seeded drafts.

## Forbidden
- External API calls, scraping, auto-install, new routes/pages beyond the three API routes, giant dashboard, > ~1 new UI section.
