import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import refundsApiPlugin from './refundsApiPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), refundsApiPlugin()],
})
