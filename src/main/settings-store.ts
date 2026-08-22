import { app } from 'electron';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import type { AppSettings } from '../shared/contracts';

const DEFAULT_SETTINGS: AppSettings = {
  backendId: 'qianwen',
  shortcut: 'Control+Shift+space',
  autoStart: true,
  overlayPersistent: false,
  overlayPosition: null,
  loginNoticeShown: {}
};

export class SettingsStore extends EventEmitter {
  private value: AppSettings = structuredClone(DEFAULT_SETTINGS);
  private readonly filePath = path.join(app.getPath('userData'), 'settings.json');

  load(): AppSettings {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<AppSettings> & {
        backend?: string;
      };
      this.value = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        backendId: parsed.backendId ?? parsed.backend ?? DEFAULT_SETTINGS.backendId,
        overlayPosition: this.isPoint(parsed.overlayPosition) ? {
          x: Math.round(parsed.overlayPosition.x), y: Math.round(parsed.overlayPosition.y)
        } : null,
        loginNoticeShown: parsed.loginNoticeShown ?? {}
      };
    } catch {
      this.value = structuredClone(DEFAULT_SETTINGS);
    }
    return this.get();
  }

  get(): AppSettings {
    return structuredClone(this.value);
  }

  update(patch: Partial<AppSettings>): AppSettings {
    this.value = { ...this.value, ...patch };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(this.value, null, 2)}\n`, { mode: 0o600 });
    this.emit('changed', this.get());
    return this.get();
  }

  private isPoint(value: unknown): value is { x: number; y: number } {
    return typeof value === 'object' && value !== null &&
      Number.isFinite((value as { x?: number }).x) && Number.isFinite((value as { y?: number }).y);
  }
}
