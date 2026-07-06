# Spec: mazos-ui-declutter

Date: 2026-07-06. Owner: Maz ("whole UI overhaul, massive declutter"). Contract for /build and /review.

## Objective

Cut the cockpit from 8 navigation destinations and duplicated panels down to a calm, Linear/Raycast-dense operator surface. Every remaining element must imply an action, decision, or evidence trail (per `docs/MAZOS_DESIGN_DIRECTION.md`). No new features, no new dependencies, no light theme. Declutter = delete + merge, not redesign from scratch.

## Requirements

1. **Nav reduced to 5 tabs**: `NOW`, `INBOX` (renamed FEED), `WORK` (PROJECTS + LOOPS merged), `INTAKE`, `SYSTEM`. TASK GATE and OPENWIKI become compact header links (small, mono, top-right area), not tab-sized buttons. Ctrl+K palette hint stays.
2. **NOW tab = one primary surface**: Shipping Spine (verdict + rows + footer chips) and the Morning Brief panel only. Remove from NOW: Context Map panel (moves to WORK), Loop Status strip (WORK tab badge covers it), mini Stale Work Radar (INBOX lane + WORK full list cover it), Last Signal panel (SYSTEM Run History covers it).
3. **WORK tab** contains, in order: Project Command Cards, Loop Engineering Deck + Decision Inbox, Context Map panel, Ship Log + full Stale Work Radar (side by side), Repo Command Centre + Handoff panel. Remove entirely: "Latest Project Work" free-text query panel (project cards + palette already answer it).
4. **Tab badge logic preserved**: open-decisions count badge moves from LOOPS to WORK tab. INBOX tab shows unread count badge from feed data (reuse existing `filters.unreadCount`).
5. **Topbar decluttered**: remove "JARVIS-LITE LOCAL OPS" eyebrow (banned marketing language). Keep title, mission, clock, and stats.
6. **BridgeBanner**: render nothing in local mode (current always-on "Local mode" banner is noise). Hosted mode behavior unchanged.
7. **Dead code removed**: any component/CSS class used only by deleted panels is deleted in the same PR (no orphaned exports or selectors). CSS classes shared with kept panels stay.
8. **Saved-tab migration**: `localStorage['mazos-tab']` values from the old tab set (`FEED`, `LOOPS`, `PROJECTS`) map to their new homes (`INBOX`, `WORK`, `WORK`); unknown values fall back to `NOW`.
9. **Command palette updated**: tab entries reflect the new 5-tab set; TASK GATE and OPENWIKI reachable as palette entries.
10. **No behavior regressions**: all kept panels keep their data loading, actions, modals, copy prompts, and keyboard shortcuts (Ctrl+K, `/`, Escape, feed arrow keys).
11. **No new dependencies, no new fonts, no light theme, no decorative additions.** Only CSS additions allowed are those strictly needed for the header links; reuse existing classes first.

## Edge cases

- Hosted (Vercel) mode: INBOX/WORK data still load via bridge fallback; BridgeBanner still appears when bridge is down. Local-only SystemStrip behavior unchanged.
- Feed `goNow` callback and any `setTab('NOW')`-style cross-links must use the new tab names (grep for all `setTab(` call sites).
- Old localStorage value present on first load after deploy → must not blank the screen (requirement 8).
- Ignore: mobile-specific layouts beyond existing breakpoints; light theme; changes to `/focus`, `/sessions`, `/openwiki` pages.

## Definition of done

- [ ] `TABS` array has exactly: NOW, INBOX, WORK, INTAKE, SYSTEM.
- [ ] NOW renders exactly 2 panels (Spine, Morning Brief).
- [ ] "Latest Project Work" panel, NOW-tab Loop Status strip, NOW-tab mini Stale Radar, Last Signal panel, and eyebrow line are gone from the codebase.
- [ ] BridgeBanner returns null in local mode.
- [ ] `npm run lint` and `npm run build` pass.
- [ ] Local smoke: `GET 127.0.0.1:3046` renders, each of the 5 tabs switches and shows its panels, palette opens with Ctrl+K, TASK GATE/OPENWIKI header links navigate.
- [ ] Old `mazos-tab` localStorage values do not break load.
- [ ] PR opened (never direct to main), lint+build green in CI.
