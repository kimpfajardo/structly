import { describe, it, expect } from 'vitest';
import type { AuditIssue } from '../../types';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import {
  metaMissingTitle,
  metaTitleLength,
  metaMissingDescription,
  metaMissingCanonical,
  metaMultipleCanonical,
  metaMissingLang,
  metaRobotsNoindex,
  metaMissingViewport,
} from '../metadata';

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

describe('metadata rules', () => {
  it('meta.missing-title fires when title is null', () => {
    assertIssue(metaMissingTitle(makeSnapshot({ meta: { title: null } })), {
      id: 'meta.missing-title',
      category: 'metadata',
      severity: 'high',
      status: 'fail',
    });
  });
  it('meta.missing-title does not fire when title present', () => {
    expect(metaMissingTitle(makeSnapshot())).toBeNull();
  });

  it('meta.title-length fires when title too short', () => {
    assertIssue(metaTitleLength(makeSnapshot({ meta: { title: 'Short' } })), {
      id: 'meta.title-length',
      category: 'metadata',
      severity: 'low',
      status: 'warn',
    });
  });
  it('meta.title-length does not fire for a 10-70 char title', () => {
    expect(metaTitleLength(makeSnapshot())).toBeNull();
  });

  it('meta.missing-description fires when null', () => {
    assertIssue(metaMissingDescription(makeSnapshot({ meta: { metaDescription: null } })), {
      id: 'meta.missing-description',
      category: 'metadata',
      severity: 'medium',
      status: 'warn',
    });
  });
  it('meta.missing-description does not fire when present', () => {
    expect(metaMissingDescription(makeSnapshot())).toBeNull();
  });

  it('meta.missing-canonical fires when count is 0', () => {
    assertIssue(metaMissingCanonical(makeSnapshot({ meta: { canonicalCount: 0 } })), {
      id: 'meta.missing-canonical',
      category: 'metadata',
      severity: 'medium',
      status: 'warn',
    });
  });
  it('meta.missing-canonical does not fire when count is 1', () => {
    expect(metaMissingCanonical(makeSnapshot())).toBeNull();
  });

  it('meta.multiple-canonical fires when count > 1', () => {
    assertIssue(metaMultipleCanonical(makeSnapshot({ meta: { canonicalCount: 2 } })), {
      id: 'meta.multiple-canonical',
      category: 'metadata',
      severity: 'high',
      status: 'fail',
    });
  });
  it('meta.multiple-canonical does not fire when count is 1', () => {
    expect(metaMultipleCanonical(makeSnapshot())).toBeNull();
  });

  it('meta.missing-lang fires when null', () => {
    assertIssue(metaMissingLang(makeSnapshot({ meta: { lang: null } })), {
      id: 'meta.missing-lang',
      category: 'metadata',
      severity: 'medium',
      status: 'fail',
    });
  });
  it('meta.missing-lang does not fire when present', () => {
    expect(metaMissingLang(makeSnapshot())).toBeNull();
  });

  it('meta.robots-noindex fires when robots includes noindex', () => {
    assertIssue(metaRobotsNoindex(makeSnapshot({ meta: { robots: 'noindex, nofollow' } })), {
      id: 'meta.robots-noindex',
      category: 'metadata',
      severity: 'high',
      status: 'warn',
    });
  });
  it('meta.robots-noindex does not fire when robots null', () => {
    expect(metaRobotsNoindex(makeSnapshot())).toBeNull();
  });

  it('meta.missing-viewport fires when null', () => {
    assertIssue(metaMissingViewport(makeSnapshot({ meta: { viewport: null } })), {
      id: 'meta.missing-viewport',
      category: 'metadata',
      severity: 'low',
      status: 'warn',
    });
  });
  it('meta.missing-viewport does not fire when present', () => {
    expect(metaMissingViewport(makeSnapshot())).toBeNull();
  });
});
