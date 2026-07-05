import { describe, it, expect } from 'vitest';
import type { AuditIssue, AuditReport, CategoryId, PageType } from '../../types';
import { CATEGORY_LABELS, CATEGORY_WEIGHTS } from '../../scoring/weights';
import { actionableIssues, buildFixPrompt, buildIssueFixPrompt } from '../prompt';

const ORDER: CategoryId[] = [
  'metadata',
  'content',
  'structured-data',
  'rendering-risk',
  'cta',
  'accessibility',
];

function makeIssue(overrides: Partial<AuditIssue>): AuditIssue {
  return {
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
    ...overrides,
  };
}

function makeReport(opts: {
  issuesByCat?: Partial<Record<CategoryId, AuditIssue[]>>;
  overallScore?: number;
  band?: string;
  pageTitle?: string;
}): AuditReport {
  const categories = ORDER.map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    score: CATEGORY_WEIGHTS[id],
    maxScore: CATEGORY_WEIGHTS[id],
    issues: opts.issuesByCat?.[id] ?? [],
  }));
  return {
    pageUrl: 'https://example.com/',
    pageTitle: opts.pageTitle ?? 'My Page',
    pageType: 'product' as PageType,
    auditedAt: '2026-07-04T00:00:00.000Z',
    overallScore: opts.overallScore ?? 97,
    band: opts.band ?? 'Strong readiness',
    categories,
  };
}

describe('actionableIssues', () => {
  it('excludes info issues', () => {
    const report = makeReport({
      issuesByCat: {
        metadata: [makeIssue({ id: 'a', status: 'info' }), makeIssue({ id: 'b', status: 'warn' })],
      },
    });
    expect(actionableIssues(report).map((i) => i.id)).toEqual(['b']);
  });

  it('orders failures before warnings, high severity first, report order as tie-break', () => {
    const report = makeReport({
      issuesByCat: {
        metadata: [
          makeIssue({ id: 'warn-med-1', status: 'warn', severity: 'medium' }),
          makeIssue({ id: 'fail-med', status: 'fail', severity: 'medium' }),
        ],
        content: [
          makeIssue({ id: 'fail-high', category: 'content', status: 'fail', severity: 'high' }),
          makeIssue({ id: 'warn-med-2', category: 'content', status: 'warn', severity: 'medium' }),
        ],
        accessibility: [
          makeIssue({ id: 'warn-low', category: 'accessibility', status: 'warn', severity: 'low' }),
        ],
      },
    });
    expect(actionableIssues(report).map((i) => i.id)).toEqual([
      'fail-high',
      'fail-med',
      'warn-med-1',
      'warn-med-2',
      'warn-low',
    ]);
  });
});

describe('buildFixPrompt', () => {
  it('matches the exact expected structure', () => {
    const report = makeReport({
      issuesByCat: { metadata: [makeIssue({})] },
      overallScore: 97,
      band: 'Strong readiness',
    });
    const expected = [
      'You are helping me fix issues found by an automated page-readiness audit of a live web page.',
      '',
      'Page: https://example.com/',
      'Title: My Page',
      'Page type: product',
      'Overall score: 97/100 (Strong readiness)',
      'Actionable findings: 0 failures, 1 warning',
      '',
      'The evidence below was collected from the rendered page, not from source code. Ask me for the relevant source files before making changes.',
      '',
      '## 1. Missing canonical link',
      '- Rule: meta.missing-canonical',
      '- Status: warn (medium severity)',
      '- Category: Metadata and technical basics',
      '- Why it matters: A canonical link tells systems which URL is the preferred version of the page.',
      '- Evidence:',
      '  - No <link rel="canonical"> found.',
      '- Recommended fix: Add a canonical URL for the preferred version of this page.',
      '- Selectors: link[rel="canonical"]',
      '',
      'Instructions:',
      '1. Work through the findings in order; failures first.',
      '2. Make the smallest change that resolves each finding — preserve existing content, design, and behavior.',
      '3. If a finding does not apply to my stack or looks like a false positive, say so and skip it instead of forcing a change.',
      '4. When you are done, list what changed per finding so I can re-run the audit.',
    ].join('\n');
    expect(buildFixPrompt(report)).toBe(expected);
  });

  it('says nothing to fix and omits instructions when there are no fail/warn findings', () => {
    const prompt = buildFixPrompt(
      makeReport({ issuesByCat: { metadata: [makeIssue({ status: 'info' })] } }),
    );
    expect(prompt).toContain('No failing or warning findings — nothing to fix.');
    expect(prompt).not.toContain('Instructions:');
    expect(prompt).not.toContain('## 1.');
  });

  it('renders "Untitled page" when the title is empty and pluralizes counts', () => {
    const report = makeReport({
      pageTitle: '',
      issuesByCat: {
        metadata: [makeIssue({ id: 'f1', status: 'fail' }), makeIssue({ id: 'f2', status: 'fail' })],
      },
    });
    const prompt = buildFixPrompt(report);
    expect(prompt).toContain('Title: Untitled page');
    expect(prompt).toContain('Actionable findings: 2 failures, 0 warnings');
  });
});

describe('buildIssueFixPrompt', () => {
  it('matches the exact expected structure', () => {
    const expected = [
      'You are helping me fix one issue found by an automated page-readiness audit of a live web page.',
      '',
      'Page: https://example.com/',
      'Page type: product',
      '',
      '## Missing canonical link',
      '- Rule: meta.missing-canonical',
      '- Status: warn (medium severity)',
      '- Category: Metadata and technical basics',
      '- Why it matters: A canonical link tells systems which URL is the preferred version of the page.',
      '- Evidence:',
      '  - No <link rel="canonical"> found.',
      '- Recommended fix: Add a canonical URL for the preferred version of this page.',
      '- Selectors: link[rel="canonical"]',
      '',
      'Instructions:',
      '1. The evidence was collected from the rendered page, not from source code — ask me for the relevant source files before making changes.',
      '2. Make the smallest change that resolves this finding — preserve existing content, design, and behavior.',
      '3. When you are done, summarize what changed so I can re-run the audit.',
    ].join('\n');
    expect(
      buildIssueFixPrompt(makeIssue({}), { url: 'https://example.com/', pageType: 'product' }),
    ).toBe(expected);
  });

  it('omits the Selectors bullet when selectors is empty', () => {
    const prompt = buildIssueFixPrompt(makeIssue({ selectors: [] }), {
      url: 'https://example.com/',
      pageType: 'product',
    });
    expect(prompt).not.toContain('- Selectors:');
  });
});
