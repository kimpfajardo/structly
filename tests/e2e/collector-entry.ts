// Test-only entry: bundles the pure collection routine and the raw-HTML parser into an
// injectable script for the Playwright collector tests (08-testing-acceptance.md). Not shipped
// in the extension — collectors.spec.ts builds this to an IIFE global (__collector) via Vite.
export { collectSnapshot } from '../../src/content/collect';
export { parseRawHtml } from '../../src/core/rawHtml';
