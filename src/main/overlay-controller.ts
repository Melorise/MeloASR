import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import type { Point, SessionState } from '../shared/contracts';
import { clampPosition, presetPosition } from './overlay-position';
import type { SettingsStore } from './settings-store';

const SIZE = { width: 88, height: 88 };

export class OverlayController {
  window: BrowserWindow | null = null;
  private hideTimer: NodeJS.Timeout | null = null;

  constructor(private readonly settings: SettingsStore) {}

  async create(): Promise<void> {
    this.window = new BrowserWindow({
      ...SIZE,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'overlay.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false
      }
    });
    this.window.setAlwaysOnTop(true, 'floating');
    await this.window.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'));
    this.position();
    this.reconcilePersistent();
  }

  position(point = this.settings.get().overlayPosition): Point {
    const initial = point ?? presetPosition(screen.getPrimaryDisplay().workArea, SIZE, 'bottom-center');
    const display = screen.getDisplayNearestPoint(initial);
    const result = clampPosition(initial, display.workArea, SIZE);
    this.window?.setPosition(result.x, result.y, false);
    if (!point) this.settings.update({ overlayPosition: result });
    return result;
  }

  applyPosition(point: Point, displayId?: string): Point {
    const display = screen.getAllDisplays().find((item) => String(item.id) === String(displayId)) ??
      screen.getDisplayNearestPoint(point);
    const result = clampPosition(point, display.workArea, SIZE);
    this.settings.update({ overlayPosition: result });
    this.window?.setPosition(result.x, result.y, false);
    return result;
  }

  applyPreset(preset: string, displayId?: string): Point {
    const display = screen.getAllDisplays().find((item) => String(item.id) === String(displayId)) ??
      screen.getPrimaryDisplay();
    return this.applyPosition(presetPosition(display.workArea, SIZE, preset), String(display.id));
  }

  showState(state: SessionState | 'done' | 'error'): void {
    if (!this.window || this.window.isDestroyed()) return;
    this.clearHideTimer();
    this.window.webContents.send('overlay-state', { state });
    if (!this.window.isVisible()) this.window.showInactive();
  }

  hideLater(delay = 900): void {
    this.clearHideTimer();
    if (this.settings.get().overlayPersistent) return;
    this.hideTimer = setTimeout(() => this.window?.hide(), delay);
  }

  preview(): void {
    this.position();
    this.showState('recording');
    this.hideLater(1800);
  }

  reconcilePersistent(): void {
    if (!this.window || this.window.isDestroyed()) return;
    if (this.settings.get().overlayPersistent) {
      this.showState('idle');
    } else {
      this.window.hide();
    }
  }

  private clearHideTimer(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }
}
