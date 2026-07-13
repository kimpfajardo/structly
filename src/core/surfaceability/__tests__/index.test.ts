import { describe, expect, it } from 'vitest';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import { analyzeSurfaceability } from '..';

describe('analyzeSurfaceability', () => {
  it('reports delivered main content when initial HTML has comparable text', () => {
    const analysis = analyzeSurfaceability(makeSnapshot());

    expect(analysis).toMatchObject({
      status: 'delivered',
      affectedScope: 'main-content',
      scopeLabel: 'Main content',
      metrics: {
        rawAvailable: true,
        rawMainTextLength: 1100,
        renderedMainTextLength: 1200,
      },
    });
  });

  it('reports a page-body delivery gap for an app-shell response', () => {
    const analysis = analyzeSurfaceability(
      makeSnapshot({
        raw: { available: true, mainTextLength: 20, bodyTextLength: 50 },
        rendered: { mainTextLength: 1200, bodyTextLength: 1800 },
      }),
    );

    expect(analysis).toMatchObject({
      status: 'missing',
      affectedScope: 'page-body',
      scopeLabel: 'Page body',
      fixDirection: 'Server-render meaningful page content instead of an empty app shell.',
    });
  });

  it('reports a partial main-content delivery gap from text counts only', () => {
    const analysis = analyzeSurfaceability(
      makeSnapshot({
        raw: { available: true, mainTextLength: 400, bodyTextLength: 900 },
        rendered: { mainTextLength: 1000, bodyTextLength: 1400 },
      }),
    );

    expect(analysis).toMatchObject({
      status: 'partial',
      affectedScope: 'main-content',
      metrics: { rawMainTextLength: 400, renderedMainTextLength: 1000 },
    });
  });

  it('keeps raw delivery unknown when the initial HTML was unavailable', () => {
    const analysis = analyzeSurfaceability(
      makeSnapshot({ raw: { available: false, mainTextLength: 0, bodyTextLength: 0 } }),
    );

    expect(analysis).toMatchObject({
      status: 'unknown',
      affectedScope: 'delivery-check',
      metrics: { rawAvailable: false, rawMainTextLength: null, rawBodyTextLength: null },
    });
    expect(analysis.summary).not.toContain('diff');
  });
});
