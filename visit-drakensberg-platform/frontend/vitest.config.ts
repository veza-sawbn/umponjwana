import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  // Next compiles JSX itself (tsconfig "jsx": "preserve"); tests that render
  // a component need esbuild to do it.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
