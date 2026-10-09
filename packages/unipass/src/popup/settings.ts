import type { PluginVersionSettings } from "../shared/types";
import { send } from "./bridge";
import { errorText, get } from "./dom";
import type { DomStorage } from "./dom";
import { ThemeController, type Theme } from "./theme-controller";
import { WebDavSettingsController } from "./webdav-settings";
import { BrowserPasswordImportController } from "./import-passwords";

export function normalizeWebDavUrl(value: string): string {
  const requestedUrl = value.trim();
  if (!requestedUrl) return "";
  let url: URL;
  try {
    url = new URL(requestedUrl);
  } catch {
    throw new Error("WebDAV 地址格式无效");
  }
  if (url.protocol !== "https:") throw new Error("为保护凭据安全，WebDAV 仅支持 HTTPS 地址");
  if (!url.hostname || url.username || url.password || url.search || url.hash) {
    throw new Error("WebDAV 地址只能包含 HTTPS 主机和路径");
  }
  return url.toString();
}

export class SettingsController {
  private readonly dialog = get("versionSettingsDialog");
  private readonly settingsButton = get<HTMLButtonElement>("pluginVersionSettingsButton");
  private readonly closeButton = get<HTMLButtonElement>("closeVersionSettings");
  private readonly versionForm = get<HTMLFormElement>("versionForm");
  private readonly override = get<HTMLInputElement>("pluginVersionOverride");
  private readonly saveButton = get<HTMLButtonElement>("versionSave");
  private readonly restoreBaseline = get<HTMLButtonElement>("restorePluginVersionBaseline");
  private readonly localBuildVersion = get("localBuildPluginVersion");
  private readonly localBuildTime = get("localBuildTime");
  private readonly networkVersion = get("networkPluginVersion");
  private readonly networkVersionSource = get("networkPluginVersionSource");
  private saveControlsDisabled = false;
  private disposed = false;
  private readonly webdavSettings: WebDavSettingsController;
  private readonly theme: ThemeController;
  private readonly browserImport: BrowserPasswordImportController;

  constructor(
    private readonly reportStatus: (text: string, isError?: boolean) => void,
    private readonly storage: DomStorage = window.localStorage,
    private readonly themeTarget: HTMLElement = document.documentElement,
  ) {
    this.webdavSettings = new WebDavSettingsController(reportStatus);
    this.browserImport = new BrowserPasswordImportController(reportStatus);
    this.theme = new ThemeController(storage, themeTarget);
  }

  bind(): void {
    this.theme.bind();
    this.settingsButton.addEventListener("click", () => void this.open());
    this.closeButton.addEventListener("click", () => this.close());
    this.versionForm.addEventListener("submit", (event) => { event.preventDefault(); void this.saveOverride(); });
    this.webdavSettings.bind();
    this.browserImport.bind();
    window.addEventListener("unipass-open-webdav-settings", (event) => {
      const vaultId = event instanceof CustomEvent && typeof event.detail?.vaultId === "string" ? event.detail.vaultId : undefined;
      void this.open(vaultId);
    });
    this.override.addEventListener("input", () => this.updateRestoreButton());
    this.restoreBaseline.addEventListener("click", () => {
      this.override.value = "";
      this.updateRestoreButton();
      void this.saveOverride(true);
    });
    this.dialog.addEventListener("click", (event) => { if (event.target === this.dialog) this.close(); });
    window.addEventListener("pagehide", () => this.dispose());
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!this.dialog.classList.contains("hidden")) this.close();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.webdavSettings.clearSensitiveState();
    this.browserImport.dispose();
  }

  applyAutoTheme(theme: Theme): void {
    this.theme.applyAutoTheme(theme);
  }

  private async open(vaultId?: string): Promise<void> {
    this.localBuildVersion.textContent = "检查中";
    const manifest = chrome.runtime.getManifest();
    this.localBuildTime.textContent = manifest.version_name || "无构建描述";
    this.networkVersion.textContent = "检查中";
    this.networkVersionSource.textContent = "";
    await this.webdavSettings.open(vaultId);
    if (this.disposed) return;
    this.dialog.classList.remove("hidden");
    this.settingsButton.setAttribute("aria-expanded", "true");
    this.closeButton.focus();
    try {
      this.apply(await send<PluginVersionSettings>({ type: "getPluginVersionSettings" }));
    } catch (error) {
      this.localBuildVersion.textContent = "无法读取";
      this.networkVersion.textContent = "无法读取";
      this.networkVersionSource.textContent = "";
      this.reportStatus(errorText(error), true);
    }
  }

  private close(): void {
    this.webdavSettings.clearSensitiveState();
    this.dialog.classList.add("hidden");
    this.settingsButton.setAttribute("aria-expanded", "false");
    this.settingsButton.focus();
  }

  private apply(settings: PluginVersionSettings): void {
    this.override.value = settings.override;
    this.localBuildVersion.textContent = settings.localBuildVersion;
    this.networkVersion.textContent = settings.networkVersion;
    this.networkVersionSource.textContent = settings.source === "manual"
      ? `手动指定（内置基线 ${settings.storeBaselineVersion}）`
      : "构建内置网络基线（构建时生成）";
    this.updateRestoreButton();
  }

  private async saveOverride(keepControlsEnabled = false): Promise<void> {
    if (!keepControlsEnabled) this.setSaveControlsDisabled(true);
    try {
      const settings = await send<PluginVersionSettings>({
        type: "setPluginVersionOverride",
        version: this.override.value,
      });
      this.apply(settings);
      this.reportStatus("版本设置已保存");
    } catch (error) {
      this.reportStatus(errorText(error), true);
    } finally {
      if (!keepControlsEnabled) this.setSaveControlsDisabled(false);
    }
  }

  private setSaveControlsDisabled(disabled: boolean): void {
    this.saveControlsDisabled = disabled;
    this.saveButton.disabled = disabled;
    this.webdavSettings.setDisabled(disabled);
    this.override.disabled = disabled;
    this.updateRestoreButton();
  }

  private updateRestoreButton(): void {
    this.restoreBaseline.textContent = "恢复默认";
    this.restoreBaseline.disabled = this.saveControlsDisabled || !this.override.value.trim();
  }

}
