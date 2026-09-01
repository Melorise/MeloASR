import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import net, { type Socket } from 'node:net';
import path from 'node:path';

export const PROTOCOL_VERSION = 2;
const MAX_LINE_BYTES = 1024 * 1024;

export function defaultSocketPath(env: NodeJS.ProcessEnv = process.env): string {
  if (!env.XDG_RUNTIME_DIR) throw new Error('缺少 XDG_RUNTIME_DIR，无法创建 Fcitx5 本地 Socket');
  return path.join(env.XDG_RUNTIME_DIR, 'tama-asr', 'fcitx5.sock');
}

export class JsonLineDecoder {
  private buffer = '';

  constructor(
    private readonly onMessage: (message: unknown) => void,
    private readonly onError: (error: Error) => void,
    private readonly maxLineBytes = MAX_LINE_BYTES
  ) {}

  push(chunk: string | Buffer): void {
    this.buffer += chunk.toString();
    if (Buffer.byteLength(this.buffer) > this.maxLineBytes && !this.buffer.includes('\n')) {
      this.onError(new Error('协议消息超过长度限制'));
      this.buffer = '';
      return;
    }
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (!line.trim()) continue;
      if (Buffer.byteLength(line) > this.maxLineBytes) {
        this.onError(new Error('协议消息超过长度限制'));
        continue;
      }
      try { this.onMessage(JSON.parse(line)); }
      catch (error) { this.onError(new Error(`无效 JSON：${(error as Error).message}`)); }
    }
  }
}

interface FcitxMessage { type?: string; protocol?: number }

export class FcitxBridge extends EventEmitter {
  readonly socketPath: string;
  private server: net.Server | null = null;
  private client: Socket | null = null;
  ready = false;
  activeSession: string | null = null;
  private revision = 0;
  private shortcut = 'Control+Shift+space';
  private diagnosticLogging = false;

  constructor(options: { socketPath?: string; env?: NodeJS.ProcessEnv } = {}) {
    super();
    this.socketPath = options.socketPath ?? defaultSocketPath(options.env);
  }

  async start(): Promise<void> {
    if (this.server) return;
    const directory = path.dirname(this.socketPath);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.chmodSync(directory, 0o700);
    try {
      const stat = fs.lstatSync(this.socketPath);
      if (!stat.isSocket()) throw new Error(`拒绝覆盖非 Socket 路径：${this.socketPath}`);
      fs.unlinkSync(this.socketPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    this.server = net.createServer((socket) => this.accept(socket));
    this.server.on('error', (error) => this.emit('server-error', error));
    await new Promise<void>((resolve, reject) => {
      const server = this.server!;
      const onError = (error: Error): void => { server.off('listening', onListening); reject(error); };
      const onListening = (): void => { server.off('error', onError); resolve(); };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(this.socketPath);
    });
    fs.chmodSync(this.socketPath, 0o600);
  }

  configure(shortcut: string, diagnosticLogging = this.diagnosticLogging): boolean {
    this.shortcut = shortcut;
    this.diagnosticLogging = diagnosticLogging;
    return this.write({ type: 'configure', shortcut, diagnosticLogging });
  }

  setDiagnosticLogging(enabled: boolean): boolean {
    return this.configure(this.shortcut, enabled);
  }

  requestInputStart(): boolean {
    return this.write({ type: 'activate' });
  }

  begin(sessionId: string, backend: string): boolean {
    this.activeSession = sessionId;
    this.revision = 0;
    return this.write({ type: 'start', sessionId, backend });
  }

  update(text: string): boolean {
    if (!this.activeSession) return false;
    this.revision += 1;
    return this.write({ type: 'update', sessionId: this.activeSession, revision: this.revision, text });
  }

  finish(text: string): boolean {
    if (!this.activeSession) return false;
    this.revision += 1;
    const sent = this.write({ type: 'finish', sessionId: this.activeSession, revision: this.revision, text });
    this.activeSession = null;
    return sent;
  }

  cancel(): boolean {
    if (!this.activeSession) return false;
    const sent = this.write({ type: 'cancel', sessionId: this.activeSession });
    this.activeSession = null;
    return sent;
  }

  rejectStart(message: string): boolean {
    return this.write({ type: 'cancel', sessionId: '', message });
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.client?.destroy();
    this.client = null;
    this.ready = false;
    this.activeSession = null;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    try { fs.unlinkSync(this.socketPath); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }

  private accept(socket: Socket): void {
    this.client?.destroy();
    this.client = socket;
    this.ready = false;
    socket.setEncoding('utf8');
    const decoder = new JsonLineDecoder(
      (message) => this.handleMessage(socket, message as FcitxMessage),
      (error) => this.emit('protocol-error', error)
    );
    socket.on('data', (chunk) => decoder.push(chunk));
    socket.on('error', (error) => this.emit('client-error', error));
    socket.on('close', () => {
      if (this.client !== socket) return;
      this.client = null;
      this.ready = false;
      this.emit('disconnect');
    });
    this.write({ type: 'hello', protocol: PROTOCOL_VERSION });
  }

  private handleMessage(socket: Socket, message: FcitxMessage): void {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'hello') {
      if (message.protocol !== PROTOCOL_VERSION) {
        socket.destroy(new Error(`不支持的协议版本：${message.protocol}`));
        return;
      }
      this.ready = true;
      this.configure(this.shortcut);
      this.emit('connect');
      return;
    }
    if (!this.ready) return;
    if (message.type === 'request-start') this.emit('request-start');
    if (message.type === 'request-stop') this.emit('request-stop');
    if (message.type === 'request-cancel') this.emit('request-cancel');
  }

  private write(message: object): boolean {
    if (!this.client?.writable) return false;
    this.client.write(`${JSON.stringify(message)}\n`);
    return true;
  }
}
