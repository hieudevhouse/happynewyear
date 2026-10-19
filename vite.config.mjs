import { transformAsync } from '@babel/core';
import presetReact from '@babel/preset-react';
import { readFile } from 'node:fs/promises';
import { loadEnv } from 'vite';

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  esbuild: false,
  plugins: [
    {
      name: 'fix-react-router-default-import',
      enforce: 'pre',
      transform(code, id) {
        if (!id.includes('node_modules/react-router/')) return null;
        const fixed = code.replace(/import React(\d*) from ["']react["'];/g, 'import * as React$1 from "react";');
        return fixed === code ? null : { code: fixed, map: null };
      }
    },
    {
      name: 'strip-broken-lucide-sourcemaps',
      enforce: 'pre',
      async load(id) {
        if (!id.includes('node_modules/lucide-react/')) return null;
        const file = id.split('?')[0];
        const code = await readFile(file, 'utf8');
        return { code: code.replace(/\/\/#[#@] sourceMappingURL=.*$/gm, ''), map: null };
      },
      transform(code, id) {
        if (!id.includes('node_modules/lucide-react/')) return null;
        return { code: code.replace(/\/\/#[#@] sourceMappingURL=.*$/gm, ''), map: null };
      }
    },
    {
      name: 'babel-react-transform',
      async transform(code, id) {
        if (!/\.(jsx|tsx)$/.test(id)) return null;
        const result = await transformAsync(code, {
          filename: id,
          presets: [[presetReact, { runtime: 'automatic' }]],
          sourceMaps: true
        });
        return { code: result.code, map: result.map };
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    hmr: { overlay: false },
    proxy: {
      '/api': { target: env.API_PROXY_TARGET || `http://127.0.0.1:${env.PORT || 4000}`, changeOrigin: false }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-router',
      'cookie',
      'set-cookie-parser',
      'lucide-react'
    ]
  }
  };
};
