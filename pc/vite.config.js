import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main-process entry point of the Electron App
        entry: 'electron/main.js',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'electron',
                'ws',
                'path',
                'os',
                'url',
                'events',
                'http',
                'https',
                'net',
                'stream',
                'util',
                'crypto'
              ],
            },
          },
        },
      },
      {
        entry: 'electron/preload.js',
        onstart(options) {
          options.reload()
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
