// AI citation preview — a deterministic, local simulation of how AI search surfaces
// (AI Overviews, AI Mode, browsing chat assistants) are likely to treat this page.
// Heuristic only: computed entirely from the audited snapshot + rule results. No network
// calls, no AI APIs. Pure (no chrome.*/DOM) so it stays Node-testable.

import type { AuditIssue, PageSnapshot } from '../types';

export type SignalId = 'eligibility' | 'grounding' | 'answerability' | 'context' | 'clarity';

export interface CitationSignal {
  id: SignalId;
  label: string;
  /** 0..1 */
  score: number;
  detail: string;
}

export type CitationTier = 'strong' | 'possible' | 'weak' | 'excluded';

export interface AssistantPreview {
  profileId: 'ai-overviews' | 'ai-mode' | 'chat-assistant';
  name: string;
  blurb: string;
  /** 0..100 */
  likelihood: number;
  tier: CitationTier;
  displayTitle: string;
  displayUrl: string;
  snippet: string;
  blockers: string[];
}

export interface CitationPreviewResult {
  signals: CitationSignal[];
  assistants: AssistantPreview[];
  /** Example fan-out style questions this page could be retrieved for, from its headings. */
  fanOutQueries: string[];
  disclaimer: string;
}

export const CITATION_DISCLAIMER =
  'Simulated preview based on on-page signals and Google\'s published guidance. Actual inclusion in AI answers is decided by each provider and is never guaranteed.';

const SNIPPET_LENGTH = 160;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function hasIssue(issues: AuditIssue[], id: string): AuditIssue | undefined {
  return issues.find((i) => i.id === id);
}

function penalty(issues: AuditIssue[], id: string, fail: number, warn: number): number {
  const issue = hasIssue(issues, id);
  if (!issue) return 0;
  if (issue.status === 'fail') return fail;
  if (issue.status === 'warn') return warn;
  return 0;
}

export function computeSignals(snapshot: PageSnapshot, issues: AuditIssue[]): CitationSignal[] {
  // The noindex rule reports warn (may be intentional), but presence alone excludes the
  // page from Google Search and its AI features — treat it as a hard gate here.
  const noindex = hasIssue(issues, 'meta.robots-noindex');

  // Eligibility: indexed + snippet-eligible is a hard gate for Google's AI features.
  let eligibility = 1;
  if (noindex) {
    eligibility = 0;
  } else {
    eligibility -= penalty(issues, 'meta.missing-title', 0.35, 0.2);
    eligibility -= penalty(issues, 'meta.title-length', 0.1, 0.05);
    eligibility -= penalty(issues, 'meta.missing-description', 0.2, 0.1);
    eligibility -= penalty(issues, 'meta.missing-canonical', 0.1, 0.05);
    eligibility -= penalty(issues, 'meta.multiple-canonical', 0.2, 0.1);
  }

  // Grounding: how much of the content a retrieval system gets without running JS.
  let grounding = 1;
  grounding -= penalty(issues, 'rendering.app-shell-empty-raw', 0.6, 0.35);
  grounding -= penalty(issues, 'rendering.low-initial-text', 0.35, 0.2);
  grounding -= penalty(issues, 'rendering.skeleton-in-main', 0.2, 0.1);
  if (!snapshot.raw.available) grounding = Math.min(grounding, 0.6);

  // Answerability: can a model lift a direct answer from the page structure?
  let answerability = 1;
  answerability -= penalty(issues, 'content.missing-h1', 0.3, 0.2);
  answerability -= penalty(issues, 'content.multiple-h1', 0.15, 0.1);
  answerability -= penalty(issues, 'content.heading-skip', 0.15, 0.1);
  answerability -= penalty(issues, 'content.missing-summary', 0.3, 0.2);
  if (snapshot.topContentText.trim().length === 0) answerability -= 0.15;

  // Context: machine-verifiable structured data supporting the visible text.
  let context = 1;
  context -= penalty(issues, 'schema.no-jsonld', 0.4, 0.3);
  context -= penalty(issues, 'schema.invalid-jsonld', 0.35, 0.2);
  context -= penalty(issues, 'schema.unrecognized-type', 0.15, 0.1);

  // Clarity: names and text that agents and models can act on without guessing.
  let clarity = 1;
  clarity -= penalty(issues, 'a11y.vague-link-text', 0.2, 0.15);
  clarity -= penalty(issues, 'a11y.unlabeled-controls', 0.25, 0.15);
  clarity -= penalty(issues, 'a11y.icon-button-no-name', 0.2, 0.1);
  clarity -= penalty(issues, 'cta.generic-primary', 0.15, 0.1);
  clarity -= penalty(issues, 'a11y.missing-main', 0.2, 0.1);

  return [
    {
      id: 'eligibility',
      label: 'Snippet eligibility',
      score: clamp01(eligibility),
      detail:
        noindex?.status === 'fail'
          ? 'noindex excludes this page from Google Search and its AI features.'
          : 'Indexing metadata that gates inclusion in AI answers.',
    },
    {
      id: 'grounding',
      label: 'Retrievable text (grounding)',
      score: clamp01(grounding),
      detail: 'How much content a retrieval system sees in the raw HTML.',
    },
    {
      id: 'answerability',
      label: 'Answer-shaped structure',
      score: clamp01(answerability),
      detail: 'Single H1, ordered headings, and an up-front summary to lift answers from.',
    },
    {
      id: 'context',
      label: 'Structured data context',
      score: clamp01(context),
      detail: 'Valid JSON-LD with recognized types that corroborates the visible text.',
    },
    {
      id: 'clarity',
      label: 'Link & action clarity',
      score: clamp01(clarity),
      detail: 'Specific link text and named controls that models and agents can act on.',
    },
  ];
}

