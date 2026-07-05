import { describe, expect, it } from 'vitest';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import { ALL_RULES } from '../../rules';
import type { AuditIssue, PageSnapshot } from '../../types';
import { buildAiSearchInsights, GOOGLE_SKIP_LIST } from '../insights';

function runRules(snapshot: PageSnapshot): AuditIssue[] {
  return ALL_RULES.map((r) => r(snapshot)).filter((i): i is AuditIssue => i !== null);
}

describe('buildAiSearchInsights', () => {
  it('returns five pillars in fixed order with sources on every pillar', () => {
    const snapshot = makeSnapshot();
    const insights = buildAiSearchInsights(snapshot, runRules(snapshot));
    expect(insights.pillars.map((p) => p.id)).toEqual([
      'eligibility',
      'grounding',
      'structure',
      'context',
      'agents',
    ]);
    for (const pillar of insights.pillars) {
      expect(pillar.sources.length).toBeGreaterThan(0);
      expect(pillar.sources.every((s) => s.url.startsWith('https://developers.google.com/'))).toBe(
        true,
      );
      expect(pillar.recommendations.length).toBeGreaterThan(0);
    }
  });

  it('marks all pillars ready on the clean baseline', () => {
    const snapshot = makeSnapshot();
    const insights = buildAiSearchInsights(snapshot, runRules(snapshot));
    expect(insights.pillars.every((p) => p.status === 'ready')).toBe(true);
    expect(insights.keyTakeaway).toContain('non-commodity content');
  });

  it('blocks the eligibility pillar when the page is noindexed', () => {
    const snapshot = makeSnapshot({ meta: { robots: 'noindex, nofollow' } });
    const insights = buildAiSearchInsights(snapshot, runRules(snapshot));
    const eligibility = insights.pillars.find((p) => p.id === 'eligibility');
    expect(eligibility?.status).toBe('blocked');
    expect(insights.keyTakeaway).toContain('excluded');
  });

  it('flags the grounding pillar for an app-shell page', () => {
    const snapshot = makeSnapshot({
      rendered: { mainTextLength: 1200, bodyTextLength: 1800 },
      raw: { available: true, mainTextLength: 10, bodyTextLength: 30 },
    });
    const insights = buildAiSearchInsights(snapshot, runRules(snapshot));
    const grounding = insights.pillars.find((p) => p.id === 'grounding');
    expect(grounding?.status).not.toBe('ready');
    expect(grounding?.relatedIssueIds.length).toBeGreaterThan(0);
  });

  it('surfaces Google\'s skip list verbatim', () => {
    const snapshot = makeSnapshot();
    const insights = buildAiSearchInsights(snapshot, runRules(snapshot));
    expect(insights.skipList).toEqual([...GOOGLE_SKIP_LIST]);
    expect(insights.skipList.some((s) => s.includes('llms.txt'))).toBe(true);
  });
});
