import type { BackendPageStatus } from './contracts';
import { decideOperationalStatus } from './status-decision';

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
  return elements.find(isVisible) ?? null;
}

export function controlDescription(element: Element): string {
  return [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.getAttribute('data-tooltip'),
    element.textContent,
    element.getAttribute('value'),
    element.getAttribute('class'),
    element.querySelector('svg')?.getAttribute('class')
  ].filter(Boolean).join(' ');
}

export function findSemanticControl(document: Document, pattern: RegExp): HTMLElement | null {
  const control = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'))
    .find((element) => pattern.test(controlDescription(element)) && isUsableControl(element));
  return control instanceof HTMLElement ? control : null;
}

export function operationalStatus(
  document: Document,
  editor: HTMLElement | null,
  microphone: HTMLElement | null,
  loginPattern: RegExp
): BackendPageStatus {
  const loginControl = findSemanticControl(document, loginPattern);
  return decideOperationalStatus(Boolean(editor), Boolean(microphone), Boolean(loginControl));
}
