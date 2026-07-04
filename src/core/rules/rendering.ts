// Category: rendering-risk — see 04-rules.md. Every literal field is exact.

import type { Rule } from '../types';

export const renderingLowInitialText: Rule = (s) => {
  if (s.raw.available === false) {
    return {
      id: 'rendering.low-initial-text',
      category: 'rendering-risk',
      severity: 'high',
      status: 'info',
      title: 'Primary content appears to depend on client-side rendering',
      whyItMatters:
        'When primary text is missing from the server HTML, systems that do not execute JavaScript may not see it.',
      evidence: [
        'Server HTML could not be fetched, so client-render dependence could not be verified.',
      ],
      recommendedFix: 'Render the main summary and core content on the server where possible.',
      selectors: ['main'],
      scoreImpact: 0,
    };
  }
  if (s.raw.mainTextLength < 200 && s.rendered.mainTextLength > 600) {
    return {
      id: 'rendering.low-initial-text',
      category: 'rendering-risk',
      severity: 'high',
      status: 'fail',
      title: 'Primary content appears to depend on client-side rendering',
      whyItMatters:
        'When primary text is missing from the server HTML, systems that do not execute JavaScript may not see it.',
      evidence: [
        `Server HTML main text: ${s.raw.mainTextLength} chars; rendered main text: ${s.rendered.mainTextLength} chars.`,
      ],
      recommendedFix: 'Render the main summary and core content on the server where possible.',
      selectors: ['main'],
      scoreImpact: 0,
    };
  }
  return null;
};

export const renderingSkeletonInMain: Rule = (s) => {
  if (s.rendered.hasSkeletonMarkers !== true) return null;
  return {
    id: 'rendering.skeleton-in-main',
    category: 'rendering-risk',
    severity: 'medium',
    status: 'warn',
    title: 'Skeleton or placeholder present in main content',
    whyItMatters:
      'Persistent skeletons at load time suggest primary content arrives late or failed to load.',
    evidence: ['Skeleton/placeholder markers detected inside the main content region.'],
    recommendedFix:
      'Ensure primary content is present without waiting on client-side data fetches.',
    selectors: ['main [aria-busy="true"]', 'main [class*="skeleton"]'],
    scoreImpact: 0,
  };
};

export const renderingAppShellEmptyRaw: Rule = (s) => {
  if (s.raw.available !== true) return null;
  if (s.raw.bodyTextLength >= 100) return null;
  return {
    id: 'rendering.app-shell-empty-raw',
    category: 'rendering-risk',
    severity: 'high',
    status: 'fail',
    title: 'Server HTML is nearly empty (app-shell pattern)',
    whyItMatters:
      'An empty server response means all content depends on client execution, a risk for indexing and retrieval.',
    evidence: [`Server HTML body text is only ${s.raw.bodyTextLength} characters.`],
    recommendedFix: 'Server-render meaningful content instead of shipping an empty shell.',
    selectors: ['body'],
    scoreImpact: 0,
  };
};
