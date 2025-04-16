import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  experimentalDts: true,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  skipNodeModulesBundle: true,
  noExternal: ['js-yaml'],
  tsconfig: 'src/tsconfig.json',
});
