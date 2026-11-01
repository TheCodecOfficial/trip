import { existsSync, readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// In dev, serve a locally built blob (data/trip.dev.enc, gitignored) instead of public/trip.enc,
// so test builds with throwaway passphrases never end up in public/ or in git.
const devData = (): Plugin => ({
  name: 'dev-trip-data',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const file = 'data/trip.dev.enc'
      if (!req.url?.split('?')[0].endsWith('/trip.enc') || !existsSync(file)) return next()
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Cache-Control', 'no-store')
      res.end(readFileSync(file))
    })
  },
})

export default defineConfig({
  base: process.env.BASE ?? '/',
  build: { sourcemap: false },
  plugins: [
    devData(),
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Trip',
        short_name: 'Trip',
        description: 'Offline travel companion',
        theme_color: '#1b1f2a',
        background_color: '#1b1f2a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,enc}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
})
