import { describe, expect, it } from 'vitest';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import { ALL_RULES } from '../../rules';
import type { AuditIssue, PageSnapshot } from '../../types';
import { buildCitationPreview, computeSignals } from '../citationPreview';

function runRules(snapshot: PageSnapshot): AuditIssue[] {
  return ALL_RULES.map((r) => r(snapshot)).filter((i): i is AuditIssue => i !== null);
}

describe('computeSignals', () => {
  it('scores a clean baseline at 1.0 on every signal', () => {
    const snapshot = makeSnapshot();
    const signals = computeSignals(snapshot, runRules(snapshot));
    expect(signals).toHaveLength(5);
    for (const s of signals) expect(s.score).toBe(1);
  });

  it('zeroes eligibility when the page is noindexed', () => {
    const snapshot = makeSnapshot({ meta: { robots: 'noindex' } });
    const signals = computeSignals(snapshot, runRules(snapshot));
    expect(signals.find((s) => s.id === 'eligibility')?.score).toBe(0);
  });

  it('keeps scores within 0..1 even when everything fails', () => {
    const snapshot = makeSnapshot({
      meta: {
        title: null,
        metaDescription: null,
        canonical: null,
        canonicalCount: 0,
        robots: 'noindex',
        lang: null,
        viewport: null,
      },
      headings: [],
      h1Count: 0,
      landmarks: { hasMain: false, hasNav: false, hasHeader: false, hasFooter: false, mainCount: 0 },
      primaryCta: null,
      jsonLd: [],
      rendered: { mainTextLength: 0, bodyTextLength: 10, hasSkeletonMarkers: true, frameworkMarkers: ['react'] },
      raw: { available: true, mainTextLength: 0, bodyTextLength: 5 },
      topContentText: '',
    });
    const signals = computeSignals(snapshot, runRules(snapshot));
    for (const s of signals) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('buildCitationPreview', () => {
  it('returns three assistant previews with a shared simulated citation card', () => {
    const snapshot = makeSnapshot();
    const preview = buildCitationPreview(snapshot, runRules(snapshot));
    expect(preview.assistants.map((a) => a.profileId)).toEqual([
      'ai-overviews',
      'ai-mode',
      'chat-assistant',
    ]);
    for (const a of preview.assistants) {
      expect(a.displayTitle).toBe('Example Product — Fast, Simple, Reliable');
      expect(a.displayUrl).toBe('https://example.com/');
      expect(a.snippet).toBe('Example Product helps teams ship faster with less risk.');
      expect(a.tier).toBe('strong');
      expect(a.likelihood).toBe(100);
    }
    expect(preview.disclaimer.toLowerCase()).toContain('simulated');
  });

  it('excludes Google surfaces but not chat assistants on noindex', () => {
    const snapshot = makeSnapshot({ meta: { robots: 'noindex' } });
    const preview = buildCitationPreview(snapshot, runRules(snapshot));
    const overviews = preview.assistants.find((a) => a.profileId === 'ai-overviews');
    const aiMode = preview.assistants.find((a) => a.profileId === 'ai-mode');
    const chat = preview.assistants.find((a) => a.profileId === 'chat-assistant');
    expect(overviews?.tier).toBe('excluded');
    expect(overviews?.likelihood).toBe(0);
    expect(aiMode?.tier).toBe('excluded');
    expect(chat?.tier).not.toBe('excluded');
    expect(chat!.likelihood).toBeGreaterThan(0);
    expect(overviews?.blockers[0]).toContain('noindex');
  });

  it('falls back to leading content text when meta description is missing', () => {
    const snapshot = makeSnapshot({ meta: { metaDescription: null } });
    const preview = buildCitationPreview(snapshot, runRules(snapshot));
    const first = preview.assistants[0]!;
    expect(first.snippet.startsWith('Example Product helps teams ship faster')).toBe(true);
    expect(first.snippet.length).toBeLessThanOrEqual(160);
  });

  it('derives fan-out queries from H2/H3 headings', () => {
    const snapshot = makeSnapshot({
      headings: [
        { level: 1, text: 'Example Product' },
        { level: 2, text: 'Why teams choose it' },
        { level: 3, text: 'Pricing that scales' },
        { level: 4, text: 'Footnote' },
      ],
    });
    const preview = buildCitationPreview(snapshot, runRules(snapshot));
    expect(preview.fanOutQueries).toEqual(['Why teams choose it', 'Pricing that scales']);
  });

  it('lists at most three blockers, weakest signals first', () => {
    const snapshot = makeSnapshot({
      meta: { metaDescription: null },
      jsonLd: [],
      rendered: { mainTextLength: 1200, bodyTextLength: 1800 },
      raw: { available: true, mainTextLength: 10, bodyTextLength: 30 },
    });
    const preview = buildCitationPreview(snapshot, runRules(snapshot));
    for (const a of preview.assistants) {
      expect(a.blockers.length).toBeLessThanOrEqual(3);
      expect(a.likelihood).toBeLessThan(100);
    }
  });
});
