import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/rpc-bradbury': {
        target: 'https://rpc-bradbury.genlayer.com',
        changeOrigin: true,
        rewrite: p => p.replace('/api/rpc-bradbury', ''),
      },
      '/api/studio': {
        target: 'https://studio.genlayer.com/api',
        changeOrigin: true,
        rewrite: p => p.replace('/api/studio', ''),
      },
    },
  },
})
