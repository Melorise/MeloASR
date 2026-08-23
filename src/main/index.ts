import { app, ipcMain } from 'electron';
import { AutoStartService } from './auto-start-service';
import { BackendManager } from './backend-manager';
import { FcitxBridge } from './fcitx-bridge';
import { OverlayController } from './overlay-controller';
import { SessionController } from './session-controller';
import { SettingsStore } from './settings-store';
import { SettingsWindow } from './settings-window';
import { TrayController } from './tray-controller';
import type { BackendStatusPayload, Point } from '../shared/contracts';

app.setName('MeloASR');
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
const singleInstance = app.requestSingleInstanceLock();

if (!singleInstance) {
  app.quit();
} else {
  void app.whenReady().then(bootstrap).catch((error) => {
    console.error('[MeloASR 启动失败]', error);
    app.quit();
  });
}

async function bootstrap(): Promise<void> {
  const settings = new SettingsStore();
  const currentSettings = settings.load();
  const autoStart = new AutoStartService();
  try { autoStart.apply(currentSettings.autoStart); }
  catch (error) { console.error('[开机自启动设置失败]', error); }

  const bridge = new FcitxBridge();
  bridge.configure(currentSettings.shortcut, currentSettings.diagnosticLogging);
  const backends = new BackendManager(settings);
  const overlay = new OverlayController(settings);
  await overlay.create();
  const sessions = new SessionController(backends, bridge, overlay);
  const repositoryUrl = process.env.MELOASR_REPOSITORY_URL?.trim() ||
    'https://github.com/Melorise/MeloASR';
  const settingsWindow = new SettingsWindow(settings, backends, overlay, sessions, repositoryUrl);
  const settingsWindowReady = settingsWindow.create();
  registerIpc({ settings, autoStart, bridge, backends, overlay, sessions, settingsWindow });
  await settingsWindowReady;
  const tray = new TrayController(
    backends,
    settingsWindow,
    () => { app.relaunch(); app.exit(0); },
    () => app.quit()
  );
  tray.create();

  bridge.on('request-start', () => void sessions.start());
  bridge.on('request-stop', () => sessions.stop());
  bridge.on('request-cancel', () => sessions.cancel());
  bridge.on('disconnect', () => sessions.cancel('Fcitx5 插件连接已断开'));
  bridge.on('connect', () => settingsWindow.publish());
  bridge.on('protocol-error', (error) => console.error('[Fcitx5 协议错误]', error));
  bridge.on('client-error', (error) => console.error('[Fcitx5 客户端错误]', error));
  bridge.on('server-error', (error) => console.error('[Fcitx5 Socket 错误]', error));
  backends.on('status-changed', () => { tray.refresh(); settingsWindow.publish(); });
  backends.on('active-changed', () => { tray.refresh(); settingsWindow.publish(); });
  sessions.on('state-changed', () => settingsWindow.publish());
  settings.on('changed', () => settingsWindow.publish());

  await bridge.start();
  bridge.configure(settings.get().shortcut, settings.get().diagnosticLogging);
  await backends.ensure(settings.get().backendId);
  tray.refresh();

  app.on('second-instance', () => settingsWindow.show());
  app.on('before-quit', () => { (app as typeof app & { isQuitting?: boolean }).isQuitting = true; });
  app.on('will-quit', () => {
    tray.destroy();
    void bridge.stop();
  });
}

interface Services {
  settings: SettingsStore;
  autoStart: AutoStartService;
  bridge: FcitxBridge;
  backends: BackendManager;
  overlay: OverlayController;
  sessions: SessionController;
  settingsWindow: SettingsWindow;
}

