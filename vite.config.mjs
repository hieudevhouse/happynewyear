import { transformAsync } from '@babel/core';
import presetReact from '@babel/preset-react';
import { readFile } from 'node:fs/promises';

export default {
  esbuild: false,
  plugins: [
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
    hmr: { overlay: false }
  },
  optimizeDeps: {
    noDiscovery: true
  }
};
