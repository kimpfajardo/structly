import { describe, it, expect } from 'vitest';
import type { AuditIssue, AuditReport, CategoryId, PageType } from '../../types';
import { CATEGORY_LABELS, CATEGORY_WEIGHTS } from '../../scoring/weights';
import { exportJson } from '../json';
import { exportMarkdown } from '../markdown';

const ORDER: CategoryId[] = [
  'metadata',
  'content',
  'structured-data',
  'rendering-risk',
  'cta',
  'accessibility',
];

const canonicalIssue: AuditIssue = {
  id: 'meta.missing-canonical',
  category: 'metadata',
  severity: 'medium',
  status: 'warn',
  title: 'Missing canonical link',
  whyItMatters: 'A canonical link tells systems which URL is the preferred version of the page.',
  evidence: ['No <link rel="canonical"> found.'],
  recommendedFix: 'Add a canonical URL for the preferred version of this page.',
  selectors: ['link[rel="canonical"]'],
  scoreImpact: 3,
};

function makeReport(opts: {
  issuesByCat?: Partial<Record<CategoryId, AuditIssue[]>>;
  scoresByCat?: Partial<Record<CategoryId, number>>;
  overallScore: number;
  band: string;
  pageTitle?: string;
}): AuditReport {
  const categories = ORDER.map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    score: opts.scoresByCat?.[id] ?? CATEGORY_WEIGHTS[id],
    maxScore: CATEGORY_WEIGHTS[id],
    issues: opts.issuesByCat?.[id] ?? [],
  }));
  return {
    pageUrl: 'https://example.com/',
    pageTitle: opts.pageTitle ?? 'My Page',
    pageType: 'product' as PageType,
    auditedAt: '2026-07-04T00:00:00.000Z',
    overallScore: opts.overallScore,
    band: opts.band,
    categories,
  };
}

describe('exportJson', () => {
  it('round-trips to the same report', () => {
    const report = makeReport({
      issuesByCat: { metadata: [canonicalIssue] },
      scoresByCat: { metadata: 17 },
      overallScore: 97,
      band: 'Strong readiness',
    });
    expect(JSON.parse(exportJson(report))).toEqual(report);
  });
});

describe('exportMarkdown', () => {
  it('matches the exact expected structure', () => {
    const report = makeReport({
      issuesByCat: { metadata: [canonicalIssue] },
      scoresByCat: { metadata: 17 },
      overallScore: 97,
      band: 'Strong readiness',
    });
    const expected = [
      '# Audit Report: My Page',
      '',
      '- URL: https://example.com/',
      '- Page type: product',
      '- Audited at: 2026-07-04T00:00:00.000Z',
      '- Overall score: 97 (Strong readiness)',
      '',
      '## Scores',
      '',
      '| Category | Score |',
      '|---|---|',
      '| Metadata and technical basics | 17/20 |',
      '| Content structure and answerability | 20/20 |',
      '| Structured data | 15/15 |',
      '| Rendering and hydration risk | 20/20 |',
      '| CTA and action clarity | 15/15 |',
      '| Agent and accessibility signals | 10/10 |',
      '',
      '## Issues',
      '',
      '### Metadata and technical basics',
      '',
      '#### Missing canonical link',
      '- Severity: medium',
      '- Status: warn',
      '- Why it matters: A canonical link tells systems which URL is the preferred version of the page.',
      '- Evidence:',
      '  - No <link rel="canonical"> found.',
      '- Recommended fix: Add a canonical URL for the preferred version of this page.',
      '- Selectors: link[rel="canonical"]',
    ].join('\n');
    expect(exportMarkdown(report)).toBe(expected);
  });

  it('emits "No issues detected." and no category blocks when clean', () => {
    const md = exportMarkdown(makeReport({ overallScore: 100, band: 'Strong readiness' }));
    expect(md).toContain('No issues detected.');
    expect(md).not.toContain('###');
  });

  it('omits the Selectors bullet when selectors is empty', () => {
    const noSelectors: AuditIssue = { ...canonicalIssue, selectors: [] };
    const md = exportMarkdown(
      makeReport({
        issuesByCat: { metadata: [noSelectors] },
        scoresByCat: { metadata: 17 },
        overallScore: 97,
        band: 'Strong readiness',
      }),
    );
    expect(md).toContain('#### Missing canonical link');
    expect(md).not.toContain('- Selectors:');
  });

  it('renders "Untitled page" in the H1 when title is empty', () => {
    const md = exportMarkdown(
      makeReport({ overallScore: 100, band: 'Strong readiness', pageTitle: '' }),
    );
    expect(md).toContain('# Audit Report: Untitled page');
  });
});
