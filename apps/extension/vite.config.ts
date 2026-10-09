import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      'unas-src': path.resolve(import.meta.dirname, 'src'),
      '#contracts': path.resolve(import.meta.dirname, 'contracts/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  build: {
    // Lightning CSS drops standard backdrop-filter when followed by its prefix.
    cssMinify: 'esbuild',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
})
