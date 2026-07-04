// landmarks collector — see 03-collectors.md § landmarks.

import type { Landmarks } from '../../core/types';

export function collectLandmarks(): Landmarks {
  return {
    hasMain: !!document.querySelector('main, [role="main"]'),
    mainCount: document.querySelectorAll('main, [role="main"]').length,
    hasNav: !!document.querySelector('nav, [role="navigation"]'),
    hasHeader: !!document.querySelector('header, [role="banner"]'),
    hasFooter: !!document.querySelector('footer, [role="contentinfo"]'),
  };
}
