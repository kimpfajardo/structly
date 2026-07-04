# 05 — Scoring

Deterministic and transparent. Lives in `src/core/scoring/score.ts` and
`src/core/scoring/weights.ts`. The score exists for prioritization, not precision.

## Category weights and labels (`weights.ts`)

```ts
export const CATEGORY_WEIGHTS: Record<CategoryId, number> = {
  'metadata': 20,
  'content': 20,
  'structured-data': 15,
  'rendering-risk': 20,
  'cta': 15,
  'accessibility': 10,
}; // sums to 100

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  'metadata': 'Metadata and technical basics',
  'content': 'Content structure and answerability',
  'structured-data': 'Structured data',
  'rendering-risk': 'Rendering and hydration risk',
  'cta': 'CTA and action clarity',
  'accessibility': 'Agent and accessibility signals',
};
```

## Per-issue penalty

```ts
const SEVERITY_POINTS = { high: 10, medium: 6, low: 3 } as const;
const STATUS_MULTIPLIER = { fail: 1.0, warn: 0.5, info: 0, pass: 0 } as const;

// issue.scoreImpact = SEVERITY_POINTS[issue.severity] * STATUS_MULTIPLIER[issue.status]
```

Set `scoreImpact` on each issue to this computed value (overwriting the rule's `0`). Only
`fail` and `warn` issues reduce the score; `info` and `pass` contribute `0`.

## Algorithm

```
function scoreAudit(snapshot, issues): AuditReport
  // 1. compute scoreImpact for every issue (mutate issue.scoreImpact)
  // 2. bucket issues by category
  // 3. for each of the 6 categories:
  //      max = CATEGORY_WEIGHTS[id]
  //      penalty = sum of scoreImpact of that category's issues
  //      score = clamp(max - penalty, 0, max)
  //      build AuditCategoryScore { id, label, score, maxScore: max, issues }
  //    Always emit all 6 categories, even with zero issues.
  // 4. overallScore = clamp(round(sum of category scores), 0, 100)
  // 5. band = bandFor(overallScore)
  // 6. return AuditReport {
  //      pageUrl: snapshot.url,
  //      pageTitle: snapshot.meta.title ?? '',
  //      pageType: snapshot.pageType,
  //      auditedAt: snapshot.capturedAt,
  //      overallScore, band, categories,
  //    }
```

`round` = `Math.round`. `clamp(v, lo, hi) = Math.max(lo, Math.min(hi, v))`.

Category ordering in the report array follows `weights.ts` key order:
`metadata, content, structured-data, rendering-risk, cta, accessibility`.

## Interpretation bands (`bandFor`)

```
score >= 90            -> 'Strong readiness'
score >= 75 && < 90    -> 'Good, with targeted fixes'
score >= 50 && < 75    -> 'Moderate risk'
score < 50             -> 'Major improvement needed'
```

## Worked example (use as a self-check test in `08`)

Issues present:
- `meta.missing-canonical` — medium / warn → 6 × 0.5 = 3 (metadata)
- `content.multiple-h1` — medium / warn → 3 (content)
- `schema.invalid-jsonld` — high / fail → 10 (structured-data)
- `a11y.unlabeled-controls` — high / fail → 10 (accessibility)

Category scores:
- metadata: 20 − 3 = 17
- content: 20 − 3 = 17
- structured-data: 15 − 10 = 5
- rendering-risk: 20 − 0 = 20
- cta: 15 − 0 = 15
- accessibility: 10 − 10 = 0

overallScore = 17 + 17 + 5 + 20 + 15 + 0 = **74** → band **"Moderate risk"**.

A Vitest case must assert exactly these six category scores, `overallScore === 74`, and
`band === 'Moderate risk'`.
