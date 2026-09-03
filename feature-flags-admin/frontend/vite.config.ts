import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const FLAGS_API = process.env.FLAGS_API_URL ?? 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5175,
    proxy: { '/api': FLAGS_API },
  },
  plugins: [react()],
})
