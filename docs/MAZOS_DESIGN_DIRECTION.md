# MAZos Design Direction

Agent-readable. Read before touching any MAZos UI. The target is a premium AI operator cockpit — Linear inbox clarity, Raycast density, Vercel polish, Langfuse trace depth. Not a toy dashboard, not an admin panel.

## Visual target

- Dark, crisp, calm, dense but breathable.
- One primary surface per view. Prefer **list + detail pane** over walls of cards.
- Every row/card must imply an action, a decision, or an evidence trail. If it doesn't, delete it.

## Palette

- Base: near-black backgrounds (`rgba(255,255,255,.02)` panels on #05070a-ish shell), subtle 1px borders (`var(--line)`).
- Color is **state only**: yellow = needs attention/warning, red = failure/danger, green = pass/strong evidence, violet = active/selected. Never decorative.
- No gradient blobs, orbs, or hero sections. The existing `.gridGlow` is the only ambient allowed.

## Typography

- UI text: system sans, 12–15px body sizes, 1.35–1.5 line-height.
- Meta/labels/evidence: JetBrains Mono 10–12px, uppercase micro-labels with letter-spacing for section heads (`.laneHead`, `.detailLabel`, `.eyebrow`).
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

## Banned

- Nested card soup, decorative charts, useless metrics, generic SaaS cards.
- Emoji in UI chrome. Marketing language. "AI dashboard" gradients.
- New dependencies for UI. New fonts. Light theme (for now).

## Components to reuse (src/app/page.tsx + globals.css)

- `Panel` (title + badge + children), `CopyBlock`, `SafetyBadge`, `.tag`, `.ghost`/`.primary` buttons, `setModal`.
- Inbox system: `.inboxLayout/.inboxRow/.laneHead/.inboxDetail`, `.brief*` strip, `.scoreLine`, `.flight*` timeline, `.eqTag` evidence-quality badges, `.sysStrip`.
- Steal from these files first; only add CSS when an existing class genuinely cannot cover it.
