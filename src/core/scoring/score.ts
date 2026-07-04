// Scoring — see 05-scoring.md. Deterministic and transparent. Pure (no chrome.*/DOM).

import type {
  AuditCategoryScore,
  AuditIssue,
  AuditReport,
  CategoryId,
  PageSnapshot,
} from '../types';
import { CATEGORY_LABELS, CATEGORY_WEIGHTS } from './weights';

const SEVERITY_POINTS = { high: 10, medium: 6, low: 3 } as const;
const STATUS_MULTIPLIER = { fail: 1.0, warn: 0.5, info: 0, pass: 0 } as const;

// Report/category order follows weights.ts key order.
const CATEGORY_ORDER: CategoryId[] = [
  'metadata',
  'content',
  'structured-data',
  'rendering-risk',
  'cta',
  'accessibility',
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function bandFor(score: number): string {
  if (score >= 90) return 'Strong readiness';
  if (score >= 75) return 'Good, with targeted fixes';
  if (score >= 50) return 'Moderate risk';
  return 'Major improvement needed';
}

export function scoreAudit(snapshot: PageSnapshot, issues: AuditIssue[]): AuditReport {
  // 1. compute scoreImpact for every issue (mutate)
  for (const issue of issues) {
    issue.scoreImpact = SEVERITY_POINTS[issue.severity] * STATUS_MULTIPLIER[issue.status];
  }

  // 2 + 3. bucket by category; build all six category scores in weights key order
  const categories: AuditCategoryScore[] = CATEGORY_ORDER.map((id) => {
    const catIssues = issues.filter((i) => i.category === id);
    const max = CATEGORY_WEIGHTS[id];
    const penalty = catIssues.reduce((sum, i) => sum + i.scoreImpact, 0);
    return {
      id,
      label: CATEGORY_LABELS[id],
      score: clamp(max - penalty, 0, max),
      maxScore: max,
      issues: catIssues,
    };
  });

  // 4. overall score
  const overallScore = clamp(
    Math.round(categories.reduce((sum, c) => sum + c.score, 0)),
    0,
    100,
  );

  // 5 + 6. band + report
  return {
    pageUrl: snapshot.url,
    pageTitle: snapshot.meta.title ?? '',
    pageType: snapshot.pageType,
    auditedAt: snapshot.capturedAt,
    overallScore,
    band: bandFor(overallScore),
    categories,
  };
}
