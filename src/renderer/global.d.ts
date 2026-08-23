import type { Point, SettingsViewState } from '../shared/contracts';

declare global {
  interface Window {
    meloSettings: {
      getState(): Promise<SettingsViewState>;
      setBackend(id: string): Promise<SettingsViewState>;
      openDebug(confirmed?: boolean): Promise<void>;
      setPosition(position: Point, displayId: string): Promise<SettingsViewState>;
      setPreset(preset: string, displayId: string): Promise<SettingsViewState>;
      beginPositioning(): Promise<void>;
      endPositioning(): Promise<void>;
      setShortcut(shortcut: string): Promise<SettingsViewState>;
      setAutoStart(enabled: boolean): Promise<SettingsViewState>;
      setDiagnosticLogging(enabled: boolean): Promise<SettingsViewState>;
      openRepository(): Promise<void>;
      onState(listener: (state: SettingsViewState) => void): void;
      onLoginNotice(listener: (backendLabel: string) => void): void;
    };
    meloOverlay: {
      onState(listener: (state: string) => void): void;
    };
  }
}

export {};
