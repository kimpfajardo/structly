// Best-guess page-type classifier. The panel uses this to resolve the dropdown when the
// user leaves it on 'unknown' ("auto-detect"); an explicit dropdown pick always wins.
//
// This is a panel default, NOT a rule: it returns a PageType, never an AuditIssue, and is
// deliberately outside the fixed 24-rule registry. Pure and Node-testable — reads only
// snapshot fields, no chrome.* / DOM. Kim-authorized deviation from the manual-only spec.

import type { PageSnapshot, PageType } from './types';

const ARTICLE_SCHEMA_TYPES = ['Article', 'NewsArticle', 'BlogPosting'];

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}

// Checks whether any '/'-delimited path segment matches. Anchored so 'apidocs' or a
// query string can't produce a stray match — only whole segments count.
function pathHasSegment(path: string, pattern: RegExp): boolean {
  return pattern.test(path);
}

// Ordered most- to least-confident; first match wins. Signals only ever upgrade a page
// from 'unknown' to a stricter type, so a miss stays conservative rather than noisy.
export function detectPageType(snapshot: PageSnapshot): PageType {
  const schemaTypes = snapshot.jsonLd.flatMap((block) => block.types);

  // 1. Explicit machine-readable intent: JSON-LD @type.
  if (schemaTypes.includes('Product')) return 'product';
  if (schemaTypes.some((type) => ARTICLE_SCHEMA_TYPES.includes(type))) return 'article';

  // 2. A password field is an unambiguous login / account signal.
  if (snapshot.formControls.some((control) => control.type === 'password')) return 'account';

  // 3. URL path conventions.
  const path = pathOf(snapshot.url);
  if (pathHasSegment(path, /(^|\/)(docs?|documentation|guides?|reference|api|help|manual|kb)(\/|$)/)) {
    return 'docs';
  }
  if (pathHasSegment(path, /(^|\/)(blog|news|articles?|posts?|stories)(\/|$)/)) {
    return 'article';
  }
  if (pathHasSegment(path, /(^|\/)(products?|shop|store|item|collections?|catalog)(\/|$)/)) {
    return 'product';
  }
  if (pathHasSegment(path, /(^|\/)(account|login|sign-?in|sign-?up|register|profile|settings|dashboard|auth)(\/|$)/)) {
    return 'account';
  }
  // Only explicit marketing paths count. A bare host ('/') or an unparseable URL ('') is
  // too weak to guess — a logged-in app root is just as likely — so it stays 'unknown'.
  if (pathHasSegment(path, /(^|\/)(pricing|features?|solutions?|plans?)(\/|$)/)) {
    return 'marketing';
  }

  // 4. No confident signal — leave it to the conservative default.
  return 'unknown';
}
