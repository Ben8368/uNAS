import { send } from './bridge';
import { errorText, get } from './dom';
/** The overlay only links to project settings; it never receives shared authentication. */
export class WebDavSettingsController {
  private readonly openButton = get<HTMLButtonElement>('openSharedWebDav');
  constructor(private readonly reportStatus: (text: string, isError?: boolean) => void) {}
  bind(): void { this.openButton.addEventListener('click', () => { void send<void>({ type: 'openWebDavSettings' }).catch(error => this.reportStatus(errorText(error), true)); }); }
  async open(_vaultId?: string): Promise<void> { /* Configuration lives in the top-level Settings App. */ }
  setDisabled(disabled: boolean): void { this.openButton.disabled = disabled; }
  clearSensitiveState(): void { /* No secrets are held in this view. */ }
}
