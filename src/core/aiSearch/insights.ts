// AEO/GEO readiness insights derived from Google Search Central's official guidance.
// This is a derived layer over the fixed 24-rule output — it adds no rules and does not
// affect scoring. Pure (no chrome.*/DOM) so it stays Node-testable.
//
// Sources (official Google documentation):
// - https://developers.google.com/search/docs/appearance/ai-features
// - https://developers.google.com/search/docs/fundamentals/ai-optimization-guide

import type { AuditIssue, PageSnapshot } from '../types';

export interface InsightSource {
  label: string;
  url: string;
}

export type PillarStatus = 'ready' | 'attention' | 'blocked';

export interface AiSearchPillar {
  id: 'eligibility' | 'grounding' | 'structure' | 'context' | 'agents';
  title: string;
  status: PillarStatus;
  /** What Google's documentation says this pillar is about. */
  guidance: string;
  /** Page-specific observations, derived from the audit. */
  findings: string[];
  /** Concrete next steps for the analyst. */
  recommendations: string[];
  relatedIssueIds: string[];
  sources: InsightSource[];
}

export interface AiSearchInsights {
  pillars: AiSearchPillar[];
  /** Things Google explicitly says you can skip ("mythbusting" section). */
  skipList: string[];
  keyTakeaway: string;
}

export const GOOGLE_AI_FEATURES_DOC: InsightSource = {
  label: 'Google: AI features and your website',
  url: 'https://developers.google.com/search/docs/appearance/ai-features',
};

export const GOOGLE_AI_OPTIMIZATION_GUIDE: InsightSource = {
  label: 'Google: Optimizing for generative AI features',
  url: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide',
};

// Straight from the "Mythbusting generative AI search" section of the optimization guide.
export const GOOGLE_SKIP_LIST = [
  'llms.txt files or other "special" AI markup — Google Search ignores them',
  '"Chunking" content into tiny pieces for AI',
  'Rewriting content specifically for AI systems or chasing long-tail keyword variants',
  'Seeking inauthentic "mentions" across the web',
  'Over-focusing on structured data — useful for rich results, but not required for AI features',
] as const;

function has(issues: AuditIssue[], ids: string[]): AuditIssue[] {
  return issues.filter((i) => ids.includes(i.id));
}

function statusFrom(matched: AuditIssue[]): PillarStatus {
  if (matched.some((i) => i.status === 'fail' || i.status === 'warn')) return 'attention';
  return 'ready';
}

function issueFindings(matched: AuditIssue[]): string[] {
  return matched.map((i) => `${i.title} (${i.status})`);
}

const ELIGIBILITY_IDS = [
  'meta.robots-noindex',
  'meta.missing-title',
  'meta.title-length',
  'meta.missing-description',
  'meta.missing-canonical',
  'meta.multiple-canonical',
];

const GROUNDING_IDS = [
  'rendering.low-initial-text',
  'rendering.skeleton-in-main',
  'rendering.app-shell-empty-raw',
];

const STRUCTURE_IDS = [
  'content.missing-h1',
  'content.multiple-h1',
  'content.heading-skip',
  'content.missing-summary',
];

const CONTEXT_IDS = ['schema.no-jsonld', 'schema.invalid-jsonld', 'schema.unrecognized-type'];

const AGENT_IDS = [
  'a11y.missing-main',
  'a11y.unlabeled-controls',
  'a11y.icon-button-no-name',
  'a11y.vague-link-text',
  'cta.missing-primary',
  'cta.generic-primary',
  'meta.missing-lang',
  'meta.missing-viewport',
];

