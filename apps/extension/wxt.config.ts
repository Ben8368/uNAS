import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'wxt'

export default defineConfig({
  manifest: {
    name: 'uNAS Demo',
    description: 'uNAS 本地优先工作区：文件管理仅在用户授权后只读列出目录；下载复用浏览器默认下载位置，其他工具仍为 mock 演示。',
    version: '0.3.0',
    minimum_chrome_version: '148',
    permissions: ['storage'],
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
