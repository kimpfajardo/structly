// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from 'react';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot } from 'react-dom/client';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import { analyzeSurfaceability } from '../../../core/surfaceability';
import { SurfaceabilityEvidence } from '../SurfaceabilityEvidence';

function renderEvidence(snapshot = makeSnapshot()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(<SurfaceabilityEvidence snapshot={snapshot} />);
  });
  return container;
}

describe('SurfaceabilityEvidence', () => {
  it('renders delivery counts and scope from a snapshot', () => {
    const text = renderEvidence().textContent ?? '';

    expect(text).toContain('Content delivery');
    expect(text).toContain('delivered');
    expect(text).toContain('Main: 1200 chars · page: 1800 chars');
    expect(text).toContain('Main: 1100 chars · page: 1700 chars');
    expect(text).toContain('ScopeMain content');
  });

  it('accepts a prepared analysis and renders unavailable raw HTML honestly', () => {
    const analysis = analyzeSurfaceability(
      makeSnapshot({ raw: { available: false, mainTextLength: 0, bodyTextLength: 0 } }),
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      createRoot(container).render(<SurfaceabilityEvidence analysis={analysis} />);
    });

    const text = container.textContent ?? '';
    expect(text).toContain('not verified');
    expect(text).toContain('Unavailable in this audit');
    expect(text).toContain('Re-audit when the initial HTML can be fetched.');
  });
});
