import { describe, it, expect } from 'vitest';
import type { AuditIssue } from '../../types';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import {
  a11yMissingMain,
  a11yUnlabeledControls,
  a11yIconButtonNoName,
  a11yVagueLinkText,
} from '../accessibility';

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

describe('accessibility rules', () => {
  it('a11y.missing-main fires when no main landmark', () => {
    assertIssue(a11yMissingMain(makeSnapshot({ landmarks: { hasMain: false } })), {
      id: 'a11y.missing-main',
      category: 'accessibility',
      severity: 'medium',
      status: 'warn',
    });
  });
  it('a11y.missing-main null when main present', () => {
    expect(a11yMissingMain(makeSnapshot())).toBeNull();
  });

  it('a11y.unlabeled-controls fires on an unlabeled control', () => {
    assertIssue(
      a11yUnlabeledControls(
        makeSnapshot({
          formControls: [{ tag: 'input', type: 'text', hasLabel: false, accessibleName: '' }],
        }),
      ),
      {
        id: 'a11y.unlabeled-controls',
        category: 'accessibility',
        severity: 'high',
        status: 'fail',
      },
    );
  });
  it('a11y.unlabeled-controls null when controls are labeled', () => {
    expect(a11yUnlabeledControls(makeSnapshot())).toBeNull();
  });

  it('a11y.icon-button-no-name fires on an unnamed icon button', () => {
    assertIssue(
      a11yIconButtonNoName(
        makeSnapshot({ buttons: [{ text: '', accessibleName: '', isIconOnly: true }] }),
      ),
      {
        id: 'a11y.icon-button-no-name',
        category: 'accessibility',
        severity: 'high',
        status: 'fail',
      },
    );
  });
  it('a11y.icon-button-no-name null when none', () => {
    expect(a11yIconButtonNoName(makeSnapshot())).toBeNull();
  });

  it('a11y.vague-link-text fires when >= 2 vague links', () => {
    assertIssue(
      a11yVagueLinkText(
        makeSnapshot({
          links: [
            { text: 'learn more', accessibleName: 'learn more', href: 'https://example.com/a' },
            { text: 'click here', accessibleName: 'click here', href: 'https://example.com/b' },
          ],
        }),
      ),
      { id: 'a11y.vague-link-text', category: 'accessibility', severity: 'low', status: 'warn' },
    );
  });
  it('a11y.vague-link-text null when fewer than 2', () => {
    expect(
      a11yVagueLinkText(
        makeSnapshot({
          links: [
            { text: 'learn more', accessibleName: 'learn more', href: 'https://example.com/a' },
          ],
        }),
      ),
    ).toBeNull();
  });
});
