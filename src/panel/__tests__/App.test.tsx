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
  let unmounted: boolean;

  async function click(label: string): Promise<void> {
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent === label);
    if (!button) throw new Error(`${label} button not found.`);
    await act(async () => button.click());
  }

  async function advance(milliseconds: number): Promise<void> {
    await act(async () => vi.advanceTimersByTimeAsync(milliseconds));
  }

  function deferEntrance(): () => void {
    let finish!: () => void;
    const entrance = new Promise<void>((resolve) => { finish = resolve; });
    let first = true;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (update: () => void) => {
        const finished = first ? entrance : Promise.resolve();
        first = false;
        return { ready: Promise.resolve(), finished, updateCallbackDone: Promise.resolve().then(update) };
      },
    });
    return finish;
  }

  function deferUpdates(): Array<() => void> {
    const commits: Array<() => void> = [];
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (update: () => void) => ({
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: new Promise<void>((resolve) => commits.push(() => {
          update();
          resolve();
        })),
      }),
    });
    return commits;
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    unmounted = false;
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
    await advance(2000);
  });

  afterEach(() => {
    if (!unmounted) act(() => root.unmount());
    container.remove();
    delete (document as Partial<Document>).startViewTransition;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
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

    const audits = [...container.querySelectorAll('button')].filter((button) => button.textContent === 'Audit Page');
    expect(audits).toHaveLength(1);
    const [audit] = audits;
    if (!audit) throw new Error('Audit button not found.');
    expect(audit.closest('[aria-hidden="true"]')).toBeNull();
    expect(container.textContent).not.toContain('Initial HTML');
    expect(container.textContent).not.toContain('Rendered page');
    await act(async () => audit.click());
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    await advance(1999);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    await advance(1);
    expect(container.querySelector('[aria-label="Audit summary"]')?.textContent).toContain('Checklist score');
    expect(container.textContent).not.toContain('See your pagemore clearly.');
  });

  it('offers three accessible learning cards only on the opening screen', async () => {
    const rail = () => container.querySelector<HTMLUListElement>('ul[aria-label="Learn about SEO, AEO, and GEO"]');
    expect(rail()).toBeNull();
    await click('Reset');
    const topics = rail();
    if (!topics) throw new Error('Learning cards not found.');
    expect(topics.tabIndex).toBe(0);
    const cards = [...topics.querySelectorAll(':scope > li')];
    expect(cards).toHaveLength(3);
    for (const [topic, href] of [
      ['SEO', 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide'],
      ['AEO', 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide'],
      ['GEO', 'https://arxiv.org/abs/2311.09735'],
    ]) {
      const card = cards.find((item) => item.querySelector('h3')?.textContent === topic);
      expect(card, `${topic} card`).toBeDefined();
      expect(card?.querySelector('img')?.getAttribute('alt')?.trim()).toBeTruthy();
      const source = card?.querySelector('a');
      expect(source?.getAttribute('href')).toBe(href);
      expect(source?.getAttribute('aria-label') ?? source?.textContent).toContain(topic);
      expect(source?.target).toBe('_blank');
      expect(source?.relList.contains('noreferrer')).toBe(true);
    }
    await click('Audit Page');
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    expect(rail()).toBeNull();
    await advance(2000);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('result');
    expect(rail()).toBeNull();
  });

  it('shows the loading scene until completion and ignores a response after reset', async () => {
    const replies: Array<(response: unknown) => void> = [];
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const play = vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    const pause = vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    Object.defineProperty(chrome.runtime, 'sendMessage', {
      value: (_message: unknown, callback: (response: unknown) => void) => replies.push(callback),
    });
    await click('Recheck page');
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Reading your page.');
    expect([...container.querySelectorAll('button')].find((button) => button.textContent === 'Auditing…')?.disabled).toBe(true);
    expect(container.querySelector('[aria-label="Audit summary"]')).toBeNull();
    const video = container.querySelector('video');
    if (!video) throw new Error('Loading video not found.');
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.preload).toBe('auto');
    expect(video.autoplay).toBe(false);
    expect(video.controls).toBe(false);
    expect(video.getAttribute('src')).toMatch(/\.mp4$/);
    expect(video.getAttribute('poster')).toBeTruthy();
    expect(video.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(video.playbackRate).toBe(1);
    expect(play).toHaveBeenCalledOnce();
    expect(play.mock.contexts[0]).toBe(video);

    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(container.firstElementChild?.getAttribute('data-motion')).toBe('paused');
    expect(pause.mock.contexts).toContain(video);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(container.firstElementChild?.getAttribute('data-motion')).toBe('running');
    expect(play).toHaveBeenCalledTimes(2);

    await advance(2500);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    act(() => replies[0]?.({ type: 'AUDIT_RESULT', snapshot, rawHtmlString: '<main>Short.</main>' }));
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('result');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Audit complete.');
    expect(container.textContent).not.toContain('Reading your page.');
    const resultVideo = container.querySelector<HTMLVideoElement>('[aria-label="Audit summary"] video');
    if (!resultVideo) throw new Error('Result video not found.');
    expect(resultVideo).not.toBe(video);
    expect(resultVideo.playbackRate).toBe(0.5);
    expect(resultVideo.muted).toBe(true);
    expect(resultVideo.loop).toBe(true);
    expect(resultVideo.playsInline).toBe(true);
    expect(resultVideo.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(play.mock.contexts).toContain(resultVideo);
    expect(pause.mock.contexts.filter((instance) => instance === video)).toHaveLength(2);
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(pause.mock.contexts).toContain(resultVideo);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(play.mock.contexts.at(-1)).toBe(resultVideo);

    await click('Recheck page');
    const pauseCount = pause.mock.calls.length;
    await click('Reset');
    expect(container.querySelector('video')).toBeNull();
    expect(pause).toHaveBeenCalledTimes(pauseCount + 1);
    act(() => replies[1]?.({ type: 'AUDIT_RESULT', snapshot, rawHtmlString: '<main>Short.</main>' }));
    await advance(2000);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('idle');
    expect(container.querySelector('[aria-label="Audit summary"]')).toBeNull();
  });

  it('replaces the loading scene with an audit error and permits retry', async () => {
    let reply: ((response: unknown) => void) | undefined;
    Object.defineProperty(chrome.runtime, 'sendMessage', {
      value: (_message: unknown, callback: (response: unknown) => void) => { reply = callback; },
    });
    const recheck = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Recheck page');
    if (!recheck) throw new Error('Recheck button not found.');
    await act(async () => recheck.click());
    act(() => reply?.({ type: 'AUDIT_ERROR', message: 'Could not read this page.' }));
    await advance(1999);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    await advance(1);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('error');
    expect(container.querySelector('[aria-label="Learn about SEO, AEO, and GEO"]')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Could not read this page.');
    expect(container.textContent).not.toContain('Reading your page.');
    expect([...container.querySelectorAll('button')].find((button) => button.textContent === 'Audit Page')?.disabled).toBe(false);
  });

  it('keeps a fast audit loading for two seconds after the loading view appears', async () => {
    await click('Recheck page');
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    await advance(1999);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    await advance(1);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('result');
  });

  it('shows the fully entered loading scene for two seconds before a fast result', async () => {
    const finishEntrance = deferEntrance();
    await click('Recheck page');
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    await advance(360);
    await act(async () => finishEntrance());
    await advance(1999);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    await advance(1);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('result');
  });

  it('does not resume an audit when its entrance finishes after reset', async () => {
    const finishEntrance = deferEntrance();
    const sendMessage = vi.spyOn(chrome.runtime, 'sendMessage');
    await click('Recheck page');
    await advance(100);
    await click('Reset');
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('idle');
    await act(async () => finishEntrance());
    await advance(3000);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('idle');
  });

  it('keeps loading time through reduced-motion changes and rejected video playback', async () => {
    const listeners: Array<() => void> = [];
    const preference = {
      matches: true,
      addEventListener: vi.fn((_event: string, listener: () => void) => listeners.push(listener)),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', () => preference);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const play = vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    const pause = vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    await click('Recheck page');
    expect(play).not.toHaveBeenCalled();
    expect(pause).toHaveBeenCalled();
    expect(container.firstElementChild?.getAttribute('data-motion')).toBe('paused');
    expect(listeners).toHaveLength(1);
    play.mockRejectedValueOnce(new Error('Autoplay denied.'));
    preference.matches = false;
    await act(async () => listeners[0]!());
    expect(play).toHaveBeenCalledOnce();
    expect(container.firstElementChild?.getAttribute('data-motion')).toBe('running');
    preference.matches = true;
    act(() => listeners[0]!());
    expect(container.firstElementChild?.getAttribute('data-motion')).toBe('paused');
    await advance(1999);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    await advance(1);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('result');
    expect(preference.removeEventListener).toHaveBeenCalledWith('change', listeners[0]);
    expect(listeners).toHaveLength(2);
    const resultVideo = container.querySelector('video');
    expect(resultVideo?.playbackRate).toBe(0.5);
    expect(container.firstElementChild?.getAttribute('data-motion')).toBe('paused');
    preference.matches = false;
    await act(async () => listeners[1]!());
    expect(play.mock.contexts.at(-1)).toBe(resultVideo);
    await click('Reset');
    expect(preference.removeEventListener).toHaveBeenCalledWith('change', listeners[1]);
    expect(container.querySelector('video')).toBeNull();
  });

  it('pauses the result video offscreen and cleans up on reset', async () => {
    let notify!: (entries: Array<Pick<IntersectionObserverEntry, 'isIntersecting'>>) => void;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', vi.fn((callback: typeof notify) => {
      notify = callback;
      return { observe, disconnect };
    }));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    await click('Recheck page');
    await advance(2000);
    const video = container.querySelector<HTMLVideoElement>('[aria-label="Audit summary"] video');
    if (!video) throw new Error('Result video not found.');
    expect(observe).toHaveBeenLastCalledWith(video);
    const play = vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    const pause = vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    act(() => notify([{ isIntersecting: false }]));
    expect(pause).toHaveBeenCalledOnce();
    expect(pause.mock.contexts[0]).toBe(video);
    expect(container.firstElementChild?.getAttribute('data-motion')).toBe('paused');
    act(() => notify([{ isIntersecting: true }]));
    expect(play).toHaveBeenCalledOnce();
    expect(play.mock.contexts[0]).toBe(video);
    expect(video.playbackRate).toBe(0.5);
    expect(container.querySelector('[aria-label="Pause background video"]')).toBeNull();
    expect(container.querySelector('[aria-label="Play background video"]')).toBeNull();
    expect(container.firstElementChild?.getAttribute('data-motion')).toBe('running');
    const disconnectCount = disconnect.mock.calls.length;
    const beforeReset = notify;
    await click('Reset');
    expect(disconnect).toHaveBeenCalledTimes(disconnectCount + 1);
    expect(container.querySelector('video')).toBeNull();
    const playsAfterReset = play.mock.calls.length;
    act(() => beforeReset([{ isIntersecting: true }]));
    expect(play).toHaveBeenCalledTimes(playsAfterReset);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('idle');
  });

  it('cancels a pending completion when reset is clicked', async () => {
    await click('Recheck page');
    await advance(500);
    await click('Reset');
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('idle');
    await advance(2000);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('idle');
    expect(container.querySelector('[aria-label="Audit summary"]')).toBeNull();
  });

  it('ignores an old reply after reset starts a new audit', async () => {
    const replies: Array<(response: unknown) => void> = [];
    Object.defineProperty(chrome.runtime, 'sendMessage', {
      value: (_message: unknown, callback: (response: unknown) => void) => replies.push(callback),
    });
    await click('Recheck page');
    await advance(500);
    await click('Reset');
    await click('Audit Page');
    act(() => replies[0]?.({ type: 'AUDIT_ERROR', message: 'Old audit failed.' }));
    await advance(2000);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    act(() => replies[1]?.({ type: 'AUDIT_RESULT', snapshot, rawHtmlString: '<main>Short.</main>' }));
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('result');
    expect(container.textContent).not.toContain('Old audit failed.');
  });

  it.each(['no active tab', 'query rejected'])('recovers safely when there is %s', async (failure) => {
    const query = vi.spyOn(chrome.tabs, 'query');
    if (failure === 'no active tab') query.mockResolvedValueOnce([]);
    else query.mockRejectedValueOnce(new Error('Tab query failed.'));
    await click('Recheck page');
    await advance(1999);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('loading');
    await advance(1);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('error');
    expect(container.querySelector('[role="status"]')?.textContent).toBeTruthy();
    expect([...container.querySelectorAll('button')].find((button) => button.textContent === 'Audit Page')?.disabled).toBe(false);
    await click('Audit Page');
    await advance(2000);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('result');
  });

  it('captures the worker error before Chrome clears runtime.lastError', async () => {
    let reply: ((response: unknown) => void) | undefined;
    Object.defineProperty(chrome.runtime, 'sendMessage', {
      value: (_message: unknown, callback: (response: unknown) => void) => { reply = callback; },
    });
    await click('Recheck page');
    Object.defineProperty(chrome.runtime, 'lastError', { value: { message: 'Worker disconnected.' } });
    act(() => reply?.(undefined));
    Object.defineProperty(chrome.runtime, 'lastError', { value: undefined });
    await advance(2000);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('error');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Worker disconnected.');
  });

  it('clears a pending audit completion when unmounted', async () => {
    await click('Recheck page');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => root.unmount());
    unmounted = true;
    expect(vi.getTimerCount()).toBe(0);
    await advance(2000);
    expect(container.childElementCount).toBe(0);
  });

  it('wraps keyboard tab focus before deferred transition updates commit', async () => {
    const commits = deferUpdates();
    const audit = container.querySelector<HTMLButtonElement>('#audit-tab');
    const readiness = container.querySelector<HTMLButtonElement>('#readiness-tab');
    if (!audit || !readiness) throw new Error('Result tabs not found.');
    act(() => audit.click());
    expect(commits).toHaveLength(0);
    act(() => audit.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(document.activeElement).toBe(readiness);
    act(() => readiness.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(document.activeElement).toBe(audit);
    await act(async () => commits.forEach((commit) => commit()));
    expect(audit.getAttribute('aria-selected')).toBe('true');
    expect(readiness.getAttribute('aria-selected')).toBe('false');
    expect(container.querySelector('[role="tablist"]')?.getAttribute('data-active')).toBe('audit');
    expect(container.querySelector('#audit-panel')?.getAttribute('aria-labelledby')).toBe(audit.id);
  });

  it('ignores a delayed tab switch after reset and a new audit', async () => {
    const commits = deferUpdates();
    await click('AI readiness');
    await click('Reset');
    await act(async () => commits.slice(1).forEach((commit) => commit()));
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('idle');
    delete (document as Partial<Document>).startViewTransition;
    await click('Audit Page');
    await advance(2000);
    await act(async () => commits[0]!());
    expect(container.querySelector('[role="tablist"]')?.getAttribute('data-active')).toBe('audit');
    expect(container.querySelector('#readiness-panel')).toBeNull();
    expect(container.querySelector('#audit-panel')?.getAttribute('role')).toBe('tabpanel');
  });

  it('clears the copied-label timer when reset removes the report', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    await click('Copy AI fix prompt');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    await click('Reset');
    expect(vi.getTimerCount()).toBe(0);
    await advance(2000);
    expect(container.firstElementChild?.getAttribute('data-view')).toBe('idle');
  });

  it('opens a priority finding after clearing filters that hide it', () => {
    const findings = container.querySelector<HTMLDetailsElement>('details[aria-labelledby="findings-title"]');
    const summary = findings?.querySelector('summary');
    if (!findings || !summary) throw new Error('All findings disclosure not found.');
    act(() => summary.click());
    const priority = container.querySelector<HTMLButtonElement>('[aria-labelledby="fix-first-title"] ol button');
    if (!priority) throw new Error('Priority finding not found.');
    const title = priority.querySelector('span > span')?.textContent ?? '';
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
    expect(findings.open).toBe(true);
    expect(category.textContent).toContain('All categories');
    expect(container.querySelector<HTMLInputElement>('input[value="all"]')?.checked).toBe(true);
    const detail = findDetail();
    expect(detail?.open).toBe(true);
    expect(document.activeElement).toBe(detail?.querySelector('summary'));

    if (!detail) throw new Error('Priority detail not found.');
    detail.open = false;
    act(() => summary.click());
    expect(findings.open).toBe(false);
    act(() => priority.click());
    expect(findings.open).toBe(true);
    expect(detail.open).toBe(true);
    expect(document.activeElement).toBe(detail.querySelector('summary'));
  });

  it('keeps secondary report disclosures closed and preserves filters when findings reopen', () => {
    const findings = container.querySelector<HTMLDetailsElement>('details[aria-labelledby="findings-title"]');
    const summary = findings?.querySelector('summary');
    if (!findings || !summary) throw new Error('All findings disclosure not found.');
    expect(findings.open).toBe(false);
    for (const label of ['Page evidence', 'Export report']) {
      const detail = [...container.querySelectorAll<HTMLDetailsElement>('details')]
        .find((item) => item.querySelector('summary')?.textContent?.trim() === label);
      expect(detail, `${label} disclosure`).toBeDefined();
      expect(detail?.open).toBe(false);
    }
    act(() => summary.click());
    expect(findings.open).toBe(true);
    const failures = findings.querySelector<HTMLInputElement>('input[value="fail"]');
    if (!failures) throw new Error('Failures filter not found.');
    act(() => failures.click());
    expect(failures.checked).toBe(true);
    act(() => summary.click());
    expect(findings.open).toBe(false);
    act(() => summary.click());
    expect(findings.open).toBe(true);
    expect(findings.querySelector<HTMLInputElement>('input[value="fail"]')?.checked).toBe(true);
  });

  it('keeps readiness conditions and question checks usable with supporting details closed', async () => {
    Object.defineProperty(chrome.runtime, 'sendMessage', {
      value: (_message: unknown, callback: (response: unknown) => void) => callback({
        type: 'AUDIT_RESULT',
        snapshot: { ...snapshot, url: 'https://example.com/pricing' },
        rawHtmlString: '<main>Short.</main>',
      }),
    });
    await click('Recheck page');
    await advance(2000);
    await click('AI readiness');
    const heading = [...container.querySelectorAll('h2')].find((item) => item.textContent === 'Readiness conditions');
    const conditions = heading?.closest('section');
    if (!conditions) throw new Error('Readiness conditions not found.');
    expect(heading?.closest('details')?.open ?? true).toBe(true);
    const action = [...conditions.querySelectorAll('summary')].find((item) => item.textContent?.includes('Action path'));
    expect(action).toBeDefined();
    expect(action?.closest('details')?.open).toBe(false);
    expect(action?.closest('details')?.textContent).toContain('labeled form control(s)');
    expect([...container.querySelectorAll('h2')].some((item) => item.textContent === 'Action path')).toBe(false);

    const references = ['Google guidance', 'What Google says you can skip'].map((label) =>
      [...container.querySelectorAll<HTMLDetailsElement>('details')]
        .find((item) => item.querySelector('summary')?.textContent?.trim() === label),
    );
    references.forEach((detail) => {
      expect(detail).toBeDefined();
      expect(detail?.open).toBe(false);
    });
    expect(references[0]?.parentElement).toBe(references[1]?.parentElement);

    const input = container.querySelector<HTMLInputElement>('#readiness-question');
    if (!input) throw new Error('Question input not found.');
    expect(input.closest('details')?.open ?? true).toBe(true);
    const question = 'What does this page offer?';
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, question);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click('Add');
    expect(container.textContent).toContain(question);
    expect(input.value).toBe('');
    await click('Remove');
    expect(container.textContent).not.toContain(question);
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
