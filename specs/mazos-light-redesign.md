# MAZos Light Redesign (YouMind-inspired)

## Objective

Full replace of MAZos's dark cockpit theme with a light theme, taking design cues from youmind.com (soft white ground, warm gradient wash, bold headline typography, card-based proof/stats blocks) — while keeping MAZos's actual identity: dense operator cockpit for shipping decisions, not a content-creation marketing site. No toggle — dark theme is removed, light is the only theme going forward. Supersedes the "no light theme" and "no gradient/hero" rules in `docs/MAZOS_DESIGN_DIRECTION.md`; that doc gets rewritten as part of this work, not left contradicting the shipped UI.

## Requirements

1. **Token replace** — `src/app/globals.css` `:root` tokens redefined for light ground:
   - `--bg:#fbfaf9` (warm off-white, not clinical pure white)
   - `--panel: rgba(20,15,15,.035)`, `--panel2: rgba(20,15,15,.06)` (cards on light ground)
   - `--ink:#15161b` (near-black text), `--muted:#6b6f78`, `--soft:#33363f`
   - `--line: rgba(15,15,20,.09)`
   - `--violet:#6a63f2` stays primary brand/selection accent (retuned for AA contrast on white)
   - `--green/--red/--yellow` retuned for AA contrast on light ground; meaning unchanged (pass/fail/warning — state only, unchanged semantics)
   - new `--coral:#ff7a59` — secondary ambient-only accent (youmind cloud reference), used only in the background gradient wash, never for state or as a second interactive color
   - Remove all dark-specific values; no `@media (prefers-color-scheme: dark)` branch, no `.dark` variant — single committed theme.
2. **Ambient wash** — `.shell` background gradient retinted: soft radial wash combining `--violet` and `--coral` at low opacity (≤10%) on `--bg`, echoing youmind's cloud hero without becoming a marketing hero block. `.gridGlow` grid overlay kept, opacity retuned for light (darker grid lines, lower opacity so it doesn't wash out).
3. **Typography** — keep Inter (body) + JetBrains Mono (micro-labels/data), no new fonts/webfont hosts added. Headline (`h1`) keeps youmind-style bold, tight tracking, large clamp size; add restrained italic-emphasis pattern (`<em>`) for one key word in section heads where it echoes real content (e.g. product name, verdict), not decorative.
4. **Stats strip** (new component, NOW view, below Shipping Spine panel) — big-number stat blocks sourced from real data (Spine + shiplog), not vanity marketing numbers. Minimum: products tracked, days since oldest stale product touched, open blockers count, commits shipped last 7d across tracked repos. No placeholder/mock numbers — wire to existing `/api/mazos/shipping-spine` and `/api/mazos/shiplog` data.
5. **3-card operating-loop strip** (new component, replaces youmind's Capture→Think→Shape) — MAZos's real loop condensed to 3 cards: **Evidence → Rank → Ship**, one line of real explanation each (evidence sources checked, how Spine ranks, what "ship" requires — done criteria). Static copy, no fake interactivity.
6. **Recent Shipped strip** (new component, replaces youmind's testimonial carousel) — last 5 merged PRs across tracked repos (title, repo, relative time, link), pulled from existing GitHub data already used elsewhere in the app (ship log / GitHub API), not hand-maintained copy.
7. **No template gallery** — youmind's template-gallery concept has no MAZos equivalent (MAZos has no user-facing templates); omit entirely.
8. **No marketing CTAs** — do not add "Start for free"/"Create now"-style buttons or copy. Existing functional button system (`.ghost`/`.primary`, verb-labeled: "Open Spine", "Run Loop", etc.) is reskinned for light, not replaced or supplemented with new marketing buttons. Minimal — no new buttons added beyond what already exists unless a new component (stats/loop/shipped strip) requires a single functional link-through.
9. **Structure preserved** — list+detail pattern (Operator Inbox reference), Panel/CopyBlock/SafetyBadge/tag component structure, and existing page layout/routes are unchanged. This is a full re-skin + 3 new data-driven strips, not a layout rebuild.
10. **Doc update** — rewrite `docs/MAZOS_DESIGN_DIRECTION.md`: replace "dark, near-black" direction and "banned: light theme" with the new light system (palette, gradient-wash rule, stats/loop/shipped-strip patterns), keep the density/banned-marketing-language/no-nested-card-soup rules that still apply.

## Edge cases

- Contrast: every text/background pairing must meet WCAG AA (4.5:1 body, 3:1 large text) on the new light tokens — check `--muted` and `--soft` specifically, they're the ones most likely to fail on white.
- Stat strip / shipped strip must degrade gracefully (show "no data" state, not crash or show 0/blank) if Spine or GitHub data is unavailable (e.g. hosted Vercel bridge down).
- Existing violet "active/selected" state must stay visually distinct from the new coral ambient wash — coral never appears on interactive elements, only in the fixed background wash, so the two accents can't be confused as both being "clickable."
- Do not regress the Operator Inbox / Spine panel data density rules from the existing design doc (row padding, mono micro-labels, single-line ellipsis) — those survive the theme swap unchanged.

## Definition of done

- [ ] `globals.css` has zero dark-mode tokens/branches remaining; app renders light-only.
- [ ] `docs/MAZOS_DESIGN_DIRECTION.md` rewritten, no longer contradicts shipped UI.
- [ ] Stats strip, 3-card operating-loop strip, Recent Shipped strip live on NOW view, all wired to real data (no mock/lorem).
- [ ] No template gallery, no marketing CTA copy, no new buttons beyond what the 3 new strips strictly need.
- [ ] `npm run lint` and `npm run build` pass.
- [ ] Verified in a real browser (dev server), light theme readable, AA contrast holds, existing Operator Inbox / Spine functionality unregressed.
- [ ] PR opened against `main` (no direct push), per standing PR-workflow rule.
