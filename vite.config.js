import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/metrics': 'http://localhost:8000',
      '/history': 'http://localhost:8000',
    },
  },
})
