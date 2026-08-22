import type { Point, SettingsViewState } from '../shared/contracts';

declare global {
  interface Window {
    meloSettings: {
      getState(): Promise<SettingsViewState>;
      setBackend(id: string): Promise<SettingsViewState>;
      openDebug(): Promise<void>;
      setPosition(position: Point, displayId: string): Promise<SettingsViewState>;
      setPreset(preset: string, displayId: string): Promise<SettingsViewState>;
      previewOverlay(): Promise<void>;
      setShortcut(shortcut: string): Promise<SettingsViewState>;
      setAutoStart(enabled: boolean): Promise<SettingsViewState>;
      setOverlayPersistent(enabled: boolean): Promise<SettingsViewState>;
      openRepository(): Promise<void>;
      onState(listener: (state: SettingsViewState) => void): void;
    };
    meloOverlay: {
      toggleRecording(): void;
      onState(listener: (state: string) => void): void;
    };
  }
}

export {};
