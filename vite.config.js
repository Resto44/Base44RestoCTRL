import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Code splitting — split vendor libraries into separate chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching
          'vendor-query': ['@tanstack/react-query'],
          // Supabase
          'vendor-supabase': ['@supabase/supabase-js'],
          // Charts
          'vendor-charts': ['recharts'],
          // Date utilities
          'vendor-date': ['date-fns'],
          // PDF generation
          'vendor-pdf': ['jspdf', 'html2canvas'],
          // UI primitives (Radix)
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-switch',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
          ],
        },
      },
    },
    // Increase chunk size warning limit slightly (we have many components)
    chunkSizeWarningLimit: 600,
    // Enable source maps for production debugging
    sourcemap: false,
    // Minify with esbuild (faster than terser)
    minify: 'esbuild',
    // Target modern browsers for smaller bundles
    target: 'es2020',
  },
});
