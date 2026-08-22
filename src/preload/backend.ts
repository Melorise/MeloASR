import { ipcRenderer } from 'electron';
import type { BackendControlCommand, BackendPageStatus, BackendTranscriptPayload } from '../backends/contracts';
import { getBackendWebAdapter } from '../backends/web-registry';

const backendId = process.argv
  .find((argument) => argument.startsWith('--meloasr-backend='))
  ?.slice('--meloasr-backend='.length) ?? '';
const adapter = getBackendWebAdapter(backendId);

let editorObserver: MutationObserver | undefined;
let pageObserver: MutationObserver | undefined;
let active = false;
let stopping = false;
let lastSpeechText = '';
let emitScheduled = false;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
let statusTimer: ReturnType<typeof setTimeout> | undefined;
let transcriptRevision = 0;
let lastStatusKey = '';

function emit(channel: string, value: Record<string, unknown> = {}): void {
  ipcRenderer.send(channel, { backend: backendId, ...value });
}

function statusKey(status: BackendPageStatus): string {
  return JSON.stringify([status.loginStatus, status.ready, status.message ?? '']);
}

function emitPageStatus(force = false): void {
  if (!adapter) return;
  const status = adapter.detectPageStatus(document);
  const key = statusKey(status);
  if (!force && key === lastStatusKey) return;
  lastStatusKey = key;
  emit('backend-status', {
    ready: status.ready,
    loggedIn: status.loginStatus === 'unknown' ? null : status.loginStatus === 'logged-in',
    detail: status.message ?? ''
  });
}

function schedulePageStatus(): void {
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => emitPageStatus(), 200);
}

function emitCurrentEditorText(): void {
  emitScheduled = false;
  if (!active || !adapter) return;
  const editor = adapter.findEditor(document);
  if (!editor) {
    fail(`${adapter.definition.label}输入框在录音期间消失，本轮已停止`);
    return;
  }
  const text = adapter.serialize(editor);
  if (text === lastSpeechText) return;
  lastSpeechText = text;
  transcriptRevision += 1;
  const payload: Omit<BackendTranscriptPayload, 'backend'> = { text, revision: transcriptRevision };
  emit('backend-transcript', payload);
}

function scheduleTranscript(): void {
  if (emitScheduled || !active) return;
  emitScheduled = true;
  requestAnimationFrame(emitCurrentEditorText);
}

function observeEditor(editor: HTMLElement): void {
  editorObserver?.disconnect();
  editorObserver = new MutationObserver(scheduleTranscript);
  editorObserver.observe(editor, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class']
  });
}

function placeCaretAtEnd(editor: HTMLElement): void {
  editor.focus({ preventScroll: true });
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function resetSession(): void {
  clearTimeout(stopTimer);
  active = false;
  stopping = false;
  editorObserver?.disconnect();
}

function fail(message: string): void {
  resetSession();
  emit('backend-start-error', { message });
  emitPageStatus(true);
}

function startSpeech(): void {
  if (!adapter) return;
  const status = adapter.detectPageStatus(document);
  if (!status.ready) {
    fail(status.loginStatus === 'logged-out'
      ? `${adapter.definition.label}尚未登录，请先打开登录页面`
      : `${adapter.definition.label}页面尚未就绪，请打开后端页面并进入对话页`);
    return;
  }

  const editor = adapter.findEditor(document);
  const microphone = adapter.findMicrophone(document);
  if (!editor || !microphone) {
    fail(`没有找到${adapter.definition.label}输入框或麦克风按钮`);
    return;
  }

  clearTimeout(stopTimer);
  placeCaretAtEnd(editor);
  lastSpeechText = adapter.serialize(editor);
  transcriptRevision = 0;
  active = true;
  stopping = false;
  observeEditor(editor);
  microphone.click();
}

function stopSpeech(): void {
  if (!active || stopping || !adapter) return;
  stopping = true;
  adapter.findMicrophone(document)?.click();
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    emitCurrentEditorText();
    resetSession();
    emit('backend-session-ended', { text: lastSpeechText, revision: transcriptRevision });
    emitPageStatus(true);
  }, adapter.stopDelayMs);
}

function cancelSpeech(): void {
  if (!active || !adapter) return;
  adapter.findMicrophone(document)?.click();
  resetSession();
  lastSpeechText = '';
}

ipcRenderer.on('backend-control', (_event, command: BackendControlCommand) => {
  if (!adapter || command.backend !== backendId) return;
  if (command.action === 'start') startSpeech();
  if (command.action === 'stop') stopSpeech();
  if (command.action === 'cancel') cancelSpeech();
  if (command.action === 'refresh-status') emitPageStatus(true);
});

if (adapter) {
  const startStatusObserver = (): void => {
    emitPageStatus(true);
    pageObserver?.disconnect();
    pageObserver = new MutationObserver(schedulePageStatus);
    pageObserver.observe(document.documentElement, { subtree: true, childList: true });
    window.setInterval(() => emitPageStatus(), 5_000);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startStatusObserver, { once: true });
  } else {
    startStatusObserver();
  }
} else {
  emit('backend-start-error', { message: `未知后端：${backendId || '未指定'}` });
}
