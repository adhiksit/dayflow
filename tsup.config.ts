import { defineConfig } from 'tsup';
import fs from 'node:fs';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'cli/index': 'src/cli/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  shims: true,
  onSuccess: async () => {
    try {
      fs.chmodSync('dist/cli/index.js', 0o755);
      fs.chmodSync('dist/cli/index.cjs', 0o755);
    } catch {
      // Ignore if chmod fails (e.g. non-posix)
    }
  }
});
