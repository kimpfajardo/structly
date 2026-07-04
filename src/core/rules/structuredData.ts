// Category: structured-data — see 04-rules.md. Every literal field is exact.

import type { Rule } from '../types';
import { KNOWN_SCHEMA_TYPES, SCHEMA_EXPECTED_TYPES } from './constants';

export const schemaNoJsonld: Rule = (s) => {
  if (s.jsonLd.length !== 0) return null;
  const status: 'warn' | 'info' = SCHEMA_EXPECTED_TYPES.includes(s.pageType) ? 'warn' : 'info';
  return {
    id: 'schema.no-jsonld',
    category: 'structured-data',
    severity: 'low',
    status,
    title: 'No JSON-LD structured data',
    whyItMatters:
      'Structured data is not required, but it improves machine understanding and search eligibility.',
    evidence: ['No <script type="application/ld+json"> blocks found.'],
    recommendedFix: "Add JSON-LD for the page's primary entity where a supported type applies.",
    selectors: ['script[type="application/ld+json"]'],
    scoreImpact: 0,
  };
};

export const schemaInvalidJsonld: Rule = (s) => {
  const evidence: string[] = [];
  s.jsonLd.forEach((b, i) => {
    if (b.valid === false) evidence.push(`Block ${i} failed to parse as JSON.`);
  });
  if (evidence.length === 0) return null;
  return {
    id: 'schema.invalid-jsonld',
    category: 'structured-data',
    severity: 'high',
    status: 'fail',
    title: 'Invalid JSON-LD',
    whyItMatters: 'Malformed JSON-LD cannot be parsed and is ignored by consuming systems.',
    evidence,
    recommendedFix: 'Fix the JSON syntax so each JSON-LD block parses.',
    selectors: ['script[type="application/ld+json"]'],
    scoreImpact: 0,
  };
};

export const schemaUnrecognizedType: Rule = (s) => {
  const evidence: string[] = [];
  s.jsonLd.forEach((b, i) => {
    if (b.valid !== true) return;
    const recognized = b.types.some((t) => KNOWN_SCHEMA_TYPES.includes(t));
    if (recognized) return;
    const typesStr = b.types.length > 0 ? b.types.join(', ') : '(none)';
    evidence.push(`Block ${i} declares types ${typesStr}.`);
  });
  if (evidence.length === 0) return null;
  return {
    id: 'schema.unrecognized-type',
    category: 'structured-data',
    severity: 'low',
    status: 'info',
    title: 'Unrecognized or missing schema @type',
    whyItMatters: 'A recognized @type helps systems classify the entity the page describes.',
    evidence,
    recommendedFix: 'Declare a supported schema.org @type appropriate to the page.',
    selectors: ['script[type="application/ld+json"]'],
    scoreImpact: 0,
  };
};
