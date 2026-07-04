// meta collector — see 03-collectors.md § meta.

import { normalizeText } from './shared';
import type { PageMeta } from '../../core/types';

export function collectMeta(): PageMeta {
  const title = normalizeText(document.title) || null;

  const descContent = document
    .querySelector('meta[name="description"]')
    ?.getAttribute('content');
  const metaDescription = normalizeText(descContent) || null;

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  const canonical = canonicalEl ? (canonicalEl as HTMLLinkElement).href : null;
  const canonicalCount = document.querySelectorAll('link[rel="canonical"]').length;

  const robotsContent = document.querySelector('meta[name="robots"]')?.getAttribute('content');
  const robots = robotsContent == null ? null : robotsContent.toLowerCase().trim();

  const langAttr = document.documentElement.getAttribute('lang');
  const lang = langAttr == null ? null : langAttr.trim() || null;

  const viewportContent = document
    .querySelector('meta[name="viewport"]')
    ?.getAttribute('content');
  const viewport = viewportContent == null ? null : viewportContent.trim();

  return { title, metaDescription, canonical, canonicalCount, robots, lang, viewport };
}
