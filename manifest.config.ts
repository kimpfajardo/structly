import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Page Readiness Auditor',
  version: '0.1.0',
  description:
    'Audits the active page for metadata, structure, structured data, rendering risk, CTA clarity, and accessibility/agent-readiness.',
  action: { default_title: 'Open Page Readiness Auditor' },
  background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
  side_panel: { default_path: 'src/panel/index.html' },
  content_scripts: [
    { matches: ['<all_urls>'], js: ['src/content/collect.ts'], run_at: 'document_idle' },
  ],
  permissions: ['scripting', 'sidePanel', 'tabs', 'activeTab'],
  host_permissions: ['<all_urls>'],
});
