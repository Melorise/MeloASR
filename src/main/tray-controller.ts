import { Menu, Tray, nativeImage } from 'electron';
import type { BackendManager } from './backend-manager';
import type { SettingsWindow } from './settings-window';

type TrayState = 'loading' | 'ready' | 'login-required' | 'error';

const COLORS: Record<TrayState, string> = {
  loading: '#e6a23c',
  ready: '#22b573',
  'login-required': '#ef6c57',
  error: '#d9465f'
};

function trayImage(state: TrayState): Electron.NativeImage {
  const color = COLORS[state];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="14" fill="${color}"/>
    <path d="M8 19v-6h3v6zm5 4V9h3v14zm5-2V11h3v10zm5-3v-4h3v4z" fill="white"/>
  </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`).resize({ width: 22, height: 22 });
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
      { label: '打开登录/调试页面', click: () => void this.backends.showDebug() },
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
