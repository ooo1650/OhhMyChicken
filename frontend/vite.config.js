import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Two entry points: the customer site (index.html) and the staff dashboard
// (admin.html), so customers never download dashboard code.
// In dev, /api goes to the backend and /admin/ serves the dashboard page.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'admin-path',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (/^\/admin\/?(\?.*)?$/.test(req.url)) req.url = '/admin.html';
          next();
        });
      }
    }
  ],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL || 'http://localhost:4000', changeOrigin: false } }
  },
  build: {
    assetsDir: 'static', // hashed bundles; /assets/ holds the hand-made SVGs
    rollupOptions: { input: { main: 'index.html', admin: 'admin.html' } }
  }
});
