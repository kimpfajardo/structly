import { describe, it, expect } from 'vitest';
import type { AuditIssue } from '../../types';
import { makeSnapshot } from '../../../__fixtures__/makeSnapshot';
import { schemaNoJsonld, schemaInvalidJsonld, schemaUnrecognizedType } from '../structuredData';

function assertIssue(
  issue: AuditIssue | null,
  expected: { id: string; category: string; severity: string; status: string },
): void {
  expect(issue).not.toBeNull();
  if (!issue) return;
  expect(issue.id).toBe(expected.id);
  expect(issue.category).toBe(expected.category);
  expect(issue.severity).toBe(expected.severity);
  expect(issue.status).toBe(expected.status);
  expect(issue.evidence.length).toBeGreaterThan(0);
}

describe('structured-data rules', () => {
  it('schema.no-jsonld warns for product with no JSON-LD', () => {
    assertIssue(schemaNoJsonld(makeSnapshot({ pageType: 'product', jsonLd: [] })), {
      id: 'schema.no-jsonld',
      category: 'structured-data',
      severity: 'low',
      status: 'warn',
    });
  });
  it('schema.no-jsonld is info for docs with no JSON-LD', () => {
    assertIssue(schemaNoJsonld(makeSnapshot({ pageType: 'docs', jsonLd: [] })), {
      id: 'schema.no-jsonld',
      category: 'structured-data',
      severity: 'low',
      status: 'info',
    });
  });
  it('schema.no-jsonld null when JSON-LD present', () => {
    expect(schemaNoJsonld(makeSnapshot())).toBeNull();
  });

  it('schema.invalid-jsonld fires on an invalid block', () => {
    assertIssue(
      schemaInvalidJsonld(
        makeSnapshot({ jsonLd: [{ raw: '{bad', valid: false, types: [], parsed: null }] }),
      ),
      { id: 'schema.invalid-jsonld', category: 'structured-data', severity: 'high', status: 'fail' },
    );
  });
  it('schema.invalid-jsonld null when all blocks valid', () => {
    expect(schemaInvalidJsonld(makeSnapshot())).toBeNull();
  });

  it('schema.unrecognized-type fires on a valid block with no known type', () => {
    assertIssue(
      schemaUnrecognizedType(
        makeSnapshot({ jsonLd: [{ raw: '{}', valid: true, types: [], parsed: {} }] }),
      ),
      {
        id: 'schema.unrecognized-type',
        category: 'structured-data',
        severity: 'low',
        status: 'info',
      },
    );
  });
  it('schema.unrecognized-type null when a known type is present', () => {
    expect(schemaUnrecognizedType(makeSnapshot())).toBeNull();
  });
});
