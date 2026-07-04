# 07 — Exports

Two exporters, both pure functions in `src/core/export/`. Input is an `AuditReport`. They must
be deterministic and covered by snapshot tests (`08`).

## Filenames

`audit-<hostname>-<YYYYMMDD>-<HHmmss>.md` and `...json`.

- `<hostname>`: `new URL(report.pageUrl).hostname`. If parsing fails, use `page`.
- Timestamp: derived from `report.auditedAt` in UTC. Format `YYYYMMDD-HHmmss` (zero-padded).

Download is triggered in the panel by creating a `Blob`, an object URL, and a temporary anchor
with `download` set to the filename, then revoking the URL. (Extensions may also use
`chrome.downloads`; the Blob/anchor approach is acceptable and preferred for simplicity.)

## JSON export (`src/core/export/json.ts`)

`exportJson(report: AuditReport): string` → `JSON.stringify(report, null, 2)`.

- Output is exactly the `AuditReport` object (all fields from `02`, including per-issue
  `scoreImpact`, `selectors`, category `maxScore`, `band`).
- Keys are the interface keys as-is. Do not reshape, rename, or omit.
- This is the CI/dashboard-stable format; stability matters — do not change the shape without a
  `schemaVersion` bump discussion (ask first).

## Markdown export (`src/core/export/markdown.ts`)

`exportMarkdown(report: AuditReport): string` producing exactly this structure:

```md
# Audit Report: <pageTitle or 'Untitled page'>

- URL: <pageUrl>
- Page type: <pageType>
- Audited at: <auditedAt>
- Overall score: <overallScore> (<band>)

## Scores

| Category | Score |
|---|---|
| <category label> | <score>/<maxScore> |
| ... one row per category, in report order ... |

## Issues

### <Category label>

#### <issue.title>
- Severity: <severity>
- Status: <status>
- Why it matters: <whyItMatters>
- Evidence:
  - <evidence line 1>
  - <evidence line 2>
- Recommended fix: <recommendedFix>
- Selectors: <selectors joined by ', '>   ← omit this bullet entirely if selectors is empty
```

Rules for the Issues section:
- Iterate categories in report order. For each category **that has at least one issue**, emit an
  `###` heading with the category label, then one `####` block per issue in the order the issues
  appear in that category's `issues` array.
- If a category has no issues, omit its `###` block.
- If the entire report has no issues, replace the Issues section body with a single line:
  `No issues detected.`
- `pageTitle` empty string → render `Untitled page` in the H1 only; the `- URL` etc. lines use
  the raw values.
- Do not use any color-only or emoji notation. Plain Markdown only.
