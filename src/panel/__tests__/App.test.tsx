// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { makeSnapshot } from '../../__fixtures__/makeSnapshot';
import App from '../App';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const snapshot = makeSnapshot({
  primaryCta: null,
  jsonLd: [],
  topContentText: 'Short.',
});

function listenerTarget() {
  return { addListener: () => {}, removeListener: () => {} };
}

describe('App', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as Record<string, unknown>).chrome = {
      tabs: {
        query: async () => [{ id: 1, url: snapshot.url, title: 'Test page' }],
        onActivated: listenerTarget(),
        onUpdated: listenerTarget(),
      },
      runtime: {
        lastError: undefined,
        sendMessage: (_message: unknown, callback: (response: unknown) => void) => {
          callback({ type: 'AUDIT_RESULT', snapshot, rawHtmlString: '<main>Short.</main>' });
        },
      },
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });
    const auditButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Audit Page',
    );
    if (!auditButton) throw new Error('Audit button not found.');
    await act(async () => {
      auditButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('audits without showing a purpose selector', () => {
    expect(container.textContent).toContain('Page type: Not identified. Shared page checks applied.');
    expect(container.textContent).not.toContain('Page purpose');
  });

  it('switches between light and dark themes', () => {
    const toggle = container.querySelector<HTMLButtonElement>('[role="switch"]');
    if (!toggle) throw new Error('Theme toggle not found.');

    expect(container.firstElementChild?.getAttribute('data-theme')).toBe('light');
    act(() => toggle.click());
    expect(container.firstElementChild?.getAttribute('data-theme')).toBe('dark');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('offers page evidence copy and download actions', () => {
    const actions = [...container.querySelectorAll('button')].filter(
      (button) => button.textContent === 'Page evidence',
    );
    expect(actions).toHaveLength(2);
  });
});
