import { BrowserWindow, Notification } from 'electron';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { SessionState } from '../shared/contracts';
import type { BackendManager } from './backend-manager';
import type { FcitxBridge } from './fcitx-bridge';
import type { OverlayController } from './overlay-controller';

export class SessionController extends EventEmitter {
  state: SessionState = 'idle';
  private mirroredText = '';
  private stopRequestedDuringStart = false;
  private generation = 0;

  constructor(
    private readonly backends: BackendManager,
    private readonly bridge: FcitxBridge,
    private readonly overlay: OverlayController
  ) { super(); }

  async start(): Promise<void> {
    if (this.state !== 'idle') {
      this.bridge.rejectStart(`上一轮仍处于 ${this.state} 状态`);
      return;
    }
    const definition = this.backends.activeDefinition();
    const status = this.backends.status(definition.id);
    if (!this.bridge.ready) return this.reject('Fcitx5 插件尚未连接');
    if (!status.ready) {
      return this.reject(status.login === 'logged-out'
        ? `${definition.label}尚未登录，请从托盘打开设置`
        : `${definition.label}页面尚未就绪`);
    }

    this.state = 'starting';
    this.emitState();
    const generation = ++this.generation;
    this.stopRequestedDuringStart = false;
    await this.backends.ensure(definition.id);
    const page = await this.backends.resolveActivePage();
    if (generation !== this.generation) return;
    if (!page) return this.failStart(`没有找到${definition.label}输入框`);
    if (!await this.backends.clearActiveEditor(page)) {
      if (generation === this.generation) this.failStart(`无法清空${definition.label}输入框`);
      return;
    }
    if (generation !== this.generation) return;
    this.mirroredText = '';
    this.state = 'recording';
    this.bridge.begin(randomUUID(), definition.id);
    this.overlay.showState('recording');
    this.emitState();
    page.webContents.send('backend-control', { action: 'start', backend: definition.id });
    if (this.stopRequestedDuringStart) this.stop();
  }

  stop(): void {
    if (this.state === 'starting') {
      this.stopRequestedDuringStart = true;
      return;
    }
    if (this.state !== 'recording') return;
    this.state = 'stopping';
    this.overlay.showState('stopping');
    this.emitState();
    this.backends.activePage()?.webContents.send('backend-control', {
      action: 'stop', backend: this.backends.activeDefinition().id
    });
  }

  cancel(message = '语音输入已取消'): void {
    if (!['starting', 'recording', 'stopping'].includes(this.state)) return;
    console.warn(`[MeloASR 会话取消] state=${this.state} reason=${message}`);
    this.generation += 1;
    this.stopRequestedDuringStart = false;
    this.backends.activePage()?.webContents.send('backend-control', {
      action: 'cancel', backend: this.backends.activeDefinition().id
    });
    if (this.bridge.activeSession) this.bridge.cancel(); else this.bridge.rejectStart(message);
    this.state = 'idle';
    this.mirroredText = '';
    this.overlay.showState('error');
    this.overlay.hideLater();
    this.emitState();
  }

  update(text: string): void {
    if (!['recording', 'stopping'].includes(this.state) || text === this.mirroredText || !this.bridge.activeSession) return;
    this.bridge.update(text);
    this.mirroredText = text;
  }

  finish(text: string): void {
    if (!['recording', 'stopping'].includes(this.state)) return;
    this.update(text);
    this.bridge.finish(text);
    this.state = 'idle';
    this.mirroredText = '';
    this.overlay.showState('done');
    this.overlay.hideLater();
    this.emitState();
  }

  backendError(message: string): void {
    console.error(`[MeloASR 后端错误] state=${this.state} reason=${message}`);
    if (this.bridge.activeSession) this.bridge.cancel(); else this.bridge.rejectStart(message);
    this.state = 'idle';
    this.mirroredText = '';
    this.overlay.showState('error');
    this.overlay.hideLater(2200);
    this.notify(message);
    this.emitState();
  }

  private failStart(message: string): void {
    this.state = 'idle';
    this.bridge.rejectStart(message);
    this.notify(message);
    this.emitState();
  }

  private reject(message: string): void {
    this.bridge.rejectStart(message);
    this.notify(message);
  }

  private notify(message: string): void {
    if (Notification.isSupported()) new Notification({ title: 'MeloASR', body: message }).show();
  }

  private emitState(): void {
    this.emit('state-changed', this.state);
  }
}
