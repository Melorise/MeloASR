import type { BackendDefinition } from './contracts';

export const qianwenDefinition: BackendDefinition = Object.freeze({
  id: 'qianwen',
  label: '千问',
  url: 'https://www.qianwen.com/',
  origins: Object.freeze(['https://www.qianwen.com']),
  partition: 'persist:tama-asr-qianwen',
  editorSelector: '[data-slate-editor="true"][contenteditable="true"], [role="textbox"][contenteditable="true"]'
});

export const yuanbaoDefinition: BackendDefinition = Object.freeze({
  id: 'yuanbao',
  label: '元宝',
  url: 'https://yuanbao.tencent.com/',
  origins: Object.freeze(['https://yuanbao.tencent.com']),
  partition: 'persist:tama-asr-yuanbao',
  editorSelector: '.ql-editor[contenteditable="true"], [contenteditable="true"][role="textbox"]'
});

export const backendDefinitions = Object.freeze([
  qianwenDefinition,
  yuanbaoDefinition
] as const);
