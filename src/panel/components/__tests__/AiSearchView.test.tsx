// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from 'react';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot } from 'react-dom/client';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import { ALL_RULES } from '../../../core/rules';
import { scoreAudit } from '../../../core/scoring/score';
import type { AuditIssue } from '../../../core/types';
import { AiSearchView } from '../AiSearchView';

function renderView(snapshot = makeSnapshot()) {
  const issues = ALL_RULES.map((r) => r(snapshot)).filter((i): i is AuditIssue => i !== null);
  const report = scoreAudit(snapshot, issues);
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(
      <AiSearchView snapshot={snapshot} report={report} questions={[]} onQuestionsChange={() => {}} />,
    );
  });
  return container;
}

describe('AiSearchView', () => {
  it('renders local readiness conditions, question coverage, and Google guidance', () => {
    const container = renderView();
    const text = container.textContent ?? '';
    expect(text).toContain('local readiness check');
    expect(text).toContain('Readiness conditions');
    expect(text).toContain('Question coverage');
    expect(text).toContain('Action path');
    expect(text).toContain('Google guidance');
    expect(text).toContain('What Google says you can skip');
    expect(text).not.toContain('citation likelihood');
  });

  it('keeps noindex as an explicit Google-guidance blocker', () => {
    const container = renderView(makeSnapshot({ meta: { robots: 'noindex' } }));
    const text = container.textContent ?? '';
    expect(text).toContain('noindex');
  });

  it('keeps universal readiness available for an unknown page type', () => {
    const container = renderView(makeSnapshot({ pageType: 'unknown' }));
    const text = container.textContent ?? '';

    expect(text).toContain('without assuming a page type');
    expect(text).toContain('Readiness conditions');
    expect(text).toContain('Question coverage');
    expect(text).not.toContain('Action path');
    expect(text).not.toContain('readiness conditions are unavailable');
  });
});
