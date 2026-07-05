// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from 'react-dom/test-utils';

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
    createRoot(container).render(<AiSearchView snapshot={snapshot} report={report} />);
  });
  return container;
}

describe('AiSearchView', () => {
  it('renders assistant previews, signals, pillars, and the skip list without crashing', () => {
    const container = renderView();
    const text = container.textContent ?? '';
    expect(text).toContain('Google AI Overviews');
    expect(text).toContain('Google AI Mode');
    expect(text).toContain('Browsing chat assistants');
    expect(text).toContain('Citation signals');
    expect(text).toContain('AEO / GEO readiness');
    expect(text).toContain('Per Google, you can skip');
    expect(text).toContain('Simulated preview');
    // Simulated citation card shows the page's own metadata.
    expect(text).toContain('Example Product — Fast, Simple, Reliable');
  });

  it('shows the exclusion state for a noindexed page', () => {
    const container = renderView(makeSnapshot({ meta: { robots: 'noindex' } }));
    const text = container.textContent ?? '';
    expect(text).toContain('excluded');
    expect(text).toContain('noindex');
  });
});
