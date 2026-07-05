# Structly Panel — Visual Hierarchy & Eye-Journey Review

Code-based audit of `src/panel/` (App.tsx, Report.tsx, IssueItem.tsx, AiSearchView.tsx, panel.module.css). Constraint respected throughout: severity/status/band must remain readable as text (spec 06) — nothing below removes text labels.

## UI states inventoried

1. Idle (header + hint)
2. Loading (disabled button w/ spinner + status-region spinner)
3. Error (red left-border message)
4. Result → Audit tab (score, 6 category bars, filters, N sections × issues, 5 export buttons)
5. Result → AI Search tab (takeaway + 5 numbered sections: assistant cards w/ rings, signal bars, fan-out chips, pillar accordions, skip list)
6. Stale-result banner (overlays states 4/5, adds 2 more buttons)
7. Sub-states: issue collapsed/expanded, filter-empty ("No issues match"), copied-button feedback

## Diagnosis — why it reads as "data from all directions"

Four root causes. Everything else is a symptom.

### 1. Attentional competition from parallel motion (the biggest offender)

Peripheral vision is motion-sensitive; anything moving demands fixation. On result render, **four independent animation systems fire simultaneously**:

- `.report > *` children stagger (fadeUp, 70ms steps)
- `.categoryRow` staggers separately (`--d` 70ms steps) **plus** each `.barFill` grows 180ms later
- `.issueItem` staggers on its own clock (45ms steps)
- Score count-up runs concurrently

The AI tab adds a fifth and sixth: word-by-word `WordReveal` (up to 900ms of individually jittering words) and conic-gradient ring sweeps with their own count-ups. Result: for ~1 second the entire viewport is in motion and the eye has no legal place to land. This is the direct cause of "hurtful in the eyes." Stagger only orchestrates attention when there is **one** sequence; five overlapping sequences is visual noise.

### 2. The accent color no longer means anything (Von Restorff violation)

Orange (`--accent`) is applied to: the primary button, section index numerals (30px, repeated up to 5–9× per scroll), the tab underline, the AEO/GEO tab badge, the takeaway border, focus rings, fan-out chip hover, and source links. An isolation effect only works if the isolated element is rare. Here the strongest color in the palette fires on every screenful, so it stops signaling "act here / look here" and becomes ambient noise. Worst case on screen simultaneously: header Audit button + stale-banner Audit button + 5 orange numerals + tab badge.

### 3. Inverted typographic hierarchy

- Section titles are 10px uppercase — **weaker than the 13px semibold issue titles inside them**. Containers whisper, contents shout; scanning order breaks because the eye can't find section boundaries.
- The 30px orange section numerals get the most visual weight on the page while carrying the least information (ordinal position). Ink is spent inversely to information.
- Nine font sizes are in play (48 / 30 / 15 / 13 / 12 / 11.5 / 11 / 10 / 9.5). Five of them are within 2.5px of each other — differences too small to encode hierarchy, big enough to look inconsistent.
- One identical style (10px/600/uppercase/tracked) serves eight different roles: buttons, tabs, section titles, form labels, chips, segments, citation label, band. Similarity (Gestalt) then tells the user these are the same kind of thing. They aren't.

### 4. Flat spacing = no chunking (proximity failure)

`.report` uses a uniform 22px gap between every sibling: score → categories → filters → section → section → exports. Uniform spacing flattens structure; the screen has three semantic zones (verdict / detail / actions) but zero spatial evidence of it. Within-category gap (14px) vs between-zone gap (22px) is a 1.6:1 ratio — chunking needs ~2:1 or better, or a change of surface. Combined with hairline-only separation and 2px gaps between issue rows, the result is one undifferentiated column of ~30+ rows.

## Secondary findings

