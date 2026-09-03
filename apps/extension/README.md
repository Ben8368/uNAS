# uNAS 前端 Demo

这是 uNAS 的独立 React/Vite 前端演示。它保留桌面、应用窗口、文件管理、下载、转码和 PSD 等界面与静态素材，但所有交互数据都来自浏览器内置的 demo adapter。

它不会连接、启动或调用任何后端 API、Worker、Electron 能力、yt-dlp、ffmpeg、Photoshop 或本机文件系统。界面中的任务、文件、下载、转码与系统指标均是 mock，不代表真实能力。

## 运行

需要 Node.js 22 或更高版本：

```bash
pnpm install
pnpm dev:demo
```

打开终端显示的地址（默认 `http://localhost:5173`）。构建演示产物：

```bash
pnpm build:demo
pnpm --filter @unas/extension-demo run preview
```

`src/api/bootstrap.ts` 固定绑定 `demoApi`；`src/api/demo.ts` 是所有交互使用的本地演示数据实现。为保持离线首屏，HTML 不加载远程字体。

不要直接在浏览器中打开 `index.html` 的 `file://` 路径；浏览器不能编译其中的 TypeScript 模块。要构建可解包 Chrome 扩展，请在仓库根目录运行：

```bash
pnpm -w run build:extension
```

然后在 Chrome 的扩展管理页加载 `apps/extension/.output/chrome-mv3/`。
