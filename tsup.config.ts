import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  experimentalDts: false,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  skipNodeModulesBundle: true,
  noExternal: ['js-yaml'],
  tsconfig: 'tsconfig.json',
});