export function buildAiSearchInsights(
  snapshot: PageSnapshot,
  issues: AuditIssue[],
): AiSearchInsights {
  const pillars: AiSearchPillar[] = [];

  // 1. Eligibility — a page must be indexed and snippet-eligible to appear in AI features.
  {
    const matched = has(issues, ELIGIBILITY_IDS);
    const noindex = matched.find((i) => i.id === 'meta.robots-noindex');
    const findings = issueFindings(matched);
    if (matched.length === 0) findings.push('Title, description, canonical, and robots look sound.');
    const recommendations: string[] = [];
    if (noindex) {
      recommendations.push(
        'Remove the noindex directive if this page should appear in Search — noindexed pages are excluded from AI Overviews and AI Mode entirely.',
      );
    }
    if (matched.some((i) => i.id.startsWith('meta.missing-title') || i.id === 'meta.title-length'))
      recommendations.push('Write a descriptive, appropriately sized title — AI features surface pages as clickable links, and the title is that link.');
    if (matched.some((i) => i.id === 'meta.missing-description'))
      recommendations.push('Add a meta description; it often seeds how the page is summarized in link previews.');
    if (matched.some((i) => i.id.includes('canonical')))
      recommendations.push('Fix canonical tags so ranking signals consolidate on one URL — Google recommends reducing duplicate content.');
    if (recommendations.length === 0)
      recommendations.push('Nothing to fix here. Verify the page is indexed via Search Console URL inspection.');

    pillars.push({
      id: 'eligibility',
      title: 'Indexing & snippet eligibility',
      // The rule reports noindex as a warn (it may be intentional), but per Google's docs a
      // noindexed page is excluded from AI features outright — presence blocks this pillar.
      status: noindex ? 'blocked' : statusFrom(matched),
      guidance:
        'Google: to be eligible for AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet. There are no additional technical requirements.',
      findings,
      recommendations,
      relatedIssueIds: matched.map((i) => i.id),
      sources: [GOOGLE_AI_FEATURES_DOC],
    });
  }

  // 2. Grounding — RAG retrieves crawlable text; content hidden behind client-side JS is at risk.
  {
    const matched = has(issues, GROUNDING_IDS);
    const findings = issueFindings(matched);
    if (!snapshot.raw.available)
      findings.push('Raw HTML could not be fetched during this audit; grounding signals are partly estimated.');
    if (matched.length === 0 && snapshot.raw.available)
      findings.push('Main content is present in the initial HTML — retrievable without JavaScript execution.');
    const recommendations =
      matched.length > 0
        ? [
            'Server-render or statically generate the primary content so it exists in the raw HTML. Google\'s AI features use retrieval (RAG) over indexed pages — "make sure important content is available in textual form".',
            'Follow Google\'s JavaScript SEO basics if the page must stay client-rendered.',
          ]
        : ['No action needed; keep primary content in the initial HTML payload.'];

    pillars.push({
      id: 'grounding',
      title: 'Text availability for AI grounding (RAG)',
      status: statusFrom(matched),
      guidance:
        'Google: AI responses are grounded via retrieval-augmented generation over the Search index, and generative AI models use publicly accessible, crawlable content. Important content should be available in textual form.',
      findings,
      recommendations,
      relatedIssueIds: matched.map((i) => i.id),
      sources: [GOOGLE_AI_OPTIMIZATION_GUIDE, GOOGLE_AI_FEATURES_DOC],
    });
  }

  // 3. Structure — clear headings/sections help both readers and answer extraction.
  {
    const matched = has(issues, STRUCTURE_IDS);
    const findings = issueFindings(matched);
    if (matched.length === 0)
      findings.push(`Heading outline is clean (${snapshot.headings.length} headings, single H1).`);
    const recommendations =
      matched.length > 0
        ? [
            'Organize the page with one H1, ordered heading levels, and paragraph/section structure — Google: "people appreciate pages organized by paragraphs and sections, along with headings that provide a clear structure".',
            'Lead with a direct summary of what the page offers; AI Overviews are built to surface the gist of a topic quickly.',
          ]
        : ['Structure is solid. Focus remaining effort on content depth and unique point of view — Google weighs non-commodity content most.'];

    pillars.push({
      id: 'structure',
      title: 'Content structure & answerability',
      status: statusFrom(matched),
      guidance:
        'Google: organize content so readers can navigate it — clear headings and sections. AI Overviews help people get the gist of a topic quickly, so answer-shaped, well-structured content is what gets surfaced.',
      findings,
      recommendations,
      relatedIssueIds: matched.map((i) => i.id),
      sources: [GOOGLE_AI_OPTIMIZATION_GUIDE],
    });
  }

  // 4. Context — structured data is optional for AI features but must match visible text.
  {
    const matched = has(issues, CONTEXT_IDS);
    const findings = issueFindings(matched);
    const validBlocks = snapshot.jsonLd.filter((b) => b.valid).length;
    findings.push(
      snapshot.jsonLd.length === 0
        ? 'No JSON-LD found on the page.'
        : `${validBlocks}/${snapshot.jsonLd.length} JSON-LD block(s) parse as valid JSON.`,
    );
    const recommendations =
      matched.length > 0
        ? [
            'Fix invalid JSON-LD and prefer recognized schema.org types. Note Google\'s framing: structured data is not required for AI features, but it keeps you eligible for rich results.',
            'Ensure structured data matches the visible text on the page — mismatches violate Google\'s structured data policies.',
          ]
        : ['Structured data is in good shape. No AI-specific schema exists — do not add "special" AI markup.'];

    pillars.push({
      id: 'context',
      title: 'Structured data as supporting context',
      status: statusFrom(matched),
      guidance:
        'Google: structured data isn\'t required for generative AI search and there is no special schema.org markup for AI. Keep using it for rich-result eligibility, and make sure it matches the visible text.',
      findings,
      recommendations,
      relatedIssueIds: matched.map((i) => i.id),
      sources: [GOOGLE_AI_OPTIMIZATION_GUIDE, GOOGLE_AI_FEATURES_DOC],
    });
  }

  // 5. Agents — semantic HTML and the accessibility tree are how browser agents read pages.
  {
    const matched = has(issues, AGENT_IDS);
    const findings = issueFindings(matched);
    if (matched.length === 0)
      findings.push('Landmarks, control labels, link text, and CTA naming all pass — agents can parse this page.');
    const recommendations =
      matched.length > 0
        ? [
            'Label controls, name icon buttons, and use specific link/CTA text. Google: browser agents complete tasks by inspecting the DOM structure and interpreting the accessibility tree — unnamed controls are invisible to them.',
            'Use semantic HTML (main, nav, header, footer); Google recommends it because it helps agents and assistive tech parse the page.',
          ]
        : ['Agent-ready. If commerce actions matter to the business, review Google\'s emerging agentic guidance (e.g. UCP).'];

    pillars.push({
      id: 'agents',
      title: 'Agent-readiness (accessibility tree & actions)',
      status: statusFrom(matched),
      guidance:
        'Google: AI agents gather data by analyzing visual renderings, inspecting the DOM structure, and interpreting the accessibility tree. Semantic HTML helps agents parse and navigate your page.',
      findings,
      recommendations,
      relatedIssueIds: matched.map((i) => i.id),
      sources: [GOOGLE_AI_OPTIMIZATION_GUIDE],
    });
  }

  const blocked = pillars.filter((p) => p.status === 'blocked').length;
  const attention = pillars.filter((p) => p.status === 'attention').length;
  const keyTakeaway =
    blocked > 0
      ? 'This page is currently excluded from Google\'s AI features — resolve the blocked pillar first; nothing else matters until it is indexable and snippet-eligible.'
      : attention > 0
        ? `Google's position: optimizing for AI search is still SEO. ${attention} pillar(s) need attention — fix those, then invest in unique, non-commodity content.`
        : 'All pillars pass. Per Google, the biggest remaining lever is unique, non-commodity content with a first-hand point of view.';

  return { pillars, skipList: [...GOOGLE_SKIP_LIST], keyTakeaway };
}
