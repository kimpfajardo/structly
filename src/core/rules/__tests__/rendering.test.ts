import { describe, it, expect } from 'vitest';
import type { AuditIssue } from '../../types';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import {
  renderingLowInitialText,
  renderingSkeletonInMain,
  renderingAppShellEmptyRaw,
} from '../rendering';

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

describe('rendering-risk rules', () => {
  it('rendering.low-initial-text fails when raw available and thresholds met', () => {
    assertIssue(
      renderingLowInitialText(
        makeSnapshot({
          raw: { available: true, mainTextLength: 50, bodyTextLength: 1700 },
          rendered: { mainTextLength: 900 },
        }),
      ),
      {
        id: 'rendering.low-initial-text',
        category: 'rendering-risk',
        severity: 'high',
        status: 'fail',
      },
    );
  });
  it('rendering.low-initial-text is info when raw unavailable', () => {
    assertIssue(
      renderingLowInitialText(
        makeSnapshot({ raw: { available: false, mainTextLength: 0, bodyTextLength: 0 } }),
      ),
      {
        id: 'rendering.low-initial-text',
        category: 'rendering-risk',
        severity: 'high',
        status: 'info',
      },
    );
  });
  it('rendering.low-initial-text null when available but thresholds not met', () => {
    expect(renderingLowInitialText(makeSnapshot())).toBeNull();
  });

  it('rendering.skeleton-in-main fires when skeleton markers present', () => {
    assertIssue(
      renderingSkeletonInMain(makeSnapshot({ rendered: { hasSkeletonMarkers: true } })),
      {
        id: 'rendering.skeleton-in-main',
        category: 'rendering-risk',
        severity: 'medium',
        status: 'warn',
      },
    );
  });
  it('rendering.skeleton-in-main null when no markers', () => {
    expect(renderingSkeletonInMain(makeSnapshot())).toBeNull();
  });

  it('rendering.app-shell-empty-raw fails when available and body < 100', () => {
    assertIssue(
      renderingAppShellEmptyRaw(
        makeSnapshot({ raw: { available: true, mainTextLength: 1100, bodyTextLength: 50 } }),
      ),
      {
        id: 'rendering.app-shell-empty-raw',
        category: 'rendering-risk',
        severity: 'high',
        status: 'fail',
      },
    );
  });
  it('rendering.app-shell-empty-raw null when raw unavailable', () => {
    expect(
      renderingAppShellEmptyRaw(
        makeSnapshot({ raw: { available: false, mainTextLength: 0, bodyTextLength: 0 } }),
      ),
    ).toBeNull();
  });
});
