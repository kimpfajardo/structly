// Category: content — see 04-rules.md. Every literal field is exact.

import type { Rule } from '../types';
import { SUMMARY_EXPECTED_TYPES } from './constants';

export const contentMissingH1: Rule = (s) => {
  if (s.h1Count !== 0) return null;
  return {
    id: 'content.missing-h1',
    category: 'content',
    severity: 'high',
    status: 'fail',
    title: 'No H1 heading',
    whyItMatters: "The H1 states the page's main topic for users and systems.",
    evidence: ['No visible <h1> element found.'],
    recommendedFix: "Add a single, descriptive H1 as the page's main heading.",
    selectors: ['h1'],
    scoreImpact: 0,
  };
};

export const contentMultipleH1: Rule = (s) => {
  if (s.h1Count <= 1) return null;
  return {
    id: 'content.multiple-h1',
    category: 'content',
    severity: 'medium',
    status: 'warn',
    title: 'Multiple H1 headings',
    whyItMatters: "Multiple H1s dilute the page's primary topic signal.",
    evidence: [`${s.h1Count} visible <h1> elements found; keep one primary heading.`],
    recommendedFix: 'Keep one H1 and demote the others to H2 or lower.',
    selectors: ['h1'],
    scoreImpact: 0,
  };
};

export const contentHeadingSkip: Rule = (s) => {
  const evidence: string[] = [];
  for (let i = 1; i < s.headings.length; i++) {
    const prev = s.headings[i - 1];
    const next = s.headings[i];
    if (!prev || !next) continue;
    if (next.level - prev.level > 1) {
      evidence.push(
        `H${prev.level} is followed by H${next.level} ("${next.text.slice(0, 60)}").`,
      );
    }
  }
  if (evidence.length === 0) return null;
  return {
    id: 'content.heading-skip',
    category: 'content',
    severity: 'medium',
    status: 'warn',
    title: 'Heading levels skip a level',
    whyItMatters:
      'Skipped heading levels break the document outline that agents and screen readers rely on.',
    evidence,
    recommendedFix: 'Use sequential heading levels without skipping (e.g., H2 before H3).',
    selectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    scoreImpact: 0,
  };
};

export const contentMissingSummary: Rule = (s) => {
  const topLen = s.topContentText.trim().length;
  if (!SUMMARY_EXPECTED_TYPES.includes(s.pageType) || topLen >= 120) return null;
  return {
    id: 'content.missing-summary',
    category: 'content',
    severity: 'medium',
    status: 'warn',
    title: 'No summary near the top of the main content',
    whyItMatters:
      'A concise summary near the top helps users and retrieval systems grasp the page quickly.',
    evidence: [
      `Only ${topLen} characters of text found in the top of the main content region.`,
    ],
    recommendedFix: 'Add a direct summary paragraph under the main heading.',
    selectors: ['main h1', 'main p'],
    scoreImpact: 0,
  };
};
