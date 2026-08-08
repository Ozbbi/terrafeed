import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * In the packaged app every outbound request goes through the Rust `net_get`
 * command. `npm run dev` has no Rust process, so this middleware stands in for
 * it and the app behaves identically in a plain browser.
 */
function devProxy(): Plugin {
  return {
    name: 'terrafeed-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/__proxy', async (req, res) => {
        const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url');
        if (!target) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'missing url' }));
          return;
        }
        try {
          const upstream = await fetch(target, {
            headers: { 'user-agent': 'Terrafeed/1.0 (dev)', accept: '*/*' },
          });
          const body = await upstream.text();
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              status: upstream.status,
              ok: upstream.ok,
              contentType: upstream.headers.get('content-type') ?? '',
              body,
              finalUrl: upstream.url,
            }),
          );
        } catch (error) {
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devProxy()],
  clearScreen: false,
  server: {
    port: 5183,
    strictPort: true,
    host: '127.0.0.1',
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'chrome110',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
});
