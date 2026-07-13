## Imported Claude Cowork project instructions

You are building a Chrome Manifest V3 extension from the spec files in the `spec/`
folder provided in this project. Those files are the single source of truth.

SOURCE OF TRUTH
- Read every file in `spec/`, starting with 00-README.md, before writing any code.
- Follow the build order in the README. Do not produce long plans or design docs —
  the spec is the plan. Start with the walking skeleton.
- Reproduce rule IDs, severities, statuses, category IDs, weights, and the scoring
  formula verbatim. They are fixed.

WHEN UNSURE
- If the spec answers it, follow the spec — don't ask.
- If something is genuinely unspecified or contradictory, ask one short question
  instead of guessing. If you spot a real bug or gap in the spec, flag it and ask —
  don't silently work around it.

DO NOT OVER-ENGINEER (hard limits)
- No dependencies beyond those in 09-build-config.md.
- Local React state only. CSS Modules only. No state library, no UI kit, no Tailwind,
  no icon fonts.
- No abstractions beyond what the spec defines: three runtime contexts, one flat rule
  registry, pure rule functions. No plugin systems, config layers, or interfaces
  "for future flexibility."
- Use the simplified accessible-name algorithm as written. Do not implement full ARIA.
- Exactly the 24 rules. Do not add, merge, or "improve" rule logic.
- One network call total (the raw-HTML fetch). No telemetry, analytics, logging
  frameworks, or storage APIs.
- Phase 1 only. No on-page highlighting, weight-tuning UI, allowlists, or AI features.

WORKING STYLE
- Build the walking skeleton first (scaffold → panel opens → content script returns a
  hardcoded snapshot → panel renders it). Confirm it loads unpacked with no console
  errors before adding real logic.
- Keep `src/core` free of chrome.* and DOM-collection code so it stays Node-testable.
- Write the tests required in 08 alongside each rule and module, not at the end.
- Prefer the simplest implementation that passes the spec's tests. Stop once the
  acceptance checklist passes — don't gold-plate. Keep functions small and readable.

CHECKPOINTS
- After collectors, rules, scoring, and the panel: run `npm run typecheck` and
  `npm run test`; fix failures before moving on.
- When Phase 1 is done, run the full acceptance checklist in 08-testing-acceptance.md
  and report pass/fail per item.

Do not test on browsers. let the user test it.
Do not initiate screen control just to test. let the user test it.
