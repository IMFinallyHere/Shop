import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Allow access via shop subdomains in dev, e.g. acme.localhost:5173
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        // Keep the original Host header (do NOT rewrite it): django-tenants
        // resolves the active shop from the request hostname/subdomain.
        changeOrigin: false,
      },
    },
  },
})
