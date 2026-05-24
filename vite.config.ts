import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import { resolve } from 'path';
import { writeFileSync, readdirSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    {
      name: 'build-dashboard',
      closeBundle() {
        const assets = readdirSync(resolve(__dirname, 'dist/assets'));
        const dashJs = assets.find(f => f.startsWith('dashboard-main') && f.endsWith('.js'));
        const css = assets.find(f => f.startsWith('dashboard-main') && f.endsWith('.css'));
        writeFileSync(
          resolve(__dirname, 'dist/dashboard.html'),
          `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Syndrax Sync — Dashboard</title>
    ${css ? `<link rel="stylesheet" href="assets/${css}">` : ''}
  </head>
  <body style="margin:0;background:#02050f">
    <div id="dashboard-root"></div>
    ${dashJs ? `<script type="module" src="assets/${dashJs}"></script>` : ''}
  </body>
</html>`
        );
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        'dashboard-main': resolve(__dirname, 'src/dashboard-main.tsx'),
      },
    },
  },
});