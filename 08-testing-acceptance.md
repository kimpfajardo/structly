# 08 — Testing and Acceptance

Testing is part of "done." Rules and scoring are pure, so they get thorough unit coverage
cheaply. Collectors need a DOM, so they get Playwright integration tests over static fixtures.

## Tooling
- **Vitest** (with `jsdom` environment where a DOM is needed, e.g. `rawHtml.ts`).
- **Playwright** (`@playwright/test`) for collector tests.
- Optional: `@testing-library/react` for the panel; not mandatory for Phase 1.

## Unit tests (Vitest) — required

### Rules — `src/core/rules/__tests__/`
For **every one of the 24 rules**, provide at minimum:
- One fixture snapshot where the rule **fires**, asserting the returned issue's `id`,
  `category`, `severity`, and `status` equal the spec values, and that `evidence` is non-empty.
- One fixture snapshot where the rule **does not fire**, asserting it returns `null`.

Page-type-gated rules (`content.missing-summary`, `schema.no-jsonld`, `cta.missing-primary`,
`cta.generic-primary`) additionally need a case proving the gate:
- `cta.missing-primary`: fires for `product` with no CTA; returns `null` for `article` with no CTA.
- `content.missing-summary`: fires for `docs` with short top text; `null` for `account`.
- `schema.no-jsonld`: status `warn` for `product` with no JSON-LD; status `info` for `docs`.

Rendering rules need the raw-availability branches:
- `rendering.low-initial-text`: `fail` when available + numbers meet threshold; `info` when
  `raw.available === false`; `null` when available but threshold not met.
- `rendering.app-shell-empty-raw`: `fail` when available + `bodyTextLength < 100`; `null` when
  `raw.available === false`.

Store reusable fixture snapshots as JSON under `src/__fixtures__/snapshots/`. A helper
`makeSnapshot(overrides)` that deep-merges overrides onto a valid baseline snapshot is
recommended to keep cases small.

### Scoring — `src/core/scoring/__tests__/`
- The worked example in `05` (four specific issues) → assert the six exact category scores,
  `overallScore === 74`, `band === 'Moderate risk'`.
- A no-issues report → all category scores equal their weights; `overallScore === 100`;
  `band === 'Strong readiness'`.
- Penalty math: one `high`/`fail` → `scoreImpact === 10`; one `medium`/`warn` → `3`; `info` →
  `0`; `pass` → `0`.
- Category clamp: two `high`/`fail` in `accessibility` (weight 10) → category score `0`, not
  negative.

### rawHtml — `src/core/__tests__/rawHtml.test.ts` (jsdom)
- `parseRawHtml(null, parser)` → `{ available: false, mainTextLength: 0, bodyTextLength: 0 }`.
- A full HTML string with a `<main>` → `available: true` and correct normalized lengths.
- HTML with no `<main>` → falls back to `<body>` for `mainTextLength`.

### Exports — `src/core/export/__tests__/`
- `exportJson(report)` round-trips: `JSON.parse(exportJson(r))` deep-equals `r`.
- `exportMarkdown(report)` snapshot test against a fixed report (assert exact string).
- Markdown with zero issues contains `No issues detected.` and omits per-category issue blocks.
- Selectors-empty issue omits the Selectors bullet.

## Integration tests (Playwright) — required

`tests/e2e/collectors.spec.ts` loads static HTML fixtures from `tests/fixtures/` and asserts the
`PageSnapshot` produced by the collectors. Provide at least these three fixtures:

- `good-marketing.html`: has `<title>`, meta description, canonical, `html[lang]`, one `<h1>`,
  `<main>`, a labeled primary CTA button with specific text, valid JSON-LD (`Product`), real
  body text. Expect: strong snapshot, few/no issues.
- `csr-shell.html`: minimal server body (near-empty `<body>`, app-shell div), so that when
  served and measured the raw metrics are tiny. Used to exercise rendering-risk logic. (Because
  Playwright serves the file directly, use this fixture in a test that feeds its HTML through
  `parseRawHtml` to simulate the raw side, paired with a rendered snapshot that has substantial
  `rendered.mainTextLength`.)
- `a11y-broken.html`: an icon-only button with no accessible name, an `<input>` with no label,
  repeated "learn more" links, no `<main>`. Expect the four accessibility rules to fire.

The collector test strategy: expose the collection routine so it can run in the page context via
Playwright's `page.evaluate`, or bundle the content collectors into a testable module and invoke
against `page`. Assert specific snapshot fields (e.g., `h1Count`, `landmarks.hasMain`,
`buttons` icon-only flags, `formControls[].hasLabel`, `jsonLd[0].valid`).

## Commands
- `npm run test` → Vitest once (unit).
- `npm run e2e` → Playwright.
- `npm run typecheck` → `tsc --noEmit` passes with zero errors under strict mode.

## Phase 1 acceptance checklist (all must pass)

1. `npm run build` produces a loadable unpacked MV3 extension; it loads in Chrome with no
   console errors on load.
2. Clicking the toolbar action opens the side panel.
3. On a real page, "Audit Page" returns a rendered report: overall score, 6 category scores, and
   grouped issues with expandable evidence and fixes.
4. The page-type `<select>` changes which gated rules fire on re-audit (verifiable on a page
   with no CTA: `product` shows `cta.missing-primary`, `article` does not).
5. Raw-HTML fetch works on a same-origin page; when it fails (e.g., cross-origin), rendering
   rules degrade to `info` rather than erroring.
6. All 24 rules implemented, each with the required firing/non-firing unit tests; scoring tests
   including the worked example pass; export tests pass; `typecheck` clean.
7. Markdown and JSON export download with the specified filenames and structure.
8. Panel meets the accessibility requirements in `06` (single H1, text severities, keyboard
   operable, live region for status).
9. No dependencies beyond `09`; no network calls beyond the raw-HTML fetch; no storage APIs.
