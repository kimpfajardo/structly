# 06 — UI (Side Panel)

React app in `src/panel/`. Styling: **CSS Modules only** (`*.module.css`). No Tailwind, no UI
component library, no icon font. The panel should read like a diagnostic console: plain, dense,
readable. Do not add decorative visuals.

## Structure and states

The panel has four states. Render exactly one at a time.

1. **Idle** (initial): header + controls, empty results area with a short hint.
2. **Loading**: after "Audit Page" is clicked, until a result or error arrives. Show a plain
   "Auditing…" indicator. Disable the audit button while loading.
3. **Result**: full report rendered (below).
4. **Error**: on `AUDIT_ERROR` or Zod validation failure. Show the error message and keep the
   audit button enabled for retry.

## Header / controls (always visible)

- Panel title: an `<h1>` reading `Page Readiness Auditor`.
- Current page `title` and `url` (from the last result, or the active tab in idle).
- Page-type `<select>` with options, values exactly:
  `marketing`, `docs`, `product`, `account`, `article`, `unknown` (default `unknown`).
  A visible `<label>` associated via `htmlFor`.
- "Audit Page" `<button>`.

The page-type value is read at result-finalization time (`01`) and written to
`snapshot.pageType` before rules run. Changing the select after a result does not re-run
automatically; the user must click Audit Page again.

## Result layout

In this order:

1. **Overall score** — the number and the band text (both as text, e.g. `74 — Moderate risk`).
   The issue list is the focus; keep the score compact (single line/small block), not a large
   hero graphic.
2. **Category scores** — a list of the 6 categories, each showing `label`, `score`/`maxScore`,
   and the count of issues. Order per `05`.
3. **Filter controls** — a group of controls that filter the issue list:
   - All issues (default)
   - Failures only (`status === 'fail'`)
   - Warnings only (`status === 'warn'`)
   - Info only (`status === 'info'`)
   - By category (a select of the 6 category labels + "All categories")
   The status filter and the category filter combine (AND).
4. **Issue groups** — issues grouped by category (only categories with visible-after-filter
   issues appear). Each group is a `<section>` with an `<h2>` = category label. Within a group,
   each issue is an `<article>` (or `<li>` inside a `<ul>`) that is expand/collapse.

## Issue item (rendered content)

Collapsed: show `title`, `severity` (as text), and `status` (as text).
Expanded, additionally show, each clearly labeled in text:
- Severity: `<severity>`
- Status: `<status>`
- Why it matters: `whyItMatters`
- Evidence: `evidence[]` as a `<ul>` of `<li>`
- Recommended fix: `recommendedFix`
- Selectors: `selectors.join(', ')` (omit the row if `selectors` is empty)

Each issue has a "Copy" button that copies a plain-text block of that issue (all fields above,
labeled) to the clipboard via `navigator.clipboard.writeText`.

## Export buttons

Two buttons in the result state: "Export Markdown" and "Export JSON". Behavior and file naming
per `07`.

## Accessibility requirements (the panel must model what it audits)

- Exactly one `<h1>` (the panel title). Category sections use `<h2>`. Do not skip levels.
- Severity and status are always rendered as text, never color-only. Color may supplement.
- Every control has an accessible name (native `<label>` association or text content).
- Logical tab order; all interactive elements keyboard-operable (native `<button>`,
  `<select>`, and expand/collapse via `<button>` or `<details>/<summary>`).
- Use `<details>/<summary>` for expand/collapse unless a custom control is needed; if custom,
  manage `aria-expanded`.
- Use ARIA only where native semantics are insufficient.
- The loading and error states must be announced: wrap the status region in
  `role="status"` (`aria-live="polite"`).

## State management

Local React state only (`useState`/`useReducer`). No global store, no persistence, no
`localStorage`/`sessionStorage`. The finalized `AuditReport` is held in panel state and drives
rendering, filtering, and export.
