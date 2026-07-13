import { describe, expect, it } from 'vitest';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import { buildReadinessAssessment } from '../readiness';

describe('buildReadinessAssessment', () => {
  it('reports structural question signals without claiming it answered the question', () => {
    const assessment = buildReadinessAssessment({
      snapshot: makeSnapshot({
        headings: [{ level: 1, text: 'Example Product helps teams ship faster' }],
      }),
      purpose: 'marketing',
      questions: ['How does Example Product help teams ship faster?', 'What is the pricing?', '', 'Ignored question'],
    });

    expect(assessment.questionCoverage.items).toEqual([
      expect.objectContaining({
        state: 'structurally-covered',
        matchedIn: expect.arrayContaining(['heading', 'leading-content']),
      }),
      expect.objectContaining({ question: 'What is the pricing?', state: 'not-found' }),
      expect.objectContaining({ question: 'Ignored question', state: 'not-found' }),
    ]);
    expect(assessment.questionCoverage.items).toHaveLength(3);
    expect(assessment.conditions.find((condition) => condition.id === 'question-coverage')).toMatchObject({
      state: 'blocked',
      detail: expect.stringContaining('does not verify answer quality or correctness'),
    });
  });

  it('assesses a specific primary CTA as a named action path', () => {
    const assessment = buildReadinessAssessment({
      snapshot: makeSnapshot(),
      purpose: 'product',
      questions: ['What does the product do?'],
    });

    expect(assessment.actionPath).toMatchObject({
      state: 'named-primary-cta',
      name: 'Start free trial',
    });
    expect(assessment.conditions.find((condition) => condition.id === 'action-path')?.state).toBe('supported');
  });

  it('blocks a generic CTA and leaves a labeled form outcome unverifiable', () => {
    const generic = buildReadinessAssessment({
      snapshot: makeSnapshot({ primaryCta: { text: 'Learn more', accessibleName: 'Learn more' } }),
      purpose: 'marketing',
    });
    const formOnly = buildReadinessAssessment({
      snapshot: makeSnapshot({
        primaryCta: null,
        formControls: [{ tag: 'input', type: 'email', hasLabel: true, accessibleName: 'Work email' }],
      }),
      purpose: 'account',
    });

    expect(generic.actionPath?.state).toBe('generic-primary-cta');
    expect(generic.conditions.find((condition) => condition.id === 'action-path')?.state).toBe('blocked');
    expect(formOnly.actionPath?.state).toBe('form-fields-only');
    expect(formOnly.conditions.find((condition) => condition.id === 'action-path')?.state).toBe('unverifiable-locally');
  });

  it('uses transparent local readiness states for delivery and observed performance', () => {
    const assessment = buildReadinessAssessment({
      snapshot: makeSnapshot({
        raw: { available: true, mainTextLength: 10, bodyTextLength: 20 },
        rendered: { mainTextLength: 1200, bodyTextLength: 1800 },
      }),
      purpose: 'marketing',
    });

    expect(assessment.conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'initial-content', state: 'blocked' }),
        expect.objectContaining({ id: 'observed-performance', state: 'needs-observed-data' }),
      ]),
    );
    expect(JSON.stringify(assessment)).not.toContain('likelihood');
    expect(assessment.conditions.find((condition) => condition.id === 'observed-performance')?.detail).toContain(
      'cannot verify',
    );
  });

  it('keeps universal readiness checks available when the page type is unknown', () => {
    const assessment = buildReadinessAssessment({
      snapshot: makeSnapshot({ pageType: 'unknown' }),
      purpose: 'unknown',
    });

    expect(assessment.actionPath).toBeNull();
    expect(assessment.conditions.map((condition) => condition.id)).toEqual([
      'initial-content',
      'question-coverage',
      'observed-performance',
    ]);
  });
});
