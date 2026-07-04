// rendered-metrics collector — see 03-collectors.md § rendered.

import { normalizeText, getMainRegion } from './shared';
import type { RenderedMetrics } from '../../core/types';

export function collectRendered(): RenderedMetrics {
  const main = getMainRegion();
  return {
    mainTextLength: normalizeText(main.textContent).length,
    bodyTextLength: normalizeText(document.body.textContent).length,
    hasSkeletonMarkers: detectSkeletonMarkers(main),
    frameworkMarkers: detectFrameworkMarkers(),
  };
}

function detectSkeletonMarkers(main: Element): boolean {
  for (const el of main.querySelectorAll('*')) {
    if (el.getAttribute('aria-busy') === 'true') return true;
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') ?? '';
    if (/(skeleton|placeholder|shimmer|loading)/i.test(cls)) return true;
  }
  return false;
}

function detectFrameworkMarkers(): string[] {
  const markers: string[] = [];
  if (document.querySelector('#__next')) markers.push('next');
  if (document.querySelector('#__nuxt, [data-nuxt]')) markers.push('nuxt');
  if (document.querySelector('astro-island')) markers.push('astro');
  if (document.querySelector('[data-reactroot], #root, #app')) markers.push('react');
  return markers;
}
