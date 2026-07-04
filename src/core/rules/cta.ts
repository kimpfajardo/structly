// Category: cta — see 04-rules.md. Every literal field is exact.

import type { Rule } from '../types';
import { normalizeText } from '../text';
import { CTA_EXPECTED_TYPES, VAGUE_TEXT } from './constants';

export const ctaMissingPrimary: Rule = (s) => {
  if (!CTA_EXPECTED_TYPES.includes(s.pageType) || s.primaryCta !== null) return null;
  return {
    id: 'cta.missing-primary',
    category: 'cta',
    severity: 'medium',
    status: 'warn',
    title: 'No primary call to action detected',
    whyItMatters:
      'Pages meant to drive action should present a clear next step for users and agents.',
    evidence: ['No primary button or role=button action found in the main content region.'],
    recommendedFix: 'Add a clear primary action button in the main content.',
    selectors: ['main button', 'main [role="button"]'],
    scoreImpact: 0,
  };
};

export const ctaGenericPrimary: Rule = (s) => {
  const cta = s.primaryCta;
  if (cta === null || !VAGUE_TEXT.includes(normalizeText(cta.accessibleName).toLowerCase())) {
    return null;
  }
  return {
    id: 'cta.generic-primary',
    category: 'cta',
    severity: 'low',
    status: 'warn',
    title: 'Primary CTA uses vague label',
    whyItMatters:
      'Vague labels like "Learn more" reduce clarity for users and agents about what will happen.',
    evidence: [`Primary CTA label is "${cta.accessibleName}".`],
    recommendedFix:
      'Use an outcome-specific label such as "Compare plans" or "Start free trial".',
    selectors: ['main button', 'main [role="button"]'],
    scoreImpact: 0,
  };
};
