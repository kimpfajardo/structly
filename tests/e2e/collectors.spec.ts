import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { build } from 'vite';
import type { PageSnapshot } from '../../src/core/types';
import {
  a11yMissingMain,
  a11yUnlabeledControls,
  a11yIconButtonNoName,
  a11yVagueLinkText,
} from '../../src/core/rules/accessibility';
import { renderingLowInitialText, renderingAppShellEmptyRaw } from '../../src/core/rules/rendering';

const fixtureUrl = (name: string): string => new URL(`../fixtures/${name}`, import.meta.url).href;

type BundleOutput = { output: Array<{ code: string }> };

// The collectors run in the page. Vite (a declared dependency) bundles the pure collection
// routine + parseRawHtml into an IIFE that we inject with addScriptTag and call via evaluate.
let collectorBundle = '';

test.beforeAll(async () => {
  const result = (await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: 'tests/e2e/collector-entry.ts',
        name: '__collector',
        formats: ['iife'],
        fileName: () => 'collector.js',
      },
    },
  })) as unknown as BundleOutput | BundleOutput[];
  const bundle = Array.isArray(result) ? result[0] : result;
  const code = bundle?.output[0]?.code;
  if (!code) throw new Error('Failed to bundle the collectors for the E2E test.');
  collectorBundle = code;
});

async function collect(page: Page): Promise<PageSnapshot> {
  await page.addScriptTag({ content: collectorBundle });
  return (await page.evaluate(
    () =>
      (
        window as unknown as { __collector: { collectSnapshot: () => unknown } }
      ).__collector.collectSnapshot(),
  )) as PageSnapshot;
}

test('good-marketing.html produces a strong snapshot', async ({ page }) => {
  await page.goto(fixtureUrl('good-marketing.html'));
  const s = await collect(page);

  expect(s.meta.title).toBe('Acme Analytics: Ship Faster');
  expect(s.meta.metaDescription).toBe('Acme Analytics helps teams ship faster with clear metrics.');
  expect(s.meta.canonicalCount).toBe(1);
  expect(s.meta.canonical).toContain('acme.example/analytics');
  expect(s.meta.lang).toBe('en');
  expect(s.meta.viewport).toBe('width=device-width, initial-scale=1');
  expect(s.h1Count).toBe(1);
  expect(s.landmarks.hasMain).toBe(true);
  expect(s.landmarks.mainCount).toBe(1);
  expect(s.landmarks.hasNav).toBe(true);
  expect(s.primaryCta?.text).toBe('Start free trial');
  expect(s.primaryCta?.accessibleName).toBe('Start free trial');
  expect(s.jsonLd).toHaveLength(1);
  expect(s.jsonLd[0]?.valid).toBe(true);
  expect(s.jsonLd[0]?.types).toContain('Product');
  expect(s.rendered.mainTextLength).toBeGreaterThan(100);
  expect(s.buttons.some((b) => b.isIconOnly && b.accessibleName === '')).toBe(false);
});

test('a11y-broken.html triggers the four accessibility rules', async ({ page }) => {
  await page.goto(fixtureUrl('a11y-broken.html'));
  const s = await collect(page);

  expect(s.landmarks.hasMain).toBe(false);
  expect(s.buttons.some((b) => b.isIconOnly && b.accessibleName === '')).toBe(true);
  expect(s.formControls.some((c) => !c.hasLabel && c.accessibleName === '')).toBe(true);

  expect(a11yMissingMain(s)?.id).toBe('a11y.missing-main');
  expect(a11yUnlabeledControls(s)?.id).toBe('a11y.unlabeled-controls');
  expect(a11yIconButtonNoName(s)?.id).toBe('a11y.icon-button-no-name');
  expect(a11yVagueLinkText(s)?.id).toBe('a11y.vague-link-text');
});

test('csr-shell.html yields tiny raw metrics and fires rendering risk', async ({ page }) => {
  await page.goto(fixtureUrl('csr-shell.html'));
  await page.addScriptTag({ content: collectorBundle });
  const html = await page.content();
  const raw = (await page.evaluate(
    (h) =>
      (
        window as unknown as {
          __collector: { parseRawHtml: (html: string, parser: DOMParser) => unknown };
        }
      ).__collector.parseRawHtml(h, new DOMParser()),
    html,
  )) as PageSnapshot['raw'];

  expect(raw.available).toBe(true);
  expect(raw.bodyTextLength).toBeLessThan(100);

  // Pair the tiny raw side with a substantial rendered side (post-hydration) to exercise the
  // rendering-risk rules, per 08-testing-acceptance.md.
  const snapshot = {
    raw,
    rendered: {
      mainTextLength: 900,
      bodyTextLength: 950,
      hasSkeletonMarkers: false,
      frameworkMarkers: ['react'],
    },
  } as unknown as PageSnapshot;

  expect(renderingLowInitialText(snapshot)?.status).toBe('fail');
  expect(renderingAppShellEmptyRaw(snapshot)?.id).toBe('rendering.app-shell-empty-raw');
});
