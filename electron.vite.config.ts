import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tres partes: main (el cerebro), preload (el puente) y renderer (la pantalla).
export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'electron/main.ts') } }
    }
  },
  preload: {
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'electron/preload.ts') } }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    envDir: __dirname,
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/index.html') } }
    },
    resolve: {
      alias: { '@': resolve(__dirname, 'src') }
    },
    plugins: [react(), tailwindcss()]
  }
})
