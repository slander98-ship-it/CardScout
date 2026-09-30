import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: true, // reachable from your phone on the same Wi-Fi
    proxy: { '/api': 'http://localhost:3001' },
  },
  plugins: [
    // `npm run dev` also starts the local /api functions (scripts/local-api.js).
    { name: 'local-api', apply: 'serve', configureServer: async () => { await import('./scripts/local-api.js'); } },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'CardScout — Sports Card Appraiser',
        short_name: 'CardScout',
        description: 'Scan, value, track and list sports cards. Deal or no deal, in seconds.',
        theme_color: '#0b0d10',
        background_color: '#0b0d10',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['shopping', 'finance', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Scan a card', url: '/?tab=evaluate', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'My Collection', url: '/?tab=collection', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // App shell works offline; the collection lives in IndexedDB so it's
        // viewable with no signal. API calls are never cached (prices must be live).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
