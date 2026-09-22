import type { AccountCatalogEntry, PageContext } from "../shared/types";
import type { VaultAccount, VaultApp, VaultConnectionState } from "../shared/vault";
import { vaultTargetMatches } from "../shared/url";
import { send } from "./bridge";
import { button, errorText, textElement } from "./dom";

export class CurrentPageAccountEditor {
  constructor(
    private readonly container: HTMLElement,
    private readonly reportStatus: (text: string, isError?: boolean) => void,
    private readonly refresh: () => Promise<void>,
    private readonly openSettings: () => void,
  ) {}

  async render(context: PageContext, entries: AccountCatalogEntry[], connectionStates?: VaultConnectionState[]): Promise<void> {
    const states = connectionStates ?? await send<VaultConnectionState[]>({ type: "listVaultConnectionStates" });
    this.container.replaceChildren();
    const profiles = states.filter((state) => state.connected);
    const disconnected = states.filter((state) => !state.connected);
    if (!profiles.length) {
      this.renderReconnectState(disconnected);
      return;
    }
    const panel = document.createElement("section");
    panel.className = "current-page-add";
    const heading = document.createElement("div");
    heading.className = "current-page-add-heading";
    const icon = document.createElement("span");
    icon.className = "current-page-add-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 8.5h14v10H5zM8 8.5V6h8v2.5M9 12h6" /><path d="M9 15h6" /></svg>';
    const copy = document.createElement("div");
    copy.className = "current-page-add-copy";
    copy.append(textElement("span", "current-page-add-eyebrow", "WEB DAV"));
    copy.append(textElement("strong", "current-page-add-title", "这个页面还没有保存账号"));
    const connection = button("保存", "current-page-add-save");
    connection.type = "submit";
    heading.append(icon, copy, connection);
    panel.append(heading);

    const form = document.createElement("form");
    form.className = "current-page-add-form";
    form.id = "currentPageAddForm";
    connection.setAttribute("form", form.id);
    const vault = document.createElement("select");
    vault.hidden = true;
    vault.tabIndex = -1;
    vault.setAttribute("aria-hidden", "true");
    for (const profile of profiles) vault.add(new Option(profile.name, profile.vaultId));
    const vaultPicker = document.createElement("div");
    vaultPicker.className = "current-page-vault-picker";
    const vaultSelection = document.createElement("button");
    vaultSelection.type = "button";
    vaultSelection.setAttribute("role", "combobox");
    vaultSelection.setAttribute("aria-haspopup", "listbox");
    vaultSelection.setAttribute("aria-expanded", "false");
    const vaultSelectionText = document.createElement("span");
    const vaultPickerIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    vaultPickerIcon.setAttribute("viewBox", "0 0 24 24");
    vaultPickerIcon.setAttribute("aria-hidden", "true");
    vaultPickerIcon.innerHTML = '<path d="m7 10 5 5 5-5" />';
    vaultSelection.append(vaultSelectionText, vaultPickerIcon);
    const vaultMenu = document.createElement("div");
    vaultMenu.className = "current-page-vault-menu";
    vaultMenu.setAttribute("role", "listbox");
    vaultMenu.hidden = true;
    vaultPicker.append(vault, vaultSelection, vaultMenu);
    const destination = textElement("p", "current-page-add-destination", "");
    const username = this.input("账号", "text", "例如：name@example.com", "username");
    const password = this.input("密码", "password", "填写要保存的密码", "new-password");
    const remark = this.input("备注（可选）", "text", "例如：工作账号", "off", false);
    const vaultLabel = this.label("保存到", vaultPicker);
    form.append(vaultLabel, destination, username.label, password.label, remark.label);
    const updateDestination = (): void => {
      const existing = this.matchingVaultApp(entries, context.url, vault.value);
      destination.textContent = existing ? `将添加到已有的“${existing.appName}”` : `将创建“${new URL(context.url).hostname}”并保存账号`;
    };
    const renderVaultOptions = (): void => {
      vaultMenu.replaceChildren(...profiles.map((profile) => {
        const option = document.createElement("button");
        option.type = "button";
        option.dataset.vaultId = profile.vaultId;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(profile.vaultId === vault.value));
        option.textContent = profile.name;
        return option;
      }));
    };
    const closeVaultPicker = (): void => {
      vaultMenu.hidden = true;
      vaultSelection.setAttribute("aria-expanded", "false");
    };
    const selectVault = (vaultId: string): void => {
      vault.value = vaultId;
      vaultSelectionText.textContent = profiles.find((profile) => profile.vaultId === vaultId)?.name ?? "选择密码库";
      renderVaultOptions();
      closeVaultPicker();
      updateDestination();
    };
    renderVaultOptions();
    selectVault(vault.value);
    vaultSelection.addEventListener("click", () => {
      if (vaultMenu.hidden) {
        renderVaultOptions();
        vaultMenu.hidden = false;
        vaultSelection.setAttribute("aria-expanded", "true");
      } else {
        closeVaultPicker();
      }
    });
    vaultSelection.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeVaultPicker();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        vaultMenu.hidden = false;
        vaultSelection.setAttribute("aria-expanded", "true");
        [...vaultMenu.querySelectorAll<HTMLButtonElement>("button")].find((option) => option.dataset.vaultId === vault.value)?.focus();
      }
    });
    vaultMenu.addEventListener("click", (event) => {
      const option = (event.target as Element).closest<HTMLButtonElement>("[data-vault-id]");
      if (option?.dataset.vaultId) selectVault(option.dataset.vaultId);
    });
    form.addEventListener("pointerdown", (event) => {
      if (!event.composedPath().includes(vaultPicker)) closeVaultPicker();
    });
    vault.addEventListener("change", updateDestination);
    updateDestination();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      void this.save({ context, entries, vaultId: vault.value, username: username.input, password: password.input, remark: remark.input, submit: connection });
    });
    panel.append(form);
    this.container.append(panel);
  }

  private renderReconnectState(states: VaultConnectionState[]): void {
    const panel = document.createElement("section");
    panel.className = "current-page-add current-page-reconnect";
    const heading = document.createElement("div");
    heading.className = "current-page-add-heading";
    const icon = document.createElement("span");
    icon.className = "current-page-add-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2M5 10h14v10H5z" /><path d="M12 14v2" /></svg>';
    const copy = document.createElement("div");
    copy.className = "current-page-add-copy";
    copy.append(textElement("span", "current-page-add-eyebrow", "WEB DAV"));
    copy.append(textElement("strong", "current-page-add-title", "账号仍在密码库中，需要重新连接"));
    heading.append(icon, copy);
    panel.append(heading);
    panel.append(textElement("p", "current-page-add-help", states.length ? "本机长期保存的 WebDAV 连接材料不可用或已被清除，请重新输入连接信息后读取账号。" : "当前没有可用的 WebDAV 密码库连接。"));
    const actions = document.createElement("div");
    actions.className = "current-page-reconnect-actions";
    if (!states.length) {
      const connect = button("添加 WebDAV 连接", "current-page-reconnect-button");
      connect.addEventListener("click", this.openSettings);
      actions.append(connect);
    }
    for (const state of states) {
      const reconnect = button(`重新连接 ${state.name}`, "current-page-reconnect-button");
      reconnect.addEventListener("click", () => window.dispatchEvent(new CustomEvent("unipass-open-webdav-settings", { detail: { vaultId: state.vaultId } })));
      actions.append(reconnect);
    }
    panel.append(actions);
    this.container.append(panel);
  }

  private input(label: string, type: string, placeholder: string, autocomplete: string, required = true): { label: HTMLLabelElement; input: HTMLInputElement } {
    const input = document.createElement("input");
    input.type = type;
    input.placeholder = placeholder;
    input.setAttribute("autocomplete", autocomplete);
    input.required = required;
    return { label: this.label(label, input), input };
  }

  private label(text: string, control: HTMLElement): HTMLLabelElement {
    const label = document.createElement("label");
    label.textContent = text;
    label.append(control);
    return label;
  }

  private matchingVaultApp(entries: AccountCatalogEntry[], url: string, vaultId: string): AccountCatalogEntry | undefined {
    return entries.find((entry) => entry.vaultId === vaultId && Boolean(entry.targets?.some((target) => vaultTargetMatches(target, url))));
  }

  private async save({
    context, entries, vaultId, username, password, remark, submit,
  }: {
    context: PageContext;
    entries: AccountCatalogEntry[];
    vaultId: string;
    username: HTMLInputElement;
    password: HTMLInputElement;
    remark: HTMLInputElement;
    submit: HTMLButtonElement;
  }): Promise<void> {
    submit.disabled = true;
    try {
      const current = new URL(context.url);
      if (current.port) throw new Error("暂不支持非默认端口的应用，请勿在此保存账号");
      let app = this.matchingVaultApp(entries, context.url, vaultId);
      if (!app) {
        const created = await send<VaultApp>({
          type: "createVaultApp",
          vaultId,
          app: { name: current.hostname, targets: [{ scheme: "https", host: current.hostname }] },
        });
        app = { appId: created.id, appName: created.name, appUrl: context.url, accounts: [], vaultId, targets: created.targets };
      }
      await send<VaultAccount>({
        type: "createVaultAccount",
        vaultId,
        account: { appId: String(app.appId), username: username.value.trim(), password: password.value, remark: remark.value.trim() || undefined },
      });
      password.value = "";
      this.reportStatus("当前页面账号已保存");
      await this.refresh();
    } catch (error) {
      this.reportStatus(errorText(error), true);
    } finally {
      submit.disabled = false;
    }
  }
}
