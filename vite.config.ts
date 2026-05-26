import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // escucha en 0.0.0.0 (accesible desde otras IPs / ngrok)
    allowedHosts: true, // acepta el host público de ngrok
    proxy: {
      // El front pega a /api (mismo origen) y Vite lo reenvía al backend.
      // Así un solo túnel de ngrok sirve front + API sin CORS.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
