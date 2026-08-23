import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('meloOverlay', {
  onState: (listener: (state: string) => void): void => {
    ipcRenderer.on('overlay-state', (_event, payload: { state: string }) => listener(payload.state));
  }
});
