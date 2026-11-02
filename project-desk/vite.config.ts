import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 47311,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:47292',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 47311,
    strictPort: true,
  },
})
