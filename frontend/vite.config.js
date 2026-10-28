import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// The icon sprite is cached by browsers; its URL carries a hash of its
// contents so a changed sprite is fetched fresh after a deploy.
const SPRITE_VERSION = createHash('sha256').update(readFileSync(new URL('./public/assets/icons.svg', import.meta.url))).digest('hex').slice(0, 10);

// Two entry points: the customer site (index.html) and the staff dashboard
// (admin.html), so customers never download dashboard code.
// In dev, /api goes to the backend and /admin/ serves the dashboard page.
export default defineConfig({
  define: { __SPRITE__: JSON.stringify('/assets/icons.svg?v=' + SPRITE_VERSION) },
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
    proxy: {
      '/api': { target: process.env.API_URL || 'http://localhost:4000', changeOrigin: false },
      '/media': { target: process.env.API_URL || 'http://localhost:4000', changeOrigin: false }
    }
  },
  build: {
    assetsDir: 'static', // hashed bundles; /assets/ holds the hand-made SVGs
    rollupOptions: { input: { main: 'index.html', admin: 'admin.html' } }
  }
});
