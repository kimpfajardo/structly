// Category: accessibility — see 04-rules.md. Every literal field is exact.

import type { Rule } from '../types';
import { normalizeText } from '../text';
import { VAGUE_TEXT } from './constants';

export const a11yMissingMain: Rule = (s) => {
  if (s.landmarks.hasMain !== false) return null;
  return {
    id: 'a11y.missing-main',
    category: 'accessibility',
    severity: 'medium',
    status: 'warn',
    title: 'No main landmark',
    whyItMatters: 'A main landmark lets agents and assistive tech locate the primary content.',
    evidence: ['No <main> or role="main" element found.'],
    recommendedFix: 'Wrap the primary content in a <main> element.',
    selectors: ['main'],
    scoreImpact: 0,
  };
};

export const a11yUnlabeledControls: Rule = (s) => {
  const offending = s.formControls.filter(
    (c) => c.hasLabel === false && c.accessibleName === '',
  );
  if (offending.length === 0) return null;
  const evidence = offending.slice(0, 10).map((c) => {
    const typePart = c.type ? ` type="${c.type}"` : '';
    return `<${c.tag}${typePart}> has no associated label or accessible name.`;
  });
  if (offending.length > 10) {
    evidence.push(`And ${offending.length - 10} more control(s) without an accessible label.`);
  }
  return {
    id: 'a11y.unlabeled-controls',
    category: 'accessibility',
    severity: 'high',
    status: 'fail',
    title: 'Form controls without accessible labels',
    whyItMatters: 'Unlabeled controls cannot be reliably identified by agents or screen readers.',
    evidence,
    recommendedFix: 'Associate a <label> with each control or add an accessible name.',
    selectors: ['input', 'select', 'textarea'],
    scoreImpact: 0,
  };
};

export const a11yIconButtonNoName: Rule = (s) => {
  const count = s.buttons.filter((b) => b.isIconOnly === true && b.accessibleName === '').length;
  if (count === 0) return null;
  return {
    id: 'a11y.icon-button-no-name',
    category: 'accessibility',
    severity: 'high',
    status: 'fail',
    title: 'Icon-only buttons without accessible names',
    whyItMatters: 'Icon-only buttons with no name are unusable for agents and screen readers.',
    evidence: [`${count} icon-only button(s) have no accessible name.`],
    recommendedFix:
      "Add an aria-label or visually hidden text naming each icon button's action.",
    selectors: ['button'],
    scoreImpact: 0,
  };
};

export const a11yVagueLinkText: Rule = (s) => {
  const count = s.links.filter((l) =>
    VAGUE_TEXT.includes(normalizeText(l.accessibleName).toLowerCase()),
  ).length;
  if (count < 2) return null;
  return {
    id: 'a11y.vague-link-text',
    category: 'accessibility',
    severity: 'low',
    status: 'warn',
    title: 'Repeated vague link text',
    whyItMatters: 'Repeated vague link text reduces comprehension of where links lead.',
    evidence: [`${count} links use vague text such as "learn more" or "click here".`],
    recommendedFix: 'Use descriptive link text that indicates the destination.',
    selectors: ['a[href]'],
    scoreImpact: 0,
  };
};
