import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    // This project builds inside a folder where files cannot be deleted once written, but
    // Vite's default behavior empties `outDir` before every build. Disable that so rebuilds
    // overwrite existing files instead of trying (and failing) to unlink them first.
    emptyOutDir: false,
  },
});
