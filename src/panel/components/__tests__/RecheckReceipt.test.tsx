// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import { scoreAudit } from '../../../core/scoring/score';
import { RecheckReceipt } from '../RecheckReceipt';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe('RecheckReceipt', () => {
  it('shows score, finding, and delivery deltas', () => {
    const beforeSnapshot = makeSnapshot({ raw: { mainTextLength: 20 } });
    const afterSnapshot = makeSnapshot({ raw: { mainTextLength: 240 } });
    const before = { report: scoreAudit(beforeSnapshot, []), snapshot: beforeSnapshot };
    const after = { report: scoreAudit(afterSnapshot, []), snapshot: afterSnapshot };
    const container = document.createElement('div');

    act(() => {
      createRoot(container).render(<RecheckReceipt before={before} after={after} />);
    });

    expect(container.textContent).toContain('Recheck receipt');
    expect(container.textContent).toContain('+220 characters');
  });
});
