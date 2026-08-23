import { app, Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';
import type { BackendManager } from './backend-manager';
import type { SettingsWindow } from './settings-window';

type TrayState = 'loading' | 'ready' | 'login-required' | 'error';

const ICONS: Record<TrayState, string> = {
  loading: 'tray-loading.png',
  ready: 'tray-ready.png',
  'login-required': 'tray-login-required.png',
  error: 'tray-error.png'
};

function trayImage(state: TrayState): Electron.NativeImage {
  const image = nativeImage.createFromPath(path.join(app.getAppPath(), 'dist', 'assets', ICONS[state]));
  image.setTemplateImage(false);
  return image;
}

export class TrayController {
  private tray: Tray | null = null;

  constructor(
    private readonly backends: BackendManager,
    private readonly settingsWindow: SettingsWindow,
    private readonly onRestart: () => void,
    private readonly onQuit: () => void
  ) {}

  create(): void {
    this.tray = new Tray(trayImage('loading'));
    this.tray.setToolTip('MeloASR · 正在加载');
    this.tray.on('click', () => this.settingsWindow.show());
    this.refresh();
  }

  refresh(): void {
    if (!this.tray) return;
    const status = this.backends.status(this.backends.activeDefinition().id);
    const state: TrayState = status.ready ? 'ready'
      : status.login === 'logged-out' ? 'login-required'
        : status.detail.startsWith('加载失败') ? 'error' : 'loading';
    this.tray.setImage(trayImage(state));
    this.tray.setToolTip(`MeloASR · ${status.detail}`);
    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: '设置', click: () => this.settingsWindow.show() },
      { label: '打开登录/调试页面', click: () => void this.settingsWindow.openDebug() },
      { type: 'separator' },
      { label: '重启', click: this.onRestart },
      { label: '退出', click: this.onQuit }
    ]));
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