function registerIpc(services: Services): void {
  const { settings, autoStart, bridge, backends, overlay, sessions, settingsWindow } = services;
  const settingsSender = (senderId: number): boolean =>
    Boolean(settingsWindow.window && !settingsWindow.window.isDestroyed() && settingsWindow.window.webContents.id === senderId);
  ipcMain.handle('settings:get-state', (event) => {
    if (!settingsSender(event.sender.id)) throw new Error('拒绝未授权的设置请求');
    return settingsWindow.state();
  });
  ipcMain.handle('settings:set-backend', async (event, id: unknown) => {
    if (!settingsSender(event.sender.id) || typeof id !== 'string') throw new Error('无效的后端设置');
    if (sessions.state !== 'idle') throw new Error('请先结束当前语音输入');
    await backends.select(id);
    return settingsWindow.state();
  });
  ipcMain.handle('settings:open-debug', async (event, confirmed: unknown) => {
    if (!settingsSender(event.sender.id)) throw new Error('拒绝未授权的窗口请求');
    await settingsWindow.openDebug(confirmed === true);
  });
  ipcMain.handle('settings:set-position', (event, point: Point, displayId: string) => {
    if (!settingsSender(event.sender.id) || !isPoint(point)) throw new Error('无效的悬浮球坐标');
    overlay.applyPosition(point, displayId);
    return settingsWindow.state();
  });
  ipcMain.handle('settings:set-preset', (event, preset: unknown, displayId: string) => {
    if (!settingsSender(event.sender.id) || typeof preset !== 'string') throw new Error('无效的位置预设');
    overlay.applyPreset(preset, displayId);
    return settingsWindow.state();
  });
  ipcMain.handle('settings:begin-positioning', (event) => {
    if (!settingsSender(event.sender.id)) throw new Error('拒绝未授权的位置调整请求');
    overlay.beginPositioning();
  });
  ipcMain.handle('settings:end-positioning', (event) => {
    if (!settingsSender(event.sender.id)) throw new Error('拒绝未授权的位置调整请求');
    overlay.endPositioning();
  });
  ipcMain.handle('settings:set-shortcut', (event, shortcut: unknown) => {
    if (!settingsSender(event.sender.id) || typeof shortcut !== 'string' || !validShortcut(shortcut)) {
      throw new Error('快捷键必须包含修饰键和一个主键');
    }
    settings.update({ shortcut });
    bridge.configure(shortcut, settings.get().diagnosticLogging);
    return settingsWindow.state();
  });
  ipcMain.handle('settings:set-auto-start', (event, enabled: unknown) => {
    if (!settingsSender(event.sender.id) || typeof enabled !== 'boolean') throw new Error('无效的自启动设置');
    autoStart.apply(enabled);
    settings.update({ autoStart: enabled });
    return settingsWindow.state();
  });
  ipcMain.handle('settings:set-diagnostic-logging', (event, enabled: unknown) => {
    if (!settingsSender(event.sender.id) || typeof enabled !== 'boolean') throw new Error('无效的日志设置');
    settings.update({ diagnosticLogging: enabled });
    bridge.setDiagnosticLogging(enabled);
    return settingsWindow.state();
  });
  ipcMain.handle('settings:open-repository', async (event) => {
    if (!settingsSender(event.sender.id)) throw new Error('拒绝未授权的外部链接请求');
    await settingsWindow.openRepository();
  });
  ipcMain.on('backend-status', (event, payload: BackendStatusPayload) => backends.handleStatus(event, payload));
  ipcMain.on('backend-transcript', (event, payload: { backend?: string; text?: string }) => {
    if (typeof payload?.backend === 'string' && typeof payload.text === 'string' && backends.senderIsActive(event, payload.backend)) {
      sessions.update(payload.text);
    }
  });
  ipcMain.on('backend-session-ended', (event, payload: { backend?: string; text?: string }) => {
    if (typeof payload?.backend === 'string' && typeof payload.text === 'string' && backends.senderIsActive(event, payload.backend)) {
      sessions.finish(payload.text);
    }
  });
  ipcMain.on('backend-start-error', (event, payload: { backend?: string; message?: string }) => {
    if (typeof payload?.backend === 'string' && backends.senderIsActive(event, payload.backend)) {
      sessions.backendError(payload.message || '后端启动失败');
    }
  });
  ipcMain.on('backend-diagnostic', (event, payload: { backend?: string; stage?: string; [key: string]: unknown }) => {
    if (typeof payload?.backend !== 'string' || !backends.senderIsActive(event, payload.backend)) return;
    if (!settings.get().diagnosticLogging) return;
    const { backend, stage, ...details } = payload;
    console.info(`[MeloASR 网页诊断] backend=${backend} stage=${stage || 'unknown'} ${JSON.stringify(details)}`);
  });
}

function isPoint(value: unknown): value is Point {
  return typeof value === 'object' && value !== null &&
    Number.isFinite((value as Point).x) && Number.isFinite((value as Point).y);
}

function validShortcut(value: string): boolean {
  const parts = value.split('+').filter(Boolean);
  return parts.length >= 2 && parts.some((part) => ['Control', 'Alt', 'Shift', 'Super'].includes(part)) &&
    !['Control', 'Alt', 'Shift', 'Super'].includes(parts.at(-1)!);
}

app.on('window-all-closed', () => { /* 托盘进程继续常驻。 */ });
