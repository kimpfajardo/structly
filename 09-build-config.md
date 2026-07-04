# 09 — Build and Configuration

Package manager: **npm** (do not use pnpm/yarn). Node **18+**. Chrome extension **Manifest V3**.
Bundler: **Vite 5** with **@crxjs/vite-plugin** (handles the MV3 manifest, multiple entry
points, and HMR for the panel).

## Dependencies (exact set — do not add others)

`dependencies`:
- `react`
- `react-dom`
- `zod`

`devDependencies`:
- `typescript`
- `vite`
- `@vitejs/plugin-react`
- `@crxjs/vite-plugin`
- `@types/chrome`
- `@types/react`
- `@types/react-dom`
- `vitest`
- `jsdom`
- `@playwright/test`

(Optional, only if panel tests are added: `@testing-library/react`, `@testing-library/dom`,
`@testing-library/jest-dom`. Not part of Phase 1 requirements.)

Pin majors: React 18, Vite 5, `@crxjs/vite-plugin` v2 (beta line compatible with Vite 5), Zod 3.
If a listed package's current major is incompatible with Vite 5 at install time, stop and ask
rather than substituting a different library.

## Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  }
}
```

## Folder structure (create exactly)

```
/
  package.json
  tsconfig.json
  vite.config.ts
  manifest.config.ts
  vitest.config.ts
  playwright.config.ts
  /src
    /panel
      index.html
      main.tsx
      App.tsx
      panel.module.css
      /components            (panel subcomponents as needed)
    /content
      collect.ts             (entry: message listener + snapshot assembly)
      /collectors
        shared.ts            (normalizeText, isVisible, getMainRegion, accessibleName)
        meta.ts
        headings.ts
        landmarks.ts
        links.ts
        buttons.ts
        forms.ts
        jsonld.ts
        rendered.ts
        cta.ts
    /background
      service-worker.ts
    /core
      types.ts
      rawHtml.ts
      /rules
        index.ts             (ALL_RULES registry)
        constants.ts
        metadata.ts
        content.ts
        structuredData.ts
        rendering.ts
        cta.ts
        accessibility.ts
      /scoring
        score.ts
        weights.ts
      /export
        markdown.ts
        json.ts
      /schemas
        snapshot.ts
        messages.ts
    /__fixtures__
      /snapshots             (baseline + rule fixtures as .json)
  /tests
    /e2e
      collectors.spec.ts
    /fixtures
      good-marketing.html
      csr-shell.html
      a11y-broken.html
```

`/src/core` must be free of `chrome.*` and DOM-collection code so it stays unit-testable in
Node. `rawHtml.ts` takes an injected `DOMParser` (see `03`) rather than assuming a browser.

## `manifest.config.ts`

Use `@crxjs/vite-plugin`'s `defineManifest`. Required contents:

```ts
import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Page Readiness Auditor',
  version: '0.1.0',
  description: 'Audits the active page for metadata, structure, structured data, rendering risk, CTA clarity, and accessibility/agent-readiness.',
  action: { default_title: 'Open Page Readiness Auditor' },
  background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
  side_panel: { default_path: 'src/panel/index.html' },
  content_scripts: [
    { matches: ['<all_urls>'], js: ['src/content/collect.ts'], run_at: 'document_idle' },
  ],
  permissions: ['scripting', 'sidePanel', 'tabs', 'activeTab'],
  host_permissions: ['<all_urls>'],
});
```

Notes:
- `host_permissions: ['<all_urls>']` is required so the raw-HTML `fetch` and script-injection
  fallback work on internal/arbitrary pages. This is the product's core use case; keep it.
- The service worker sets `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`
  so the action icon opens the panel.

## `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
});
```

## `tsconfig.json` (strict)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "vitest/globals"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src", "tests"]
}
```

## `vitest.config.ts`
Configure `environment: 'node'` by default and `environment: 'jsdom'` for the `rawHtml` test
(via a top-of-file docblock `// @vitest-environment jsdom` or a per-directory config). Enable
`globals: true`.

## Loading for development
`npm run dev` (or `npm run build`) produces the extension under `dist/`. Load it in Chrome via
`chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Distribution (later; not Phase 1)
- Internal only: distribute `dist/` (load unpacked) or via enterprise policy. No store needed.
- Chrome Web Store (optional): one-time developer fee applies; review is slower for extensions
  requesting `<all_urls>` + `scripting`. Not required to consider the build complete.
