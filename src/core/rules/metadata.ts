// Category: metadata — see 04-rules.md. Every literal field is exact.

import type { Rule } from '../types';

export const metaMissingTitle: Rule = (s) => {
  if (s.meta.title !== null) return null;
  return {
    id: 'meta.missing-title',
    category: 'metadata',
    severity: 'high',
    status: 'fail',
    title: 'Missing document title',
    whyItMatters:
      'The title is the primary label for the page in search results, browser tabs, and agent context.',
    evidence: ['No <title> element or the title is empty.'],
    recommendedFix: "Add a descriptive <title> that states the page's purpose.",
    selectors: ['head > title'],
    scoreImpact: 0,
  };
};

export const metaTitleLength: Rule = (s) => {
  const title = s.meta.title;
  if (title === null || (title.length >= 10 && title.length <= 70)) return null;
  return {
    id: 'meta.title-length',
    category: 'metadata',
    severity: 'low',
    status: 'warn',
    title: 'Title length outside recommended range',
    whyItMatters:
      'Very short titles under-describe the page; very long titles get truncated in results.',
    evidence: [`Title length is ${title.length} characters (recommended 10-70).`],
    recommendedFix: 'Rewrite the title to be between 10 and 70 characters.',
    selectors: ['head > title'],
    scoreImpact: 0,
  };
};

export const metaMissingDescription: Rule = (s) => {
  if (s.meta.metaDescription !== null) return null;
  return {
    id: 'meta.missing-description',
    category: 'metadata',
    severity: 'medium',
    status: 'warn',
    title: 'Missing meta description',
    whyItMatters:
      'The meta description often becomes the results snippet and helps systems summarize the page.',
    evidence: ['No <meta name="description"> with content was found.'],
    recommendedFix: 'Add a concise meta description summarizing the page.',
    selectors: ['meta[name="description"]'],
    scoreImpact: 0,
  };
};

export const metaMissingCanonical: Rule = (s) => {
  if (s.meta.canonicalCount !== 0) return null;
  return {
    id: 'meta.missing-canonical',
    category: 'metadata',
    severity: 'medium',
    status: 'warn',
    title: 'Missing canonical link',
    whyItMatters:
      'A canonical link tells systems which URL is the preferred version of the page.',
    evidence: ['No <link rel="canonical"> found.'],
    recommendedFix: 'Add a canonical URL for the preferred version of this page.',
    selectors: ['link[rel="canonical"]'],
    scoreImpact: 0,
  };
};

export const metaMultipleCanonical: Rule = (s) => {
  if (s.meta.canonicalCount <= 1) return null;
  return {
    id: 'meta.multiple-canonical',
    category: 'metadata',
    severity: 'high',
    status: 'fail',
    title: 'Multiple canonical links',
    whyItMatters:
      'Conflicting canonical links are ambiguous and may be ignored, harming indexing.',
    evidence: [`${s.meta.canonicalCount} canonical links found; there should be exactly one.`],
    recommendedFix: 'Keep a single canonical link and remove the others.',
    selectors: ['link[rel="canonical"]'],
    scoreImpact: 0,
  };
};

export const metaMissingLang: Rule = (s) => {
  if (s.meta.lang !== null) return null;
  return {
    id: 'meta.missing-lang',
    category: 'metadata',
    severity: 'medium',
    status: 'fail',
    title: 'Missing html lang attribute',
    whyItMatters:
      "The lang attribute helps assistive tech and systems interpret the page's language.",
    evidence: ['<html> has no lang attribute.'],
    recommendedFix: 'Add a lang attribute to the <html> element, e.g. lang="en".',
    selectors: ['html'],
    scoreImpact: 0,
  };
};

export const metaRobotsNoindex: Rule = (s) => {
  const robots = s.meta.robots;
  if (robots === null || !robots.includes('noindex')) return null;
  return {
    id: 'meta.robots-noindex',
    category: 'metadata',
    severity: 'high',
    status: 'warn',
    title: 'Page is set to noindex',
    whyItMatters:
      'noindex removes the page from search indexes. This may be intentional; confirm it is.',
    evidence: [`meta robots content is "${robots}".`],
    recommendedFix:
      'If this page should be discoverable, remove noindex from the robots directive.',
    selectors: ['meta[name="robots"]'],
    scoreImpact: 0,
  };
};

export const metaMissingViewport: Rule = (s) => {
  if (s.meta.viewport !== null) return null;
  return {
    id: 'meta.missing-viewport',
    category: 'metadata',
    severity: 'low',
    status: 'warn',
    title: 'Missing viewport meta tag',
    whyItMatters:
      'The viewport tag is required for correct mobile rendering, which affects usability signals.',
    evidence: ['No <meta name="viewport"> found.'],
    recommendedFix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    selectors: ['meta[name="viewport"]'],
    scoreImpact: 0,
  };
};