| # | Finding | State | Severity |
|---|---------|-------|----------|
| 1 | Two spinners at once (button + status region) during loading — duplicate signal, split focus | Loading | Minor |
| 2 | Score has no reference frame — `87` with no `/100`; first-run users lack a scale anchor | Result | Moderate |
| 3 | Category rows carry 3 data points each (label, `score/max`, `(N issues)`) + colored bar = 4 encodings per row × 6 rows before the user reaches any issue | Result | Moderate |
| 4 | Each issue row shows 2 colored uppercase chips (severity + status); with ~24 rules that is up to 48 colored words scattered down the list — red no longer pops for triage ("visual confetti") | Result | Major |
| 5 | Severity + status repeat as the first two lines of the expanded detail — redundant with the chips 20px above | Expanded issue | Minor |
| 6 | 5 export buttons of near-equal weight (1 primary + 4 secondary, same size) — Hick's law tax at the exact moment the user is done reading | Result | Moderate |
| 7 | Header URL uses `word-break: break-all` — long URLs wrap to 2–3 ragged lines and push content down | All | Minor |
| 8 | Stale banner adds Audit + Reset while the header already shows Audit + Reset — 4 buttons, 2 actions | Stale | Moderate |
| 9 | After a result loads, the header's orange Audit button keeps competing with the report (the job changed from "run" to "read" but the CTA didn't demote) | Result | Moderate |
| 10 | AI tab renders 5 fully-expanded sections in one scroll (cards + rings + bars + chips + accordions); only pillars use progressive disclosure | AI tab | Major |
| 11 | Two control paradigms side by side in filters (custom segmented control + native select) — inconsistent affordances | Result | Minor |

## Target eye journey (per state)

- **Idle:** brand → page context → page-type select → Audit button. Currently fine; keep.
- **Result (audit):** score+band (verdict, 1 fixation) → category bars (where the damage is, 1 sweep) → worst section's failing issues (triage) → export/fix actions (exit). Today steps 2–4 all shout at once.
- **Result (AI):** takeaway sentence → assistant likelihood rings → everything else on demand.
- **Stale:** banner → its single CTA. Nothing else should pull orange.

## Prioritized recommendations

1. **Impose a motion budget: one entrance sequence, max two moving elements per state change.** Keep the score count-up and the bar sweeps; delete the per-row fadeUp staggers on `.categoryRow`, `.issueItem`, `.signalRow`, `.assistantCard`, `.fanoutChip`, and the `.report > * / .aiView > *` nth-child cascades — replace with a single 200ms fade on the container. Remove `WordReveal` (or reduce to one block fade). This alone fixes most of the "hurtful" complaint.
2. **Return orange to scarcity.** Section numerals → `--muted` (or shrink to 10px inline "01"); tab badge → muted; takeaway border → ink. After a result exists, render the header Audit button in the secondary style so the report owns the screen; when the stale banner shows, its "Audit this page" becomes the only orange element.
3. **Un-invert type hierarchy.** Section titles: 13px, weight 700, sentence case; keep 10px uppercase exclusively for chips and form labels. Collapse the size ramp to 5 steps (48 score / 15 takeaway / 13 body+titles / 11 secondary / 10 chips-labels).
4. **Chunk the report into 3 zones with spacing contrast.** Verdict zone (score + bars) internally tight (10–12px), then 36–40px + hairline before the issues zone, 36px before the actions zone. Keep 22px only between sections inside the issues zone.
5. **Cut per-row color to one voice.** Issue rows: keep the status chip colored; render severity as plain muted text (`high · fail` reads fine with one color). Drop the duplicated Severity/Status lines inside the expanded detail. Red then pops only where triage needs it.
6. **Collapse the export bar to two decisions.** Primary: "Copy AI Fix Prompt". Secondary: a single compact row — `Copy: Markdown · JSON  Download: Markdown · JSON` as text-button links. Same functions, one-fifth the visual weight.
7. **Progressive disclosure on the AI tab.** Takeaway + section 1 open by default; sections 2–5 use the existing `details` pattern. The pillar accordion already proves the pattern works there.
8. **Small fixes:** one spinner during loading (keep the button one; status region stays for `aria-live` with text only). Add a muted `/100` after the score. Trim category rows to label + `score/max` (move issue count into the section headers, where it aids navigation). Header URL: single line, `text-overflow: ellipsis`. Stale banner: drop its Reset (header already has one).

## What already works — keep it

- Text-first status encoding (chips supplement color with words), `srOnly` prefixes, `aria-live` status region, focus-visible everywhere — accessibility discipline is genuinely good.
- `prefers-reduced-motion` kill switch already exists — the motion budget above just makes the default experience closer to it.
- `details/summary` per issue is the right progressive-disclosure primitive.
- Left-label / right-value row anatomy (category and signal rows) supports an F-pattern scan.
- Tabular numerals, restrained paper-and-ink palette, hairline discipline — the Swiss foundation is sound; the problem is orchestration, not style.
