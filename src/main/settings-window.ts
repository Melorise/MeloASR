import { app, BrowserWindow, screen, shell } from 'electron';
import path from 'node:path';
import type { SettingsViewState } from '../shared/contracts';
import type { BackendManager } from './backend-manager';
import { resolveDebugLoginAction } from './debug-login-flow';
import type { OverlayController } from './overlay-controller';
import type { SessionController } from './session-controller';
import type { SettingsStore } from './settings-store';

export class SettingsWindow {
  window: BrowserWindow | null = null;

  constructor(
    private readonly settings: SettingsStore,
    private readonly backends: BackendManager,
    private readonly overlay: OverlayController,
    private readonly sessions: SessionController,
    private readonly repositoryUrl: string | null
  ) {}

  async create(): Promise<void> {
    this.window = new BrowserWindow({
      width: 720,
      height: 820,
      minWidth: 640,
      minHeight: 680,
      show: false,
      title: 'MeloASR 设置',
      autoHideMenuBar: true,
      icon: path.join(app.getAppPath(), 'dist', 'assets', 'logo.png'),
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'settings.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    this.window.on('close', (event) => {
      if ((app as typeof app & { isQuitting?: boolean }).isQuitting) return;
      event.preventDefault();
      this.window?.hide();
    });
    this.window.on('hide', () => this.overlay.endPositioning());
    await this.window.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  }

  show(): void {
    this.window?.show();
    this.window?.focus();
    this.publish();
  }

  publish(): void {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.webContents.send('settings:state', this.state());
  }

  async openDebug(confirmed = false): Promise<void> {
    const current = this.settings.get();
    const definition = this.backends.activeDefinition();
    const decision = resolveDebugLoginAction(Boolean(current.loginNoticeShown[definition.id]), confirmed);
    if (decision.action === 'prompt') {
      this.show();
      this.window?.webContents.send('settings:login-notice', { backendLabel: definition.label });
      return;
    }
    if (decision.markShown) {
      this.settings.update({
        loginNoticeShown: { ...current.loginNoticeShown, [definition.id]: true }
      });
    }
    await this.backends.showDebug(definition.id);
  }

  state(): SettingsViewState {
    const current = this.settings.get();
    const position = this.overlay.position(current.overlayPosition);
    return {
      backendId: current.backendId,
      backends: this.backends.definitions().map(({ id, label }) => ({ id, label, status: this.backends.status(id) })),
      sessionState: this.sessions.state,
      shortcut: current.shortcut,
      autoStart: current.autoStart,
      overlayPersistent: current.overlayPersistent,
      diagnosticLogging: current.diagnosticLogging,
      overlayPosition: position,
      displays: screen.getAllDisplays().map((display, index) => ({
        id: String(display.id),
        label: `屏幕 ${index + 1}（${display.workArea.width} × ${display.workArea.height}）`,
        workArea: display.workArea
      })),
      version: app.getVersion(),
      repositoryUrl: this.repositoryUrl
    };
  }

  async openRepository(): Promise<void> {
    if (!this.repositoryUrl) throw new Error('尚未配置项目仓库地址');
    await shell.openExternal(this.repositoryUrl);
  }
}
