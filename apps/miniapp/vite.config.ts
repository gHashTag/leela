import { defineConfig } from 'vite';

export default defineConfig({
  // Built to a relative base so the same bundle works from a subdirectory —
  // GitHub Pages serves from /<repo>/, a custom host from /.
  base: './',
  build: {
    outDir: 'dist',
    // The 22-language dataset is large; a warning at 500kB is noise here.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: true,
    port: 5173,
  },
});
