import { describe, it, expect } from 'vitest';
import type { AuditIssue } from '../../types';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import {
  contentMissingH1,
  contentMultipleH1,
  contentHeadingSkip,
  contentMissingSummary,
} from '../content';

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

describe('content rules', () => {
  it('content.missing-h1 fires when h1Count is 0', () => {
    assertIssue(contentMissingH1(makeSnapshot({ h1Count: 0 })), {
      id: 'content.missing-h1',
      category: 'content',
      severity: 'high',
      status: 'fail',
    });
  });
  it('content.missing-h1 null with one h1', () => {
    expect(contentMissingH1(makeSnapshot())).toBeNull();
  });

  it('content.multiple-h1 fires when h1Count > 1', () => {
    assertIssue(contentMultipleH1(makeSnapshot({ h1Count: 3 })), {
      id: 'content.multiple-h1',
      category: 'content',
      severity: 'medium',
      status: 'warn',
    });
  });
  it('content.multiple-h1 null with one h1', () => {
    expect(contentMultipleH1(makeSnapshot())).toBeNull();
  });

  it('content.heading-skip fires on H1 -> H3', () => {
    assertIssue(
      contentHeadingSkip(
        makeSnapshot({ headings: [{ level: 1, text: 'A' }, { level: 3, text: 'B' }] }),
      ),
      { id: 'content.heading-skip', category: 'content', severity: 'medium', status: 'warn' },
    );
  });
  it('content.heading-skip null on sequential headings', () => {
    expect(
      contentHeadingSkip(
        makeSnapshot({ headings: [{ level: 1, text: 'A' }, { level: 2, text: 'B' }] }),
      ),
    ).toBeNull();
  });

  it('content.missing-summary fires for docs with short top text', () => {
    assertIssue(
      contentMissingSummary(makeSnapshot({ pageType: 'docs', topContentText: 'Short.' })),
      { id: 'content.missing-summary', category: 'content', severity: 'medium', status: 'warn' },
    );
  });
  it('content.missing-summary null for account (gate) even with short top text', () => {
    expect(
      contentMissingSummary(makeSnapshot({ pageType: 'account', topContentText: 'Short.' })),
    ).toBeNull();
  });
});
