import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'wxt'

export default defineConfig({
  manifest: {
    name: 'uNAS Demo',
    description: 'uNAS 的本地 mock 前端演示；不接入文件、任务或后端能力。',
    version: '0.3.0',
    minimum_chrome_version: '148',
    action: { default_title: '打开 uNAS' },
  },
  vite: () => ({
    plugins: [react()],
    resolve: {
      // Avoid WXT's reserved aliases when resolving the migrated Vite source.
      alias: [
        { find: '#contracts', replacement: path.resolve(__dirname, 'contracts/index.ts') },
        { find: 'unas-src', replacement: path.resolve(__dirname, 'src') },
      ],
    },
  }),
})
