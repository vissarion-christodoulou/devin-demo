import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import kycApiPlugin from './kycApiPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), kycApiPlugin()],
})
