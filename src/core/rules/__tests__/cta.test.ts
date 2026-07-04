import { describe, it, expect } from 'vitest';
import type { AuditIssue } from '../../types';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import { ctaMissingPrimary, ctaGenericPrimary } from '../cta';

function assertIssue(
  issue: AuditIssue | null,
  expected: { id: string; category: string; severity: string; status: string },
): void {
  expect(issue).not.toBeNull();
  if (!issue) return;
  expect(issue.id).toBe(expected.id);
  expect(issue.category).toBe(expected.category);
  expect(issue.severity).toBe(expected.severity);
  expect(issue.status).toBe(expected.status);
  expect(issue.evidence.length).toBeGreaterThan(0);
}

describe('cta rules', () => {
  it('cta.missing-primary fires for product with no CTA', () => {
    assertIssue(ctaMissingPrimary(makeSnapshot({ pageType: 'product', primaryCta: null })), {
      id: 'cta.missing-primary',
      category: 'cta',
      severity: 'medium',
      status: 'warn',
    });
  });
  it('cta.missing-primary null for article (gate) with no CTA', () => {
    expect(ctaMissingPrimary(makeSnapshot({ pageType: 'article', primaryCta: null }))).toBeNull();
  });

  it('cta.generic-primary fires on a vague label', () => {
    assertIssue(
      ctaGenericPrimary(
        makeSnapshot({ primaryCta: { text: 'Learn more', accessibleName: 'Learn more' } }),
      ),
      { id: 'cta.generic-primary', category: 'cta', severity: 'low', status: 'warn' },
    );
  });
  it('cta.generic-primary null on a specific label', () => {
    expect(ctaGenericPrimary(makeSnapshot())).toBeNull();
  });
});
