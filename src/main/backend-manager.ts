import { app, BrowserWindow, screen, session, type IpcMainEvent } from 'electron';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { backendOwnsUrl, type BackendDefinition } from '../backends/contracts';
import { listBackends, requireBackend } from '../backends/registry';
import type { BackendRuntimeStatus, BackendStatusPayload } from '../shared/contracts';
import type { SettingsStore } from './settings-store';

interface BackendRecord {
  definition: BackendDefinition;
  root: BrowserWindow;
  page: BrowserWindow;
  windows: Set<BrowserWindow>;
  exposed: boolean;
  disposed: boolean;
  status: BackendRuntimeStatus;
}

const loadingStatus = (definition: BackendDefinition): BackendRuntimeStatus => ({
  backendId: definition.id,
  ready: false,
  login: 'unknown',
  detail: '正在加载'
});

export class BackendManager extends EventEmitter {
  private readonly records = new Map<string, BackendRecord>();

  constructor(private readonly settings: SettingsStore) { super(); }

  definitions(): readonly BackendDefinition[] {
    return listBackends();
  }

  activeDefinition(): BackendDefinition {
    return requireBackend(this.settings.get().backendId);
  }

  status(id: string): BackendRuntimeStatus {
    const definition = requireBackend(id);
    return this.records.get(id)?.status ?? loadingStatus(definition);
  }

