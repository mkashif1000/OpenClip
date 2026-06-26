import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Remap old package name to new in case any old imports slip through
      '@viral-clipper/shared': path.resolve(__dirname, '../shared/src'),
      '@openclip/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    // PORT env lets tooling pick a free port; defaults to 5173 for local dev.
    port: Number(process.env.PORT) || 5173,
    headers: {
      // Required for SharedArrayBuffer (ffmpeg.wasm multi-threading)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // `vite preview` serves the production build locally — it needs the same
  // cross-origin isolation headers as the dev server and Vercel, otherwise
  // ffmpeg.wasm multi-threading (SharedArrayBuffer) is disabled.
  preview: {
    port: 4173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    // ffmpeg packages use dynamic WASM loading — exclude from Vite pre-bundling
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  worker: {
    // The render worker is a module worker that code-splits (dynamic import of
    // mp4Decoder/canvasRenderer), which Vite only allows with the ES format —
    // the default 'iife' rejects code-splitting builds.
    format: 'es',
  },
  build: {
    // Target browsers that support WebCodecs
    target: ['chrome94', 'edge94', 'firefox130'],
    rollupOptions: {
      output: {
        // Separate ffmpeg into its own chunk for better caching
        manualChunks(id) {
          if (id.includes('@ffmpeg')) return 'ffmpeg';
          if (id.includes('remotion')) return 'remotion';
          if (id.includes('idb')) return 'idb';
        },
      },
    },
  },
})
