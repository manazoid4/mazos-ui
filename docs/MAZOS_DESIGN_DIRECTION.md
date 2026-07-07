# MAZos Design Direction

Agent-readable. Read before touching any MAZos UI. The target is a premium AI operator cockpit — Linear inbox clarity, Raycast density, Vercel polish, Langfuse trace depth — re-skinned light with a youmind.com-inspired warm wash. Not a toy dashboard, not an admin panel, not a marketing site.

## Visual target

- Light, warm, calm, dense but breathable. Soft off-white ground (`--bg:#fbfaf9`), not clinical pure white.
- No toggle: light is the only committed theme. No dark-mode tokens, no `.dark` variant, no `@media (prefers-color-scheme: dark)` branch anywhere in `globals.css`.
- One primary surface per view. Prefer **list + detail pane** over walls of cards.
- Every row/card must imply an action, a decision, or an evidence trail. If it doesn't, delete it.

## Palette

- Ground: `--bg:#fbfaf9`. Cards: `--panel`/`--panel2` (dark-tinted translucent washes on the light ground), 1px borders (`var(--line)`).
- Ink: `--ink:#15161b` (near-black text), `--muted:#6b6f78`, `--soft:#33363f` — both checked against WCAG AA (4.5:1 body) on `--bg`.
- Color is **state only**: `--yellow` = needs attention/warning, `--red` = failure/danger, `--green` = pass/strong evidence, `--violet` = active/selected/brand. Never decorative. All four are retuned dark-on-light shades so they still pass AA as text, not the bright light-on-dark shades from the old theme.
- `--coral` is a second, **ambient-only** accent (youmind cloud reference). It appears exclusively in the `.shell` background wash, at ≤10% opacity, and is never used for state or on interactive elements — it must stay visually distinct from `--violet`'s "active/selected" meaning so the two accents can't be read as both being clickable.
- The `.shell` radial wash (violet + coral, ≤10% opacity, on `--bg`) is the one ambient/gradient element allowed, echoing youmind's cloud hero without becoming a marketing hero block. `.gridGlow` is the other — grid lines darkened and lowered in opacity so it doesn't wash out on light ground.

## Typography

- UI text: Inter, 12–15px body sizes, 1.35–1.5 line-height. No new fonts, no new webfont hosts.
- Meta/labels/evidence: JetBrains Mono 10–12px, uppercase micro-labels with letter-spacing for section heads (`.laneHead`, `.detailLabel`, `.eyebrow`).
- `h1` keeps youmind-style bold, tight tracking, large clamp size. A restrained `<em>` italic-emphasis pattern is allowed for one key word in a section head where it echoes real content (product name, verdict) — never decorative, never more than one word per head.
- Timestamps relative (`2h`), absolute only in detail panes.

## Density rules

- Rows: single-line title + single-line dimmed summary, ellipsis overflow. 8–10px padding.
- Chips/badges: `.tag` pills, 10–11px mono. Max ~4 per row; overflow goes in the detail pane.
- Lane/section heads: 10px mono uppercase, count after label. No boxes around groups.

## List + detail pattern (Operator Inbox is the reference)

- Click selects (strong selected state: violet tint + border). No modal on row click.
- Detail pane is sticky, right column, ~5:4 split, collapses to single column under 960px.
- Modals only for copy/prompt overflow and secondary evidence.
- Unread = bright title; seen = softened. State buttons live at the bottom of the detail pane, separated by a hairline.

## Real-data strips (NOW view, below Shipping Spine)

- Stats strip, 3-card operating-loop strip (Evidence → Rank → Ship), and Recent Shipped strip are all wired to real data (`/api/mazos/shipping-spine`, `/api/mazos/shiplog`) — no vanity marketing numbers, no lorem/mock copy.
- Every data-driven strip must degrade to an explicit "no data" panel state (not a crash, not a fake `0`) when its source is unavailable — see `StatsStrip`/`RecentShippedStrip` in `src/app/page.tsx` for the pattern.
- The operating-loop strip is the one static-copy exception: three one-line explanations of the real MAZos loop, no fake interactivity, no click targets.

## Banned

- Nested card soup, decorative charts, useless metrics, generic SaaS cards.
- Emoji in UI chrome. Marketing language ("Start for free", "Create now"). Template galleries (MAZos has no user-facing templates).
- New dependencies for UI. New fonts. Dark theme (removed; light is the only committed theme).
- New buttons beyond what an existing flow or a new data-driven strip strictly needs — no CTA buttons added for their own sake.

## Components to reuse (src/app/page.tsx + globals.css)

- `Panel` (title + badge + children), `CopyBlock`, `SafetyBadge`, `.tag`, `.ghost`/`.primary` buttons, `setModal`.
- Inbox system: `.inboxLayout/.inboxRow/.laneHead/.inboxDetail`, `.brief*` strip, `.scoreLine`, `.flight*` timeline, `.eqTag` evidence-quality badges, `.sysStrip`.
- Stat blocks: `.aiStats` (big number + label, reused for the Stats strip). Short list rows: `.history` (label + relative time, reused for Recent Shipped). Numbered/labeled one-liners: `.massMoves` (reused for the Evidence → Rank → Ship strip).
- Steal from these files first; only add CSS when an existing class genuinely cannot cover it.
