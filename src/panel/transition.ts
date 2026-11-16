import { flushSync } from 'react-dom';

let transitionOwner = 0;

export async function transitionContent(
  update: () => void,
  { waitForAnimation = false, tabDirection }: {
    waitForAnimation?: boolean;
    tabDirection?: 'forward' | 'backward';
  } = {},
): Promise<void> {
  const owner = ++transitionOwner;
  delete document.documentElement.dataset.tabDirection;
  const clearDirection = (): void => {
    if (owner === transitionOwner) delete document.documentElement.dataset.tabDirection;
  };
  let committed = false;
  const commit = (): void => {
    if (committed) return;
    committed = true;
    flushSync(update);
  };

  if (
    !document.startViewTransition ||
    document.visibilityState === 'hidden' ||
    (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  ) {
    commit();
    return;
  }

  try {
    if (tabDirection) document.documentElement.dataset.tabDirection = tabDirection;
    const transition = document.startViewTransition(commit);
    void transition.ready.catch(clearDirection);
    const finished = transition.finished.catch(() => {}).finally(clearDirection);
    await transition.updateCallbackDone;
    if (waitForAnimation) await finished;
  } catch (error) {
    clearDirection();
    // Animation failures must not discard an update; callback errors must not replay it.
    if (committed) throw error;
    commit();
  }
}
