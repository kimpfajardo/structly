---
target: Structly extension aesthetics
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-11-15T16-15-55Z
slug: src-panel-app-tsx
---
Method: dual-agent (A: /root/design_review · B: /root/design_evidence). Independent source assessments; browser inspection excluded by the user's instruction.

# Structly panel aesthetic critique

Full review. Scope: App, audit report, AI readiness, disclosures, exports, delivery evidence, recheck, theme, loading/error/stale states and credits. React 18, CSS Modules, local SVG assets; no new styling system proposed. Design mode: Operate.

## Design specificity and overall impression

Coherent but category-interchangeable. The source describes an editorial Swiss poster: warm paper, orange accent, gradient wordmark, dotted texture, giant score, chapter numbers and scroll entrances. The extension's useful identity is its evidence model, which receives less prominence than its presentation. The replacement direction should be a compact inspection tool: page context, verdict, first repair, evidence, recheck.

Keep the guiding-light mark, warm neutral palette, restrained orange, open rows, thin structural rules, native details, text status labels and explicit uncertainty. Existing tabular numerals, reduced-motion handling, focus styles and keyboard tabs/select are strengths. Do not report them as missing.

## Provisional design health: 23/40

Source-based heuristic judgment, not a usability-study result.

| Heuristic | Score /4 | Evidence |
|---|---:|---|
| System status | 3 | Loading, stale and copied states; copy failures silent |
| Real-world language | 2 | Several overlapping readiness and delivery terms |
| User control | 3 | Reset, removable questions and reversible filters |
| Consistency | 3 | Shared tokens; competing section/header patterns |
| Error prevention | 3 | Disabled loading actions, input limits, validated messages |
| Recognition | 2 | Fix-first titles do not open matching evidence |
| Efficiency | 2 | Useful exports; fix handoff follows the entire report |
| Aesthetic minimalism | 2 | Poster treatments consume narrow working space |
| Error recovery | 1 | Copy errors disappear; technical errors offer little recovery |
| Help | 2 | Good local caveats and evidence; terminology still needs interpretation |
| Total | 23/40 | Acceptable; substantial improvement needed |

## Priority findings

| Priority / severity / principle | Location | Before | After | Why |
|---|---|---|---|---|
| P1 / HIGH / Typography contrast | src/panel/panel.module.css:13, :274, :284, :1228 | Small secondary text uses muted #8c8880 on paper #f7f6f3, 3.27:1. Buttons use white on #ff4d00, 3.33:1. Extensive tracked uppercase at 10-12px. | Darken secondary ink, choose an accessible accent/text pair, use sentence-case controls at 12-13px and 14px body text. | Essential explanations and actions currently resemble faint fine print; both color pairs miss 4.5:1 for normal text. |
| P1 / MEDIUM / Task hierarchy | src/panel/components/Report.tsx:134, :155, :166, :168, :255 | Large score, purpose text, receipt, Fix first, delivery block and six category rows precede detailed issues. Fix prompt is at the end. | Compact verdict and first repair above evidence; make priority rows open their issue; put detailed metrics and breakdown behind disclosure; keep fix handoff near the relevant issue. | The first useful repair deserves the strongest hierarchy. Score is 52px on narrow panels, 84px on wider ones. |
| P2 / MEDIUM / Surfaces and specificity | src/panel/panel.module.css:77, :185, :795, :805 | Dot field, fading wordmark, oversized ordinals and forced lowercase headings. | Solid wordmark, quiet background, sentence-case category headings with issue counts, no decorative chapter numbers. | Generic editorial ornament spends scarce width without helping diagnosis. Retain the actual logo and palette. |
| P2 / MEDIUM / Motion restraint | src/panel/useCountUp.ts:11; src/panel/components/Reveal.tsx:24; src/panel/panel.module.css:141, :568 | 700ms count-up, 600ms bar growth and 550ms scroll reveals; report remounts on tab return. | Stable values immediately; brief feedback for copy, loading, disclosures and meaningful recheck changes. | Repeated inspection needs settled facts. Reduced-motion support already works independently of default motion restraint. |
| P2 / MEDIUM / Hit areas | src/panel/panel.module.css:205, :1004, :1067, :1420 | Theme switch is 24px high, export links have no padding, footer icon links are about 25px square. | Keep restrained visible controls and give them nonoverlapping 40px desktop hit areas, 44px where touch is supported. | Header actions and tabs already have 44px narrow-width rules; secondary controls should be equally deliberate. |

Suggested commands if later implementing: layout/distill for task hierarchy; typeset/colorize for readability; quieter for ornament and motion; adapt/polish for control targets. These are proposals only.

## Coverage

| Category | Evidence inspected | Result |
|---|---|---|
| Typography | Panel and evidence/receipt CSS, light/dark tokens, numeric styles | Contrast and microtype findings; tabular numbers already present |
| Surfaces | Panel texture, brand assets, separators, disclosures, popover | Editorial ornament finding; structural rules worth keeping |
| Animations | useCountUp, Reveal, keyframes and reduced-motion branches | Repeated motion finding; runtime feel unverified |
| Icons | Chevron, Credits, inline SVG and icon PNG | currentColor and accessible labels present; secondary hit areas small |
| Performance | RAF cancellation, observer disconnect, CSS transitions | Bounded cleanup exists; no measured performance conclusion |

## Cognitive load and emotional journey

Source suggests four checklist weaknesses: single focus, chunking, hierarchy and minimal choices. Six category summaries and seven export affordances add reading, though exports are already grouped by Copy/Download. Progressive disclosure and open rows are positive. First-time users face overlapping readiness terms; repeat auditors encounter entrances and search for the matching priority finding. Low-vision users lose essential secondary explanations to weak contrast. The score receives the dramatic peak; the recheck receipt is the stronger reassurance because it explains change.

## Detector and rejected candidates

Detector: 5 warnings, 0 errors. Three side-tab hits (lines 397, 1104, 1268), overused-font (29), gradient-text (192). Only the wordmark gradient reinforces a clear manual aesthetic finding. The error/stale rails encode meaningful state; the neutral takeaway rail is optional taste, not proof of AI styling. Familiar Helvetica is appropriate to the incumbent system.

Rejected: replace the font just because it is common; remove meaningful error/stale warning rails; add rounded card stacks, deeper shadows or more animation. They do not solve the hierarchy problem. Icon recoloring and tabular numbers need no new implementation.

Minor observation: copy-failure recovery needs a small inline error; this belongs with future interaction hardening, not a decorative redesign. Narrow delivery-header wrapping remains an unverified candidate, not a confirmed defect.

## Questions for the next pass

Direction: compact inspector (recommended) or restrained editorial report? Scope: two static samples first (recommended) or an implementation after direction is agreed? No UI implementation is authorized by this critique.

## Verification and verdict

Ran context.mjs once, independent source assessments, detector once, source/asset inspection and contrast calculation. No browser, screen control, server, overlay, runtime interactions, 10%-speed motion review, build or tests. No application code changed. Verdict: Block on normal-text contrast; resolve hierarchy and motion before a broader visual redesign. Actual wrapping, optical balance, dark-mode appearance and interaction feel remain unverified.

## User-selected direction — November 16, 2026

Compact inspector. Preserve the existing logo, warm paper palette, and restrained orange. Prioritize findings and evidence over the score and decorative sections. Any future samples should follow this direction. This selection does not authorize application-code changes.