  async ensure(id: string): Promise<BrowserWindow> {
    const existing = this.records.get(id);
    if (existing?.page && !existing.page.isDestroyed()) return existing.page;
    if (existing?.root && !existing.root.isDestroyed()) return existing.root;

    const definition = requireBackend(id);
    const backendSession = session.fromPartition(definition.partition);
    this.configurePermissions(backendSession, definition);
    const root = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      width: 1280,
      height: 840,
      title: `${definition.label} · MeloASR`,
      backgroundColor: '#ffffff',
      icon: path.join(app.getAppPath(), 'dist', 'assets', 'logo.png'),
      webPreferences: {
        partition: definition.partition,
        preload: path.join(__dirname, '..', 'preload', 'backend.js'),
        additionalArguments: [`--meloasr-backend=${id}`],
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false
      }
    });
    const record: BackendRecord = {
      definition,
      root,
      page: root,
      windows: new Set([root]),
      exposed: false,
      disposed: false,
      status: loadingStatus(definition)
    };
    this.records.set(id, record);
    this.registerWindow(root, record);
    try {
      await root.loadURL(definition.url);
      this.hideRecord(record);
      root.webContents.send('backend-control', { action: 'refresh-status', backend: id });
    } catch (error) {
      record.status = { backendId: id, ready: false, login: 'unknown', detail: `加载失败：${(error as Error).message}` };
      this.emit('status-changed', record.status);
    }
    return record.page;
  }

  async select(id: string): Promise<void> {
    requireBackend(id);
    const previousId = this.settings.get().backendId;
    if (previousId === id) {
      await this.ensure(id);
      return;
    }
    this.disposeRecord(previousId);
    this.settings.update({ backendId: id });
    await this.ensure(id);
    this.emit('active-changed', id);
  }

  async showDebug(id = this.settings.get().backendId): Promise<void> {
    const page = await this.ensure(id);
    const record = this.records.get(id)!;
    record.exposed = true;
    page.setSkipTaskbar(false);
    page.setBounds(this.debugBounds());
    page.show();
    page.focus();
  }

  hideDebug(id = this.settings.get().backendId): void {
    this.hideRecord(this.records.get(id));
  }

  activePage(): BrowserWindow | null {
    const record = this.records.get(this.settings.get().backendId);
    if (!record) return null;
    return !record.page.isDestroyed() ? record.page : (!record.root.isDestroyed() ? record.root : null);
  }

  async resolveActivePage(): Promise<BrowserWindow | null> {
    const definition = this.activeDefinition();
    const record = this.records.get(definition.id);
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const candidates = [record?.page, record?.root, ...BrowserWindow.getAllWindows()]
        .filter((window): window is BrowserWindow => Boolean(window && !window.isDestroyed()))
        .filter((window, index, all) => all.indexOf(window) === index)
        .filter((window) => backendOwnsUrl(definition, window.webContents.getURL()));
      for (const candidate of candidates) {
        try {
          const found = await candidate.webContents.executeJavaScript(
            `Boolean(document.querySelector(${JSON.stringify(definition.editorSelector)}))`, true
          );
          if (found) {
            if (record) record.page = candidate;
            return candidate;
          }
        } catch { /* 页面正在导航，继续重试。 */ }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
  }

  async clearActiveEditor(window: BrowserWindow): Promise<boolean> {
    const selector = this.activeDefinition().editorSelector;
    let hadContent = false;
    let consecutiveEmpty = 0;
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const result = await window.webContents.executeJavaScript(`(() => {
        const editors = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
        const editor = editors.find((candidate) => {
          const style = getComputedStyle(candidate);
          const rect = candidate.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        }) || editors[0];
        if (!editor) return { found: false, empty: false, beforeBytes: 0 };
        const clone = editor.cloneNode(true);
        clone.querySelectorAll('[data-slate-placeholder], [data-slate-zero-width], .ql-placeholder').forEach((node) => node.remove());
        const text = (clone.textContent || '').trim();
        if (!text) return { found: true, empty: true, beforeBytes: 0 };
        editor.focus({ preventScroll: true });
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.removeAllRanges();
        selection.addRange(range);
        return { found: true, empty: false, beforeBytes: new TextEncoder().encode(text).length };
      })()`, true) as { found: boolean; empty: boolean; beforeBytes: number };
      if (!result.found) return false;
      if (!hadContent && result.beforeBytes === 0) return true;
      if (result.empty) {
        consecutiveEmpty += 1;
        if (consecutiveEmpty >= 2) return true;
      } else {
        hadContent = true;
        consecutiveEmpty = 0;
        window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' });
        window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' });
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }

  handleStatus(event: IpcMainEvent, payload: BackendStatusPayload): void {
    const record = this.records.get(payload?.backend);
    if (!record || !this.recordOwnsSender(record, event.sender.id)) return;
    record.status = {
      backendId: payload.backend,
      ready: payload.ready,
      login: payload.loggedIn === null ? 'unknown' : payload.loggedIn ? 'logged-in' : 'logged-out',
      detail: payload.detail || (payload.ready ? '已就绪' : '尚未就绪')
    };
    this.emit('status-changed', record.status);
  }

  senderIsActive(event: IpcMainEvent, backendId: string): boolean {
    if (backendId !== this.settings.get().backendId) return false;
    const record = this.records.get(backendId);
    return Boolean(record && this.recordOwnsSender(record, event.sender.id));
  }

  private registerWindow(window: BrowserWindow, record: BackendRecord): void {
    window.on('close', (event) => {
      if (record.disposed || (app as typeof app & { isQuitting?: boolean }).isQuitting) return;
      event.preventDefault();
      this.hideRecord(record);
    });
    window.webContents.setWindowOpenHandler(({ url }) => ({
      action: url.startsWith('https://') ? 'allow' : 'deny',
      overrideBrowserWindowOptions: { show: record.exposed, skipTaskbar: !record.exposed, focusable: true }
    }));
    window.webContents.on('did-create-window', (child) => {
      if (record.disposed) {
        child.destroy();
        return;
      }
      record.windows.add(child);
      child.on('closed', () => record.windows.delete(child));
      this.registerWindow(child, record);
      if (!record.exposed) this.parkWindow(child);
      child.webContents.on('did-finish-load', () => {
        if (backendOwnsUrl(record.definition, child.webContents.getURL())) record.page = child;
      });
    });
    window.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
      if (!isMainFrame) return;
      record.status = { backendId: record.definition.id, ready: false, login: 'unknown', detail: `加载失败（${code}）：${description}` };
      this.emit('status-changed', record.status);
    });
  }

  private configurePermissions(backendSession: Electron.Session, definition: BackendDefinition): void {
    const matches = (url = ''): boolean => backendOwnsUrl(definition, url);
    backendSession.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) =>
      matches(requestingOrigin) && permission === 'media' && (!details.mediaType || details.mediaType === 'audio'));
    backendSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
      const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined;
      const audioOnly = !mediaTypes || mediaTypes.every((type: string) => type === 'audio');
      callback(Boolean(matches(details.requestingUrl) && permission === 'media' && audioOnly));
    });
  }

  private hideRecord(record?: BackendRecord): void {
    if (!record) return;
    record.exposed = false;
    for (const window of record.windows) this.parkWindow(window);
  }

  private disposeRecord(id: string): void {
    const record = this.records.get(id);
    if (!record) return;
    record.disposed = true;
    this.records.delete(id);
    for (const window of [...record.windows]) {
      if (!window.isDestroyed()) window.destroy();
    }
    record.windows.clear();
  }

  private parkWindow(window: BrowserWindow): void {
    if (window.isDestroyed()) return;
    window.hide();
    window.setSkipTaskbar(true);
  }

  private recordOwnsSender(record: BackendRecord, senderId: number): boolean {
    return [...record.windows].some((window) => !window.isDestroyed() && window.webContents.id === senderId);
  }

  private debugBounds(): Electron.Rectangle {
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const margin = 24;
    const width = Math.min(1280, area.width - margin * 2);
    const height = Math.min(840, area.height - margin * 2);
    return { x: Math.round(area.x + (area.width - width) / 2), y: Math.round(area.y + (area.height - height) / 2), width, height };
  }
}
