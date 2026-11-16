// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      (button) => button.textContent === 'Audit page',
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

  it('returns to the opening screen on reset and can audit again', async () => {
    const reset = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Reset');
    if (!reset) throw new Error('Reset button not found.');
    await act(async () => reset.click());
    expect(container.textContent).toContain('See your pagemore clearly.');
    expect(container.querySelector('[aria-label="Audit summary"]')).toBeNull();

    const audit = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Audit page');
    if (!audit) throw new Error('Audit button not found.');
    await act(async () => audit.click());
    expect(container.querySelector('[aria-label="Audit summary"]')?.textContent).toContain('Checklist score');
    expect(container.textContent).not.toContain('See your pagemore clearly.');
  });

  it('opens a priority finding after clearing filters that hide it', () => {
    const priority = container.querySelector<HTMLButtonElement>('[aria-labelledby="fix-first-title"] ol button');
    if (!priority) throw new Error('Priority finding not found.');
    const title = priority.querySelector('span')?.textContent ?? '';
    const findDetail = () => [...container.querySelectorAll<HTMLDetailsElement>('details[id^="issue-"]')]
      .find((detail) => detail.querySelector('summary')?.textContent?.includes(title));

    const category = container.querySelector<HTMLButtonElement>('[role="combobox"]');
    if (!category) throw new Error('Category filter not found.');
    act(() => category.click());
    const metadata = container.querySelector<HTMLElement>('[id="category-filter-option-metadata"]');
    if (!metadata) throw new Error('Metadata filter option not found.');
    act(() => metadata.click());
    const infoFilter = container.querySelector<HTMLInputElement>('input[value="info"]');
    if (!infoFilter) throw new Error('Info filter not found.');
    act(() => infoFilter.click());
    expect(findDetail()).toBeUndefined();

    act(() => priority.click());
    expect(category.textContent).toContain('All categories');
    expect(container.querySelector<HTMLInputElement>('input[value="all"]')?.checked).toBe(true);
    const detail = findDetail();
    expect(detail?.open).toBe(true);
    expect(document.activeElement).toBe(detail?.querySelector('summary'));

    if (!detail) throw new Error('Priority detail not found.');
    detail.open = false;
    act(() => priority.click());
    expect(detail.open).toBe(true);
  });

  it('reports a failed report copy and clears the error after a successful retry', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const copy = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Copy AI fix prompt');
    if (!copy) throw new Error('Fix prompt action not found.');

    await act(async () => copy.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Copy failed');
    writeText.mockResolvedValueOnce(undefined);
    await act(async () => copy.click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(copy.textContent).toBe('Copied');
    expect(container.textContent).toContain('Copied to clipboard.');
  });

  it('reports per-finding copy failure when clipboard access is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const detail = container.querySelector<HTMLDetailsElement>('details[id^="issue-"]');
    if (!detail) throw new Error('Finding detail not found.');
    detail.open = true;
    const copy = [...detail.querySelectorAll('button')].find((button) => button.textContent === 'Copy');
    if (!copy) throw new Error('Finding copy action not found.');

    await act(async () => copy.click());
    expect(detail.querySelector('[role="alert"]')?.textContent).toContain('Copy failed');
  });

  it('offers page evidence copy and download actions', () => {
    const actions = [...container.querySelectorAll('button')].filter(
      (button) => button.textContent === 'Page evidence',
    );
    expect(actions).toHaveLength(2);
  });
});
