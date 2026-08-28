import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Stable vendor chunks so a single lazy route never pulls the world.
// Without this, every page ships with recharts + the full router.
// Only carve out heavy / lazily-loaded libs into their own chunks; everything
// else stays in `vendor` so shared deps (react, scheduler, react-dom) cannot
// form a cycle across chunks.
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('recharts') || id.includes('d3-')) return 'charts';
  if (id.includes('@tanstack')) return 'query';
  if (id.includes('lucide-react')) return 'icons';
  if (id.includes('date-fns')) return 'date-fns';
  return 'vendor';
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        // Cache the app shell + GET /api responses for last-known-good reads.
        // Dashboard and attendance list are critical: when the network drops
        // the page still renders the last fetched snapshot.
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname === '/api/dashboard' || url.pathname.startsWith('/api/dashboard?'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-dashboard',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/attendance'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-attendance',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 12 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/students'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-students',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 12 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: 'School ERP',
          short_name: 'SchoolERP',
          description: 'School ERP — LAN edition',
          theme_color: '#1d4ed8',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
        },
        devOptions: {
          enabled: false, // keep dev mode clean; SW only kicks in on build/preview
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  };
});
