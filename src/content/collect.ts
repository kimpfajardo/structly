// Content script — collect only. Runs in the page (isolated world) at document_idle.
// Holds no persistent state, fetches nothing, runs no rules. See 01-architecture.md.
//
// Assembles a real PageSnapshot from the collectors in ./collectors (03-collectors.md).
// pageType and raw are defaulted here and finalized by the panel.

import type { CollectRequest } from '../core/schemas/messages';
import type { PageSnapshot } from '../core/types';
import { normalizeText, getMainRegion } from './collectors/shared';
import { collectMeta } from './collectors/meta';
import { collectHeadings } from './collectors/headings';
import { collectLandmarks } from './collectors/landmarks';
import { collectLinks } from './collectors/links';
import { collectButtons } from './collectors/buttons';
import { collectFormControls } from './collectors/forms';
import { collectJsonLd } from './collectors/jsonld';
import { collectRendered } from './collectors/rendered';
import { collectPrimaryCta } from './collectors/cta';

function collectSnapshot(): PageSnapshot {
  const headings = collectHeadings();
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    url: location.href,
    pageType: 'unknown',
    meta: collectMeta(),
    headings,
    h1Count: headings.filter((h) => h.level === 1).length,
    landmarks: collectLandmarks(),
    links: collectLinks(),
    buttons: collectButtons(),
    primaryCta: collectPrimaryCta(),
    formControls: collectFormControls(),
    jsonLd: collectJsonLd(),
    rendered: collectRendered(),
    raw: { available: false, mainTextLength: 0, bodyTextLength: 0 },
    topContentText: normalizeText(getMainRegion().textContent).slice(0, 800),
  };
}

chrome.runtime.onMessage.addListener((message: CollectRequest, _sender, sendResponse) => {
  if (message?.type === 'COLLECT_SNAPSHOT') {
    sendResponse(collectSnapshot());
    // Build is synchronous, but return true for safety/consistency per 01-architecture.md.
    return true;
  }
  return undefined;
});
