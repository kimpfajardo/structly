# 01 — Architecture

## Execution contexts

There are exactly three contexts. Keep responsibilities strictly separated.

### 1. Content script (`src/content/collect.ts`)
- Runs in the page (isolated world), registered for `<all_urls>` at `document_idle`.
- Registers a `chrome.runtime.onMessage` listener.
- On receiving `{ type: 'COLLECT_SNAPSHOT' }`, runs all collectors (`03`) and returns a
  `PageSnapshot` via `sendResponse`. The listener must `return true` to keep the response
  channel open for the synchronous build of the snapshot (build is sync, but return `true`
  for safety/consistency).
- Sets `snapshot.pageType = 'unknown'` and `snapshot.raw = { available: false, mainTextLength: 0, bodyTextLength: 0 }`.
  These are finalized by the panel, not the content script.
- Holds no persistent state. Does not fetch anything. Does not run rules.

### 2. Service worker (`src/background/service-worker.ts`)
- MV3 module service worker. **Stateless** — it may be terminated between audits; never store
  audit data in module-level variables expecting persistence.
- On install/startup: `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.
- Handles `{ type: 'AUDIT_REQUEST', tabId, url }` from the panel. Steps:
  1. Send `{ type: 'COLLECT_SNAPSHOT' }` to the tab via `chrome.tabs.sendMessage(tabId, ...)`.
     - If it throws (no content script present, e.g. page pre-dates install), call
       `chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })`, then
       retry `sendMessage` **once**. If it still fails, respond with `AUDIT_ERROR`.
  2. Fetch raw HTML: `fetch(url, { credentials: 'include', redirect: 'follow' })`.
     - On success and `res.ok`: `rawHtmlString = await res.text()`.
     - On any failure (network error, CORS/opaque, non-OK status, timeout): `rawHtmlString = null`.
     - Apply a timeout of 8000 ms using `AbortController`.
  3. Respond to the panel with
     `{ type: 'AUDIT_RESULT', snapshot, rawHtmlString }` (or `{ type: 'AUDIT_ERROR', message }`).
- Runs no rules and no scoring.

### 3. Panel (`src/panel/`)
- React app rendered in the Chrome Side Panel. This is the **only stateful client**.
- On "Audit Page": query the active tab
  (`chrome.tabs.query({ active: true, currentWindow: true })`), then send
  `{ type: 'AUDIT_REQUEST', tabId, url }` to the service worker.
- On `AUDIT_RESULT`:
  1. Parse `rawHtmlString` via `parseRawHtml(rawHtmlString, new DOMParser())` (`03`) → `RawHtmlMetrics`.
     Assign to `snapshot.raw`.
  2. Set `snapshot.pageType` from the page-type `<select>` value.
  3. Validate the finalized snapshot with the Zod schema (`02`). If invalid, show an error state.
  4. Run all rules (`04`) → `AuditIssue[]`. Run scoring (`05`) → `AuditReport`.
  5. Render (`06`).
- Imports rules, scoring, and export modules directly from `src/core/` (they are pure TS).

## Data flow

```
Panel                Service Worker              Content Script (page)
  |                        |                             |
  |-- AUDIT_REQUEST ------>|                             |
  |                        |-- COLLECT_SNAPSHOT --------->|
  |                        |                             |-- run collectors
  |                        |<----- PageSnapshot ---------|   (rendered fields)
  |                        |-- fetch(url) raw HTML        |
  |                        |   -> rawHtmlString | null    |
  |<-- AUDIT_RESULT --------|                             |
  |   (snapshot,           |                             |
  |    rawHtmlString)      |                             |
  |-- parse rawHtml -> snapshot.raw                       |
  |-- set snapshot.pageType from <select>                 |
  |-- validate -> run rules -> score -> render            |
```

## Why raw HTML is fetched separately (do not shortcut this)

The content script runs at `document_idle`, after the SPA has usually hydrated. From inside
the page it cannot observe the pre-JavaScript DOM. To judge whether primary content depends on
client-side rendering, the audit compares:

- **Rendered text** (from the content script, live DOM), and
- **Raw server text** (parsed from the separately fetched HTML response).

If substantial primary text exists in the rendered DOM but is absent from the raw HTML, the
page is client-render-dependent (a real risk for indexing/retrieval). See rules
`rendering.low-initial-text` and `rendering.app-shell-empty-raw` in `04`.

**Known limitations (encode, do not fight):**
- Cross-origin or auth-gated fetches may be opaque or blocked → `raw.available = false`.
- When `raw.available = false`, rendering-risk rules that need the raw comparison must emit
  `status: 'info'` (not `fail`), stating the server HTML could not be verified. Specified per
  rule in `04`.
- `credentials: 'include'` lets same-origin internal pages return authenticated HTML.

## Message contract (authoritative)

All messages are validated with Zod (`02`). Shapes:

```ts
// Panel -> Service Worker
type AuditRequest = { type: 'AUDIT_REQUEST'; tabId: number; url: string };

// Service Worker -> Content Script
type CollectRequest = { type: 'COLLECT_SNAPSHOT' };

// Content Script -> Service Worker (sendResponse payload)
type CollectResponse = PageSnapshot; // rendered fields populated; raw defaulted; pageType 'unknown'

// Service Worker -> Panel
type AuditResult = { type: 'AUDIT_RESULT'; snapshot: PageSnapshot; rawHtmlString: string | null };
type AuditError  = { type: 'AUDIT_ERROR'; message: string };
```

The panel must handle `AUDIT_ERROR` by showing the error message and a retry affordance.
