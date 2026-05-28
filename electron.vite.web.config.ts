/**
 * Vite config for browser-only development mode.
 *
 * Usage:  npm run dev:web
 *
 * This starts ONLY the renderer Vite dev server (no Electron),
 * so you can preview the UI in a normal browser.
 *
 * Prerequisites:
 *   1. Start the Python backend manually:
 *      cd backend && python -m uvicorn app.main:app --port 8000
 *   2. The frontend services will fallback to http://localhost:8000
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  server: {
    host: 'localhost',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:18080',
        changeOrigin: true,
        ws: true
      },
      '/health': {
        target: 'http://127.0.0.1:18080',
        changeOrigin: true
      }
    }
  },
  plugins: [react()]
})
