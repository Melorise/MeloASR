import type { BackendWebAdapter } from './contracts';
import { qianwenDefinition } from './definitions';
import { firstVisible, isUsableControl, operationalStatus } from './dom';

export const qianwenAdapter: BackendWebAdapter = {
  definition: qianwenDefinition,
  stopDelayMs: 1_600,

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
