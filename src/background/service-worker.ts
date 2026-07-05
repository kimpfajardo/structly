// Service worker — MV3 module, stateless. Route + inject + raw-HTML fetch only.
// Never store audit data in module-level variables expecting persistence.
// See 01-architecture.md.

import type { AuditRequest } from '../core/schemas/messages';
import { AuditRequestSchema } from '../core/schemas/messages';
import type { PageSnapshot } from '../core/types';

const RAW_HTML_TIMEOUT_MS = 8000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // no-op: setPanelBehavior can reject on unsupported Chrome versions
  });
});

function getContentScriptFile(): string {
  // 01-architecture.md specifies `files: ['content.js']` for this fallback, but CRXJS
  // (09-build-config.md) emits the content script under a content-hashed filename, so a
  // literal 'content.js' would not resolve in the built extension. Reading the real path
  // from the manifest keeps this fallback correct regardless of the build's hash.
  const [contentScript] = chrome.runtime.getManifest().content_scripts ?? [];
  const [file] = contentScript?.js ?? [];
  if (!file) throw new Error('No content script registered in manifest.');
  return file;
}

const INJECT_RETRY_ATTEMPTS = 10;
const INJECT_RETRY_DELAY_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectSnapshot(tabId: number): Promise<PageSnapshot> {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'COLLECT_SNAPSHOT' });
  } catch {
    // No content script present (e.g. page pre-dates install/reload). Inject, then retry.
    await chrome.scripting.executeScript({ target: { tabId }, files: [getContentScriptFile()] });
    // The CRXJS-built content script is a loader that registers its message listener only
    // after an async import() resolves, so executeScript returning does not mean the
    // listener exists yet. Poll briefly instead of retrying once.
    for (let attempt = 0; ; attempt++) {
      try {
        return await chrome.tabs.sendMessage(tabId, { type: 'COLLECT_SNAPSHOT' });
      } catch (err) {
        if (attempt >= INJECT_RETRY_ATTEMPTS - 1) throw err;
        await delay(INJECT_RETRY_DELAY_MS);
      }
    }
  }
}

async function fetchRawHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAW_HTML_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      credentials: 'include',
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((message: AuditRequest, _sender, sendResponse) => {
  const parsed = AuditRequestSchema.safeParse(message);
  if (!parsed.success) return undefined;

  const { tabId, url } = parsed.data;

  (async () => {
    let snapshot: PageSnapshot;
    try {
      snapshot = await collectSnapshot(tabId);
    } catch (err) {
      sendResponse({
        type: 'AUDIT_ERROR',
        message: err instanceof Error ? err.message : 'Failed to collect page snapshot.',
      });
      return;
    }

    const rawHtmlString = await fetchRawHtml(url);
    sendResponse({ type: 'AUDIT_RESULT', snapshot, rawHtmlString });
  })();

  return true; // keep the response channel open for the async work above
});
