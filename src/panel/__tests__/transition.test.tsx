// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transitionContent } from '../transition';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe('transitionContent', () => {
  let callbacks: (() => void)[];
  let finishes: (() => void)[];
  let capturedDirections: (string | undefined)[];
  let start: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    callbacks = [];
    finishes = [];
    capturedDirections = [];
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    start = vi.fn((update: () => void) => {
      capturedDirections.push(document.documentElement.dataset.tabDirection);
      const updateCallbackDone = new Promise<void>((resolve, reject) => {
        callbacks.push(() => {
          try {
            update();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
      const finished = new Promise<void>((resolve) => finishes.push(resolve));
      return { ready: Promise.resolve(), finished, updateCallbackDone };
    });
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (document as Partial<Document>).startViewTransition;
    delete document.documentElement.dataset.tabDirection;
    document.body.replaceChildren();
  });

  it('flushes React DOM inside the captured callback and resolves before animation completion', async () => {
    let setLabel!: (label: string) => void;
    function Example() {
      const [label, updateLabel] = useState('Before');
      setLabel = updateLabel;
      return <p>{label}</p>;
    }
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<Example />));

    const committed = transitionContent(() => setLabel('After'));
    expect(container.textContent).toBe('Before');
    act(() => {
      callbacks[0]!();
      expect(container.textContent).toBe('After');
    });
    await committed;
    act(() => root.unmount());
  });

  it.each(['absent API', 'reduced motion', 'hidden document'])('commits immediately for %s', async (fallback) => {
    if (fallback === 'absent API') delete (document as Partial<Document>).startViewTransition;
    if (fallback === 'reduced motion') vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    if (fallback === 'hidden document') vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const update = vi.fn();
    document.documentElement.dataset.tabDirection = 'backward';

    const committed = transitionContent(update, { tabDirection: 'forward', waitForAnimation: true });
    expect(update).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.tabDirection).toBeUndefined();
    await committed;
  });

  it('retains every rapid update when transitions overlap', async () => {
    const values: number[] = [];
    const first = transitionContent(() => values.push(1));
    const second = transitionContent(() => values.push(2));

    callbacks[0]!();
    callbacks[1]!();
    await Promise.all([first, second]);
    expect(values).toEqual([1, 2]);
  });

  it('ignores skipped animation rejection while still committing', async () => {
    const update = vi.fn();
    start.mockImplementationOnce((commit: () => void) => ({
      ready: Promise.reject(new Error('Transition skipped')),
      finished: Promise.resolve(),
      updateCallbackDone: Promise.resolve().then(commit),
    }));

    await transitionContent(update, { tabDirection: 'forward' });
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.tabDirection).toBeUndefined();
  });

  it('commits once if native setup throws', async () => {
    start.mockImplementationOnce(() => { throw new Error('Transition unavailable'); });
    const update = vi.fn();

    await transitionContent(update, { tabDirection: 'backward' });
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.tabDirection).toBeUndefined();
  });

  it('falls back after a native failure and ignores a late callback', async () => {
    let late!: () => void;
    start.mockImplementationOnce((commit: () => void) => {
      late = commit;
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.reject(new Error('Capture failed')),
      };
    });
    const update = vi.fn();

    await transitionContent(update, { tabDirection: 'forward' });
    late();
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.tabDirection).toBeUndefined();
  });

  it('preserves update errors without replaying the callback', async () => {
    const error = new Error('Update failed');
    const update = vi.fn(() => { throw error; });
    const committed = transitionContent(update, { tabDirection: 'backward' });

    callbacks[0]!();
    await expect(committed).rejects.toBe(error);
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.tabDirection).toBeUndefined();
  });

  it('sets tab direction before capture and keeps it until the animation finishes', async () => {
    const committed = transitionContent(() => {}, { tabDirection: 'forward' });
    expect(capturedDirections).toEqual(['forward']);
    callbacks[0]!();
    await committed;
    expect(document.documentElement.dataset.tabDirection).toBe('forward');

    finishes[0]!();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.dataset.tabDirection).toBeUndefined();
  });

  it('keeps the newer tab direction when an older animation finishes', async () => {
    const first = transitionContent(() => {}, { tabDirection: 'forward' });
    const second = transitionContent(() => {}, { tabDirection: 'backward' });
    callbacks[0]!();
    callbacks[1]!();
    await Promise.all([first, second]);

    finishes[0]!();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.dataset.tabDirection).toBe('backward');

    finishes[1]!();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.dataset.tabDirection).toBeUndefined();
  });

  it('clears tab direction before a generic transition captures content', async () => {
    const first = transitionContent(() => {}, { tabDirection: 'forward' });
    const second = transitionContent(() => {});
    expect(capturedDirections).toEqual(['forward', undefined]);
    expect(document.documentElement.dataset.tabDirection).toBeUndefined();
    callbacks[0]!();
    callbacks[1]!();
    await Promise.all([first, second]);
  });

  it('waits for animation completion when requested', async () => {
    let settled = false;
    const finished = transitionContent(() => {}, { tabDirection: 'forward', waitForAnimation: true })
      .then(() => { settled = true; });
    callbacks[0]!();
    await Promise.resolve();
    expect(settled).toBe(false);

    finishes[0]!();
    await finished;
    expect(settled).toBe(true);
    expect(document.documentElement.dataset.tabDirection).toBeUndefined();
  });
});
