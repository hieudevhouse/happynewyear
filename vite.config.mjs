import { transformAsync } from '@babel/core';
import presetReact from '@babel/preset-react';

export default {
  esbuild: false,
  plugins: [{
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
  }],
  server: {
    host: '0.0.0.0',
    hmr: { overlay: false }
  },
  optimizeDeps: {
    noDiscovery: true
  }
};
