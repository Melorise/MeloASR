import type { BackendWebAdapter } from './contracts';
import { yuanbaoDefinition } from './definitions';
import { controlDescription, firstVisible, isUsableControl, operationalStatus } from './dom';

export const yuanbaoAdapter: BackendWebAdapter = {
  definition: yuanbaoDefinition,
  stopCompletion: { minimumWaitMs: 250, quietWindowMs: 450, timeoutMs: 4_500 },

  findEditor(document) {
    return firstVisible(document, yuanbaoDefinition.editorSelector);
  },

  findMicrophone(document) {
    const directSelectors = [
      '[data-testid*="voice-input" i]',
      '[data-testid*="voice" i]',
      '[class*="voice-input" i] button',
      '[class*="voiceInput"] button',
      'button[class*="voice" i]',
      '[role="button"][class*="voice" i]'
    ];
    for (const selector of directSelectors) {
      const element = document.querySelector(selector);
      if (isUsableControl(element)) return element;
    }

    const control = Array.from(document.querySelectorAll('button, [role="button"]'))
      .find((element) =>
        /语音输入|开始语音|停止语音|voice.?input|microphone|mic\b/i.test(controlDescription(element)) &&
        isUsableControl(element)
      );
    return control instanceof HTMLElement ? control : null;
  },

  isRecording(document) {
    const microphone = this.findMicrophone(document);
    return microphone?.getAttribute('aria-pressed') === 'true' ||
      /停止语音|stop\s*(voice|recording|input)/i.test(microphone ? controlDescription(microphone) : '');
  },

  serialize(editor) {
    const clone = editor.cloneNode(true) as HTMLElement;
    const text = clone.innerText ?? clone.textContent ?? '';
    return text.replace(/\n$/, '');
  },

  detectPageStatus(document) {
    return operationalStatus(
      document,
      this.findEditor(document),
      this.findMicrophone(document),
      /登录|微信登录|QQ登录|手机号登录|log\s*in|sign\s*in/i
    );
  }
};
