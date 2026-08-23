import type { BackendWebAdapter } from './contracts';
import { qianwenDefinition } from './definitions';
import { controlDescription, firstVisible, isUsableControl, operationalStatus } from './dom';

export const qianwenAdapter: BackendWebAdapter = {
  definition: qianwenDefinition,
  stopCompletion: { minimumWaitMs: 250, quietWindowMs: 350, timeoutMs: 2_500 },

  findEditor(document) {
    return firstVisible(document, qianwenDefinition.editorSelector);
  },

  findMicrophone(document) {
    const anchor = document.querySelector('[data-global-speaking-guide-anchor]');
    if (isUsableControl(anchor)) return anchor;
    const icon = document.querySelector('[data-icon-type="qwpcicon-mic"]');
    const control = icon?.closest('button, [role="button"], [data-global-speaking-guide-anchor]') ?? icon?.parentElement;
    return control instanceof HTMLElement && isUsableControl(control) ? control : null;
  },

  isRecording(document) {
    const microphone = this.findMicrophone(document);
    return microphone?.getAttribute('aria-pressed') === 'true' ||
      /停止语音|stop\s*(voice|recording|input)/i.test(microphone ? controlDescription(microphone) : '');
  },

  serialize(editor) {
    return Array.from(editor.children)
      .filter((node) => node.nodeType === Node.ELEMENT_NODE)
      .map((block) => {
        const clone = block.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('[data-slate-placeholder], [data-slate-zero-width]').forEach((node) => node.remove());
        return clone.textContent ?? '';
      })
      .join('\n');
  },

  detectPageStatus(document) {
    return operationalStatus(
      document,
      this.findEditor(document),
      this.findMicrophone(document),
      /登录|注册|log\s*in|sign\s*in/i
    );
  }
};
