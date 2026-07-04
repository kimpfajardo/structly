# Page Readiness Auditor — Build Specification (Index)

This repository of spec files is the **single source of truth** for building a Chrome
extension that audits web pages for metadata, content structure, structured data,
rendering/hydration risk, CTA clarity, and accessibility/agent-readiness.

The extension is deterministic and local-first. No AI/LLM is used for scoring. All checks
are pure functions over a serialized page snapshot.

---

## COMPLIANCE RULES (read first, non-negotiable)

1. **Do not deviate.** Implement exactly what these files specify. Every rule ID, severity,
   status, category ID, weight, and formula is fixed. Do not rename, add, remove, or
   "improve" them.
2. **If something is unspecified or ambiguous, stop and ask.** Do not guess. Do not invent
   rules, fields, dependencies, or behavior that is not written here.
3. **Do not add dependencies** beyond those listed in `09-build-config.md`.
4. **Do not add AI/LLM calls, network telemetry, analytics, or cloud sync.** The only
   network request the extension makes is the raw-HTML fetch defined in `01-architecture.md`.
5. **Identifiers are literal.** Rule IDs, category IDs, status/severity enum values, message
   `type` strings, and file paths must match the spec character-for-character.
6. **Determinism.** Given the same page, the audit output must be identical every run.
7. **Every rule and the scoring formula must have tests** as defined in
   `08-testing-acceptance.md`. Code without the specified tests is not "done."

Read all spec files in order before writing code:

| File | Contents |
|---|---|
| `00-README.md` | This index, compliance rules, product context, build order |
| `01-architecture.md` | Runtime contexts, message contract, data flow, raw-HTML approach |
| `02-data-model.md` | All TypeScript types + Zod schemas (PageSnapshot, AuditIssue, AuditReport) |
| `03-collectors.md` | Exact collection algorithms (accessible name, visibility, CTA, etc.) |
| `04-rules.md` | All 24 rules, each fully specified as a predicate |
| `05-scoring.md` | Exact scoring algorithm, weights, bands, worked example |
| `06-ui-panel.md` | Side panel structure, states, accessibility requirements |
| `07-exports.md` | Markdown + JSON export templates and filenames |
| `08-testing-acceptance.md` | Test requirements, fixtures, per-phase acceptance criteria |
| `09-build-config.md` | package.json, manifest, vite/tsconfig, folder structure, scripts |

---

## Product context (the "why", condensed)

**What it does:** One-click audit of the active browser tab. Produces a scored, categorized
issue report with evidence and recommended fixes, exportable as Markdown or JSON.

**Primary value / wedge:** It runs on authenticated, staging, and internal pages that public
crawlers and hosted SEO tools cannot reach. It consolidates technical SEO + accessibility +
rendering-risk + action clarity into one report.

**Users:** Frontend engineers validating pages pre-release; PMs reviewing discoverability and
conversion clarity; content/SEO stakeholders; platform teams defining page-quality standards.

**Non-goals (do not build):** site-wide crawling, ranking prediction, emulating search
ranking systems, historical dashboards, cloud sync, embedded LLM scoring.

---

## Locked technical decisions (rationale in `01`)

- **Snapshot is the seam.** Content script produces one serializable `PageSnapshot`. All rules
  are pure functions `(snapshot) => AuditIssue | null`. Rules never touch the DOM.
- **Where code runs:** content script = collect only; service worker = route + inject +
  raw-HTML fetch, holds no state; panel (React) = runs rules + scoring + rendering + export.
- **Rendering risk** is computed by comparing the live rendered DOM against the raw server
  HTML fetched separately. This is mandatory; a DOM-only heuristic is not acceptable.
- **Page type is first-class.** MVP uses a manual `<select>` in the panel that sets a scoring
  profile. Auto-detection is deferred. Some rules are gated/adjusted by page type.
- **Composite score is secondary in the UI.** The issue list leads; the number supports.

---

## Build order (implement in this sequence)

1. **Walking skeleton** (`09` + `01`): repo scaffold (Vite + CRXJS), manifest, empty panel that
   opens, content script that returns a hardcoded snapshot, service worker that routes it,
   panel renders the raw snapshot as JSON. Load unpacked and verify the round-trip works
   before writing any rule logic.
2. **Types + schemas** (`02`).
3. **Collectors** (`03`) — replace the hardcoded snapshot with real collection.
4. **Rules** (`04`) — all 24, with tests as you go (`08`).
5. **Scoring** (`05`) — with tests.
6. **Panel UI** (`06`) — full render, filters, expand/collapse, copy, page-type select.
7. **Exports** (`07`) — Markdown + JSON, with snapshot tests.
8. **E2E** (`08`) — Playwright collector tests over HTML fixtures.

Phase 1 (this spec) is complete when the Phase 1 acceptance checklist in `08` passes.
