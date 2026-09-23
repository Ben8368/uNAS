export function normalizeWebDavUrl(value: string): string {
  const requested = value.trim();
  if (!requested) throw new Error("WebDAV 地址不能为空");
  let url: URL;
  try {
    url = new URL(requested);
  } catch {
    throw new Error("WebDAV 地址格式无效");
  }
  if (url.protocol !== "https:") throw new Error("为保护凭据安全，WebDAV 仅支持 HTTPS 地址");
  if (!url.hostname || url.username || url.password || url.search || url.hash) {
    throw new Error("WebDAV 地址只能包含 HTTPS 主机和路径");
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url.toString();
}

export function webDavPermissionOrigin(value: string): string {
  const url = new URL(normalizeWebDavUrl(value));
  return `${url.origin}/*`;
}
