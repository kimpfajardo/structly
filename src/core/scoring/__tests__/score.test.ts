import { describe, it, expect } from 'vitest';
import type { AuditIssue, CategoryId, Severity, Status } from '../../types';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import { scoreAudit, bandFor } from '../score';

function mkIssue(category: CategoryId, severity: Severity, status: Status): AuditIssue {
  return {
    id: 'x',
    category,
    severity,
    status,
    title: '',
    whyItMatters: '',
    evidence: [],
    recommendedFix: '',
    selectors: [],
    scoreImpact: 0,
  };
}

describe('scoreAudit', () => {
  it('matches the worked example (74 / Moderate risk)', () => {
    const report = scoreAudit(makeSnapshot(), [
      mkIssue('metadata', 'medium', 'warn'),
      mkIssue('content', 'medium', 'warn'),
      mkIssue('structured-data', 'high', 'fail'),
      mkIssue('accessibility', 'high', 'fail'),
    ]);
    expect(report.categories.map((c) => c.id)).toEqual([
      'metadata',
      'content',
      'structured-data',
      'rendering-risk',
      'cta',
      'accessibility',
    ]);
    const score = (id: CategoryId): number =>
      report.categories.find((c) => c.id === id)!.score;
    expect(score('metadata')).toBe(17);
    expect(score('content')).toBe(17);
    expect(score('structured-data')).toBe(5);
    expect(score('rendering-risk')).toBe(20);
    expect(score('cta')).toBe(15);
    expect(score('accessibility')).toBe(0);
    expect(report.overallScore).toBe(74);
    expect(report.band).toBe('Moderate risk');
  });

  it('scores a no-issues report as 100 / Strong readiness', () => {
    const report = scoreAudit(makeSnapshot(), []);
    expect(report.overallScore).toBe(100);
    expect(report.band).toBe('Strong readiness');
    for (const c of report.categories) expect(c.score).toBe(c.maxScore);
  });

  it('computes per-issue penalties (10 / 3 / 0 / 0)', () => {
    const high = mkIssue('metadata', 'high', 'fail');
    const med = mkIssue('content', 'medium', 'warn');
    const info = mkIssue('structured-data', 'low', 'info');
    const pass = mkIssue('cta', 'low', 'pass');
    scoreAudit(makeSnapshot(), [high, med, info, pass]);
    expect(high.scoreImpact).toBe(10);
    expect(med.scoreImpact).toBe(3);
    expect(info.scoreImpact).toBe(0);
    expect(pass.scoreImpact).toBe(0);
  });

  it('clamps a category score to 0 rather than negative', () => {
    const report = scoreAudit(makeSnapshot(), [
      mkIssue('accessibility', 'high', 'fail'),
      mkIssue('accessibility', 'high', 'fail'),
    ]);
    const acc = report.categories.find((c) => c.id === 'accessibility')!;
    expect(acc.score).toBe(0);
    expect(acc.maxScore).toBe(10);
  });

  it('bandFor covers the four band boundaries', () => {
    expect(bandFor(90)).toBe('Strong readiness');
    expect(bandFor(89)).toBe('Good, with targeted fixes');
    expect(bandFor(75)).toBe('Good, with targeted fixes');
    expect(bandFor(74)).toBe('Moderate risk');
    expect(bandFor(50)).toBe('Moderate risk');
    expect(bandFor(49)).toBe('Major improvement needed');
  });
});
