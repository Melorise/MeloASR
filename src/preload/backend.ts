import { ipcRenderer } from 'electron';
import type { BackendControlCommand, BackendPageStatus, BackendTranscriptPayload } from '../backends/contracts';
import { getBackendWebAdapter } from '../backends/web-registry';
import { shouldClickMicrophoneOnCancel } from './speech-session-state';
import { shouldFinishAfterStop } from './stop-completion';

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
let cancelTimer: ReturnType<typeof setTimeout> | undefined;
let statusTimer: ReturnType<typeof setTimeout> | undefined;
let transcriptRevision = 0;
let lastStatusKey = '';
let lastTranscriptAt = 0;

function controlSnapshot(element: HTMLElement | null): Record<string, unknown> {
  if (!element) return { found: false };
  return {
    found: true,
    tag: element.tagName,
    ariaLabel: element.getAttribute('aria-label'),
    ariaPressed: element.getAttribute('aria-pressed'),
    title: element.getAttribute('title'),
    disabled: element.matches('[disabled], [aria-disabled="true"]'),
    className: String(element.className).slice(0, 240)
  };
}

function diagnose(stage: string, details: Record<string, unknown> = {}): void {
  emit('backend-diagnostic', { stage, active, stopping, visibility: document.visibilityState, ...details });
}

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
  lastTranscriptAt = Date.now();
  diagnose('transcript', { revision: transcriptRevision, textLength: text.length });
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
  clearTimeout(cancelTimer);
  active = false;
  stopping = false;
  lastTranscriptAt = 0;
  editorObserver?.disconnect();
  diagnose('session-reset');
}

function fail(message: string): void {
  diagnose('failure', { message });
  resetSession();
  emit('backend-start-error', { message });
  emitPageStatus(true);
}

function startSpeech(): void {
  diagnose('start-received');
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

  diagnose('start-targets', {
    editorLength: adapter.serialize(editor).length,
    microphone: controlSnapshot(microphone)
  });

  clearTimeout(stopTimer);
  placeCaretAtEnd(editor);
  lastSpeechText = adapter.serialize(editor);
  transcriptRevision = 0;
  lastTranscriptAt = Date.now();
  active = true;
  stopping = false;
  observeEditor(editor);
  microphone.click();
  diagnose('start-clicked', { microphone: controlSnapshot(adapter.findMicrophone(document)) });
  window.setTimeout(() => diagnose('start-after-250ms', {
    microphone: controlSnapshot(adapter.findMicrophone(document)),
    editorLength: adapter.findEditor(document) ? adapter.serialize(adapter.findEditor(document)!).length : null
  }), 250);
  window.setTimeout(() => diagnose('start-after-1000ms', {
    microphone: controlSnapshot(adapter.findMicrophone(document)),
    editorLength: adapter.findEditor(document) ? adapter.serialize(adapter.findEditor(document)!).length : null
  }), 1_000);
}

function stopSpeech(): void {
  diagnose('stop-received', { microphone: controlSnapshot(adapter?.findMicrophone(document) ?? null) });
  if (!active || stopping || !adapter) return;
  stopping = true;
  const stoppedAt = Date.now();
  const wasRecordingAtStop = adapter.isRecording(document);
  adapter.findMicrophone(document)?.click();
  diagnose('stop-clicked', { microphone: controlSnapshot(adapter.findMicrophone(document)) });
  const finish = (): void => {
    emitCurrentEditorText();
    resetSession();
    emit('backend-session-ended', { text: lastSpeechText, revision: transcriptRevision });
    emitPageStatus(true);
  };
  const checkCompletion = (): void => {
    if (!active || !stopping || !adapter) return;
    const now = Date.now();
    if (shouldFinishAfterStop({
      elapsedMs: now - stoppedAt,
      quietMs: now - lastTranscriptAt,
      wasRecordingAtStop,
      isRecording: adapter.isRecording(document),
      ...adapter.stopCompletion
    })) {
      diagnose('stop-complete', { elapsedMs: now - stoppedAt });
      finish();
      return;
    }
    stopTimer = setTimeout(checkCompletion, 75);
  };
  clearTimeout(stopTimer);
  stopTimer = setTimeout(checkCompletion, 75);
}

function cancelSpeech(): void {
  diagnose('cancel-received', { microphone: controlSnapshot(adapter?.findMicrophone(document) ?? null) });
  if (!active || !adapter) return;
  if (!shouldClickMicrophoneOnCancel(active, stopping)) {
    diagnose('cancel-click-skipped', { reason: 'stop-already-requested' });
    resetSession();
    lastSpeechText = '';
    return;
  }

  // 网页的启动点击是异步的。若在按钮仍显示“语音输入”时再次点击，
  // 元宝会在稍后仍进入录音，造成前后端会话分叉。
  const deadline = Date.now() + 1_500;
  const stopWhenRecording = (): void => {
    if (!active || !adapter) return;
    const microphone = adapter.findMicrophone(document);
    if (adapter.isRecording(document)) {
      microphone?.click();
      diagnose('cancel-clicked', { microphone: controlSnapshot(adapter.findMicrophone(document)) });
      resetSession();
      lastSpeechText = '';
      return;
    }
    if (Date.now() >= deadline) {
      diagnose('cancel-timeout', { microphone: controlSnapshot(microphone) });
      resetSession();
      lastSpeechText = '';
      return;
    }
    cancelTimer = setTimeout(stopWhenRecording, 50);
  };
  clearTimeout(cancelTimer);
  cancelTimer = setTimeout(stopWhenRecording, 50);
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
