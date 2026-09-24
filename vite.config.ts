/// <reference types="vitest/config" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages のサブパス。別の場所に置くときは環境変数 BASE_PATH で上書きする
const base = process.env.BASE_PATH ?? '/tc-builder/';

// Service Worker（workbox の別ビルド）に入るパッケージ。バンドルの中身からは拾えないので手で並べる
const SW_PACKAGES = [
  'workbox-core',
  'workbox-routing',
  'workbox-strategies',
  'workbox-precaching',
  'workbox-expiration',
  'workbox-cacheable-response',
];

/** 本番ビルドに入ったライブラリの著作権表示とライセンス文を dist/licenses.txt に書き出す */
function thirdPartyLicenses(): Plugin {
  return {
    name: 'third-party-licenses',
    apply: 'build',
    generateBundle(_options, bundle) {
      const names = new Set(SW_PACKAGES);
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const id of output.moduleIds) {
          const m = /.*node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/.exec(id);
          if (m) names.add(m[1].replace('\\', '/'));
        }
      }
      const sections = [...names].sort().map((name) => {
        const dir = join('node_modules', name);
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
          version: string;
          license?: string;
        };
        const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f));
        const text = file ? readFileSync(join(dir, file), 'utf8').trim() : '';
        return `${name}@${pkg.version} (${pkg.license ?? 'ライセンス不明'})\n\n${text}`;
      });
      const header = [
        'KT式 TC ビルダーは GNU Affero General Public License v3.0 以降（AGPL-3.0-or-later）で公開しています。',
        'ソースコード：https://github.com/K-Triar/tc-builder',
        '',
        '以下は、このアプリに含まれるライブラリの著作権表示とライセンスです。',
      ].join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'licenses.txt',
        source: [header, ...sections].join(`\n\n${'-'.repeat(72)}\n\n`) + '\n',
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    thirdPartyLicenses(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'KT式 TC ビルダー',
        short_name: 'KT式TC',
        description: 'TrainCarts の KT式（経路コード方式）の看板とコマンドを質問に答えて作るツール',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#185a8d',
        background_color: '#f7f5ef',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        // 文字（Google Fonts の Noto Sans JP）は一度読めばオフラインでも使えるように残す
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    // 画面のテストはサンプル全体を jsdom で描くので、並列で走らせると 5 秒を超えることがある
    testTimeout: 30_000,
  },
});
