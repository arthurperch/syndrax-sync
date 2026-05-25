import { defineConfig } from 'vitest/config';
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
        // Exclude index-*.css (popup CSS sets html/body to 420px — must not bleed into full-page views)
        const cssFiles = assets.filter(f => f.endsWith('.css') && !f.startsWith('index'));
        const cssLinks = cssFiles.map(f => `    <link rel="stylesheet" href="assets/${f}">`).join('\n');
        writeFileSync(
          resolve(__dirname, 'dist/dashboard.html'),
          `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Syndrax Sync — Dashboard</title>
${cssLinks}
  </head>
  <body style="margin:0;background:#02050f">
    <div id="dashboard-root"></div>
    ${dashJs ? `<script type="module" src="assets/${dashJs}"></script>` : '<!-- dashboard-main chunk not found -->'}
  </body>
</html>`
        );
      }
    },
    {
      name: 'build-bulklister',
      closeBundle() {
        const assets = readdirSync(resolve(__dirname, 'dist/assets'));
        const blJs = assets.find(f => f.startsWith('bulklister-main') && f.endsWith('.js'));
        // Exclude index-*.css (popup CSS sets html/body to 420px — must not bleed into full-page views)
        const cssFiles = assets.filter(f => f.endsWith('.css') && !f.startsWith('index'));
        const cssLinks = cssFiles.map(f => `    <link rel="stylesheet" href="assets/${f}">`).join('\n');
        writeFileSync(
          resolve(__dirname, 'dist/bulklister.html'),
          `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Syndrax Sync — Bulk Lister</title>
${cssLinks}
  </head>
  <body style="margin:0;background:#02050f">
    <div id="bulklister-root"></div>
    ${blJs ? `<script type="module" src="assets/${blJs}"></script>` : '<!-- bulklister-main chunk not found -->'}
  </body>
</html>`
        );
      }
    }
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        'dashboard-main': resolve(__dirname, 'src/dashboard-main.tsx'),
        'bulklister-main': resolve(__dirname, 'src/bulklister-main.tsx'),
      },
    },
  },
});