import type { BackendLoginStatus, BackendPageStatus } from './contracts';

export function isVisible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

export function isUsableControl(element: Element | null): element is HTMLElement {
  return isVisible(element) && !element.matches('[disabled], [aria-disabled="true"]');
}

export function firstVisible(document: Document, selector: string): HTMLElement | null {
  const elements = Array.from(document.querySelectorAll(selector));
  return elements.find(isVisible) ?? (elements[0] instanceof HTMLElement ? elements[0] : null);
}

export function controlDescription(element: Element): string {
  return [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.getAttribute('data-tooltip'),
    element.textContent,
    element.getAttribute('class'),
    element.querySelector('svg')?.getAttribute('class')
  ].filter(Boolean).join(' ');
}

export function findSemanticControl(document: Document, pattern: RegExp): HTMLElement | null {
  const control = Array.from(document.querySelectorAll('button, a, [role="button"]'))
    .find((element) => pattern.test(controlDescription(element)) && isUsableControl(element));
  return control instanceof HTMLElement ? control : null;
}

export function operationalStatus(
  document: Document,
  editor: HTMLElement | null,
  microphone: HTMLElement | null,
  loginPattern: RegExp
): BackendPageStatus {
  if (editor && microphone) return { loginStatus: 'logged-in', ready: true };
  if (editor) {
    return {
      loginStatus: 'logged-in',
      ready: false,
      message: '语音入口尚未就绪'
    };
  }

  const loginControl = findSemanticControl(document, loginPattern);
  const loginStatus: BackendLoginStatus = loginControl ? 'logged-out' : 'unknown';
  return {
    loginStatus,
    ready: false,
    message: loginControl ? '尚未登录' : '页面尚未进入可语音输入状态'
  };
}
