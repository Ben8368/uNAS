import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'wxt'

export default defineConfig({
  manifest: {
    name: 'uNAS',
    description: 'uNAS 本地优先工作区，提供广告与追踪拦截、WebDAV 加密密码库和页面凭据浮层。',
    version: '0.4.0',
    minimum_chrome_version: '148',
    permissions: [
      'activeTab',
      'scripting',
      'clipboardWrite',
      'storage',
      'alarms',
      'tabs',
      'declarativeNetRequest',
      'downloads',
    ],
    host_permissions: [
      'https://portal.unipass.top/*',
      'https://accounts.feishu.cn/*',
      'https://jupiter.tec-do.com/*',
      'https://easylist-downloads.adblockplus.org/*',
      'https://raw.githubusercontent.com/*',
    ],
    optional_host_permissions: ['https://*/*'],
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    declarative_net_request: {
      rule_resources: [{ id: 'baseline', enabled: true, path: 'rules/baseline.json' }],
    },
    action: {
      default_title: 'uNAS 密码浮层',
      default_icon: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    web_accessible_resources: [{
      resources: ['icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png'],
      matches: ['https://*/*'],
    }],
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
