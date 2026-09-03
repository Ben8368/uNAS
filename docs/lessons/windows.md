# Windows 开发经验

- W-001：PowerShell 读取中文显式使用 `-Encoding UTF8`，仓库文本统一 UTF-8 与 LF。
- W-002：路径传递使用参数数组或结构化 API，不拼接 shell 字符串；盘符、UNC、保留名和长路径需单独测试。
- W-003：不要把 `$HOME`、`$env:USERPROFILE` 或工作区根作为递归删除、移动或清理目标。
- W-004：浏览器文件句柄和 Web 路径不是 Windows 物理路径；共享 contract 不暴露本机绝对路径。