interface Profile {
  profileId: AssistantPreview['profileId'];
  name: string;
  blurb: string;
  weights: Record<SignalId, number>;
  /** Whether noindex fully excludes the page for this surface. */
  noindexExcludes: boolean;
}

const PROFILES: Profile[] = [
  {
    profileId: 'ai-overviews',
    name: 'Google AI Overviews',
    blurb: 'Quick gist of a topic with supporting links; shown only when additive to classic Search.',
    weights: { eligibility: 0.35, grounding: 0.25, answerability: 0.25, context: 0.1, clarity: 0.05 },
    noindexExcludes: true,
  },
  {
    profileId: 'ai-mode',
    name: 'Google AI Mode',
    blurb: 'Handles nuanced, multi-step questions via query fan-out across subtopics.',
    weights: { eligibility: 0.3, grounding: 0.25, answerability: 0.3, context: 0.1, clarity: 0.05 },
    noindexExcludes: true,
  },
  {
    profileId: 'chat-assistant',
    name: 'Browsing chat assistants',
    blurb: 'ChatGPT-, Perplexity-, and Claude-style assistants that fetch and cite pages while answering.',
    weights: { eligibility: 0.15, grounding: 0.35, answerability: 0.25, context: 0.1, clarity: 0.15 },
    noindexExcludes: false,
  },
];

function tierFor(likelihood: number, excluded: boolean): CitationTier {
  if (excluded) return 'excluded';
  if (likelihood >= 80) return 'strong';
  if (likelihood >= 55) return 'possible';
  return 'weak';
}

function buildSnippet(snapshot: PageSnapshot): string {
  const description = snapshot.meta.metaDescription?.trim();
  if (description) {
    return description.length > SNIPPET_LENGTH
      ? `${description.slice(0, SNIPPET_LENGTH - 1).trimEnd()}…`
      : description;
  }
  const text = snapshot.topContentText.trim();
  if (!text) return 'No summary available — the page exposes no description or leading text.';
  return text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH - 1).trimEnd()}…` : text;
}

function topBlockers(signals: CitationSignal[], weights: Record<SignalId, number>): string[] {
  return signals
    .filter((s) => s.score < 0.7)
    .sort((a, b) => (1 - a.score) * weights[a.id] < (1 - b.score) * weights[b.id] ? 1 : -1)
    .slice(0, 3)
    .map((s) => `${s.label}: ${Math.round(s.score * 100)}/100 — ${s.detail}`);
}

export function buildCitationPreview(
  snapshot: PageSnapshot,
  issues: AuditIssue[],
): CitationPreviewResult {
  const signals = computeSignals(snapshot, issues);
  const byId = Object.fromEntries(signals.map((s) => [s.id, s.score])) as Record<SignalId, number>;
  const noindexPresent = hasIssue(issues, 'meta.robots-noindex') !== undefined;

  const displayTitle = snapshot.meta.title?.trim() || 'Untitled page';
  const snippet = buildSnippet(snapshot);

  const assistants: AssistantPreview[] = PROFILES.map((profile) => {
    const excluded = profile.noindexExcludes && noindexPresent;
    const weighted = (Object.keys(profile.weights) as SignalId[]).reduce(
      (sum, id) => sum + profile.weights[id] * byId[id],
      0,
    );
    const likelihood = excluded ? 0 : Math.round(clamp01(weighted) * 100);
    return {
      profileId: profile.profileId,
      name: profile.name,
      blurb: profile.blurb,
      likelihood,
      tier: tierFor(likelihood, excluded),
      displayTitle,
      displayUrl: snapshot.url,
      snippet,
      blockers: excluded
        ? ['Page is noindexed — it cannot appear in Google Search or its AI features.']
        : topBlockers(signals, profile.weights),
    };
  });

  // Query fan-out examples: H2/H3 headings phrased as the searches a model might issue.
  const fanOutQueries = snapshot.headings
    .filter((h) => h.level === 2 || h.level === 3)
    .map((h) => h.text.trim())
    .filter((t) => t.length > 0)
    .slice(0, 4);

  return { signals, assistants, fanOutQueries, disclaimer: CITATION_DISCLAIMER };
}
