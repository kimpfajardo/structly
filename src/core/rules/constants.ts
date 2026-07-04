// Shared rule constants — see 04-rules.md § Shared constants. Values are literal; do not edit.

import type { PageType } from '../types';

// Case-insensitive exact-match list for vague CTA / link text.
// Compare against normalizeText(...).toLowerCase().
export const VAGUE_TEXT = [
  'learn more',
  'click here',
  'read more',
  'more',
  'here',
  'submit',
  'continue',
];

// JSON-LD @type values recognized as "known".
export const KNOWN_SCHEMA_TYPES = [
  'Product', 'Article', 'NewsArticle', 'BlogPosting', 'FAQPage', 'QAPage',
  'BreadcrumbList', 'Organization', 'WebSite', 'WebPage', 'HowTo', 'Recipe',
  'Event', 'Review', 'VideoObject', 'Person',
];

// Page types for which a primary CTA is expected.
export const CTA_EXPECTED_TYPES: PageType[] = ['marketing', 'product', 'account'];

// Page types for which a top-of-page summary is expected.
export const SUMMARY_EXPECTED_TYPES: PageType[] = ['marketing', 'product', 'docs', 'article'];

// Page types for which structured data absence is upgraded from info to warn.
export const SCHEMA_EXPECTED_TYPES: PageType[] = ['product', 'article'];
