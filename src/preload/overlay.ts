import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('meloOverlay', {
  toggleRecording: (): void => ipcRenderer.send('overlay:toggle-recording'),
  onState: (listener: (state: string) => void): void => {
    ipcRenderer.on('overlay-state', (_event, payload: { state: string }) => listener(payload.state));
  }
});
