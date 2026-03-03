import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: process.env.VITE_DOCKER_DEV === 'true',
      interval: 100,
    },
    hmr: process.env.VITE_DOCKER_DEV === 'true'
      ? {
          host: 'localhost',
          clientPort: 5173,
          port: 5173,
        }
      : undefined,
  },
})
