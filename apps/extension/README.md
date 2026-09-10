# uNAS 前端 Demo

这是 uNAS 的独立 React/Vite 前端演示。桌面、下载、转码、PSD 与工具任务仍使用浏览器内置的 demo adapter；解包扩展中的文件管理另有一条受用户目录授权保护的真实 ZIP 解压路径。

它不会连接、启动或调用任何后端 API、Electron 能力、yt-dlp、ffmpeg 或 Photoshop。除已授权目录的受限 ZIP 解压外，界面中的任务、文件、下载、转码与系统指标均是 mock，不代表真实能力。Vite 页面成功也不代表 MV3 运行面已验收。

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
