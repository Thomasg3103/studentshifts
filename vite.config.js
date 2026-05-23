/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['favicon.svg', 'og-image.png'],
      manifest: {
        name: 'StudentShifts',
        short_name: 'StudentShifts',
        description: 'Find part-time work that fits your college timetable',
        theme_color: '#A21D54',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'maskable_icon_x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'maskable_icon_x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
    process.env.ANALYZE && visualizer({ open: true, gzipSize: true, brotliSize: true, filename: "dist/stats.html" }),
  ].filter(Boolean),
  build: {
    target: ["es2020", "chrome80", "safari14"],
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — smallest possible first-paint chunk
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Router
          if (id.includes('node_modules/react-router') || id.includes('node_modules/@remix-run/')) {
            return 'vendor-router';
          }
          // Supabase — large SDK, only needed after login
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          // Sentry — error monitoring, non-critical path
          if (id.includes('node_modules/@sentry/')) {
            return 'vendor-sentry';
          }
          // PDF viewer + mammoth — only loaded when a CV/cover letter is opened
          // These are already dynamically imported, but grouping them ensures
          // they don't accidentally leak into other chunks.
          if (id.includes('node_modules/react-pdf') || id.includes('node_modules/pdfjs-dist') || id.includes('node_modules/mammoth')) {
            return 'vendor-documents';
          }
          // Everything else in node_modules → vendor-misc
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.js',
  },
})
