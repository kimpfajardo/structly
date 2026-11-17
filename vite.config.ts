import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    // Release builds must not include assets left over from earlier builds.
    emptyOutDir: true,
  },
});
