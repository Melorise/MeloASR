import { contextBridge, ipcRenderer } from 'electron';
import type { Point, SettingsViewState } from '../shared/contracts';

contextBridge.exposeInMainWorld('meloSettings', {
  getState: (): Promise<SettingsViewState> => ipcRenderer.invoke('settings:get-state'),
  setBackend: (id: string): Promise<SettingsViewState> => ipcRenderer.invoke('settings:set-backend', id),
  openDebug: (): Promise<void> => ipcRenderer.invoke('settings:open-debug'),
  setPosition: (position: Point, displayId: string): Promise<SettingsViewState> =>
    ipcRenderer.invoke('settings:set-position', position, displayId),
  setPreset: (preset: string, displayId: string): Promise<SettingsViewState> =>
    ipcRenderer.invoke('settings:set-preset', preset, displayId),
  previewOverlay: (): Promise<void> => ipcRenderer.invoke('settings:preview-overlay'),
  setShortcut: (shortcut: string): Promise<SettingsViewState> => ipcRenderer.invoke('settings:set-shortcut', shortcut),
  setAutoStart: (enabled: boolean): Promise<SettingsViewState> => ipcRenderer.invoke('settings:set-auto-start', enabled),
  setOverlayPersistent: (enabled: boolean): Promise<SettingsViewState> =>
    ipcRenderer.invoke('settings:set-overlay-persistent', enabled),
  openRepository: (): Promise<void> => ipcRenderer.invoke('settings:open-repository'),
  onState: (listener: (state: SettingsViewState) => void): void => {
    ipcRenderer.on('settings:state', (_event, state: SettingsViewState) => listener(state));
  }
});
