# 2026-11-03 桌面配色刷新验证

## 范围

- 仅调整共享主题 token、六套壁纸色板、App SVG 色板、启动前绘制色板和相关颜色回归断言。
- 布局尺寸、窗口几何、App 顺序、交互、功能、权限、依赖与真实能力边界未改。
- 颜色方向：石墨/雾灰基底、低饱和暮紫主操作、鼠尾草与暖色状态点缀；避免原先大面积蓝绿。

## 验证

- pnpm verify：通过；扩展单测 539 passed / 3 skipped，兼容包 Node 184 passed、Rust 5 passed，lint、类型、构建、边界与依赖检查通过。
- 系统 Chrome 156.0.8078.74、隔离 Profile、sRGB：colorPalette.spec.ts、appTheme.spec.ts、glassVisual.spec.ts、startupAppearance.spec.ts 共 18 passed。
- 颜色单测 56 passed：包括对比度、色板中性范围、React/启动前绘制色板一致性与主题所有权。
- 覆盖 1440、1024、390 CSS px；桌面、下载 App、表单、启动器截图已生成。颜色前后 geometry 证据文件保留在 artifacts/palette-geometry-before.json 与 artifacts/palette-geometry-after.json；截图是忽略的可重建产物。
- 自动化证明颜色生效、回退和功能未受影响，不替代维护者常用 Profile 的审美、触控和实际 200% 缩放确认；继续按 [TD-002](../../TECH_DEBT.md#td-002全局兼容样式的局部化迁移) 跟进。
