import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Hashed bundles go to /build, keeping /assets exclusively for the
    // generated artwork copied from public/. The two have very different
    // caching characteristics and sharing a prefix makes the _headers rules
    // ambiguous about which one wins.
    assetsDir: 'build',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
