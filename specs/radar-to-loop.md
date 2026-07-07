# Spec: radar-to-loop

Goal: close the gap between research and action — every competitor card on `/research` gets one click that lands in the cockpit Loop Factory with a prefilled, pattern-picked draft. No new dashboard, no new route, no new deps. Mirrors the existing `mazos-taskgate-draft` localStorage handoff pattern.

Branch: `agents/radar-to-loop` → PR to main.

## R1 — Client handoff button
- New client component `src/app/research/ToLoopButton.tsx` (`'use client'`): props `{goal, project, pattern, sources}`. On click: `localStorage.setItem('mazos-loopfactory-draft', JSON.stringify(props))`, then `location.href='/#WORK'`.
- Renders as a small chip/button: `→ Loop Factory`.

## R2 — Research page wiring
- `src/app/research/page.tsx`:
  - Each Competitor Radar snapshot card gets `<ToLoopButton goal={action phrasing of snapshot.mazosGap} project="MAZos" pattern="research-intelligence" sources={github url + competitor sources}/>`.
  - Each Mass Competitor card gets `<ToLoopButton goal={competitor.mazosMove} project="MAZos" pattern={priority: copy-now/study → 'research-intelligence', watch → 'github-pulse'} sources={competitor.url + repo url}/>`.
- Server component stays server; only the button is client.

## R3 — Cockpit intake of the draft
- `src/app/page.tsx`: on mount, read `mazos-loopfactory-draft`; if present and parseable `{goal, project, pattern, sources}`, set the Loop Factory form with it, remove the key, and switch tab to WORK. Invalid JSON → remove key, ignore.
- If `/#WORK` hash is not already handled by tab logic, the draft intake calling `setTab('WORK')` covers it.

## Verify
- `npm run build` green.
- Click `→ Loop Factory` on a mass-competitor card at `/research` → cockpit opens WORK tab, Loop Factory form shows the competitor goal, pattern, and sources; localStorage key cleared.
- Draft Loop with prefilled values returns a scored draft (existing `/api/mazos/loop-factory` unchanged).

## Forbidden
- No API changes. No new panels. No styling overhaul — reuse existing chip/button classes.
