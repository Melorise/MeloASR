export type BackendId = 'qianwen' | 'yuanbao' | (string & {});

export type BackendLoginStatus = 'logged-in' | 'logged-out' | 'unknown';

/** 主进程可安全使用的后端静态信息。 */
export interface BackendDefinition {
  readonly id: BackendId;
  readonly label: string;
  readonly url: string;
  readonly origins: readonly string[];
  readonly partition: string;
  readonly editorSelector: string;
}

export interface BackendPageStatus {
  readonly loginStatus: BackendLoginStatus;
  /** 页面已经具备开始语音识别所需的编辑器和麦克风入口。 */
  readonly ready: boolean;
  readonly message?: string;
}

/** 仅在后端网页 preload 的渲染进程中调用。 */
export interface BackendWebAdapter {
  readonly definition: BackendDefinition;
  readonly stopDelayMs: number;
  findEditor(document: Document): HTMLElement | null;
  findMicrophone(document: Document): HTMLElement | null;
  serialize(editor: HTMLElement): string;
  detectPageStatus(document: Document): BackendPageStatus;
}

export interface BackendControlCommand {
  readonly backend: BackendId;
  readonly action: 'start' | 'stop' | 'cancel' | 'refresh-status';
}

export interface BackendTranscriptPayload {
  readonly backend: BackendId;
  readonly text: string;
  readonly revision: number;
}

export function backendOwnsUrl(definition: BackendDefinition, candidate: string): boolean {
  try {
    const origin = new URL(candidate).origin;
    return definition.origins.includes(origin);
  } catch {
    return false;
  }
}
