interface BackendRuntimeStatus {
  ready: boolean;
  login: 'unknown' | 'logged-in' | 'logged-out';
  detail: string;
}

interface SettingsViewState {
  backendId: string;
  backends: Array<{ id: string; label: string; status: BackendRuntimeStatus }>;
  sessionState: 'idle' | 'starting' | 'recording' | 'stopping';
  shortcut: string;
  autoStart: boolean;
  overlayPersistent: boolean;
  overlayPosition: { x: number; y: number };
  displays: Array<{ id: string; label: string; workArea: { x: number; y: number; width: number; height: number } }>;
  version: string;
  repositoryUrl: string | null;
}

const backend = document.querySelector<HTMLSelectElement>('#backend')!;
const backendStatus = document.querySelector<HTMLElement>('#backend-status')!;
const loginWarning = document.querySelector<HTMLElement>('#login-warning')!;
const display = document.querySelector<HTMLSelectElement>('#display')!;
const x = document.querySelector<HTMLInputElement>('#position-x')!;
const y = document.querySelector<HTMLInputElement>('#position-y')!;
const shortcut = document.querySelector<HTMLButtonElement>('#shortcut')!;
const autoStart = document.querySelector<HTMLInputElement>('#auto-start')!;
const overlayPersistent = document.querySelector<HTMLInputElement>('#overlay-persistent')!;
const version = document.querySelector<HTMLElement>('#version')!;
const repository = document.querySelector<HTMLButtonElement>('#repository')!;
const message = document.querySelector<HTMLElement>('#message')!;
let state: SettingsViewState;
let capturingShortcut = false;

function statusText(status: BackendRuntimeStatus): string {
  if (status.ready) return '已就绪';
  if (status.login === 'logged-out') return '需要登录';
  return status.detail || '正在加载';
}

function render(next: SettingsViewState): void {
  state = next;
  backend.replaceChildren(...next.backends.map((item) => new Option(item.label, item.id)));
  backend.value = next.backendId;
  const active = next.backends.find((item) => item.id === next.backendId)!;
  backendStatus.textContent = statusText(active.status);
  backendStatus.dataset.state = active.status.ready ? 'ready'
    : active.status.login === 'logged-out' ? 'warning' : 'loading';
  loginWarning.hidden = active.status.login !== 'logged-out';

  const previousDisplay = display.value;
  display.replaceChildren(...next.displays.map((item) => new Option(item.label, item.id)));
  const containing = next.displays.find((item) => {
    const area = item.workArea;
    return next.overlayPosition.x >= area.x && next.overlayPosition.x < area.x + area.width &&
      next.overlayPosition.y >= area.y && next.overlayPosition.y < area.y + area.height;
  });
  display.value = next.displays.some((item) => item.id === previousDisplay)
    ? previousDisplay : (containing?.id ?? next.displays[0]?.id ?? '');
  x.value = String(next.overlayPosition.x);
  y.value = String(next.overlayPosition.y);
  shortcut.textContent = capturingShortcut ? '请按下新快捷键…' : displayShortcut(next.shortcut);
  autoStart.checked = next.autoStart;
  overlayPersistent.checked = next.overlayPersistent;
  version.textContent = next.version;
  repository.textContent = next.repositoryUrl ?? '尚未配置';
  repository.disabled = !next.repositoryUrl;
}

function displayShortcut(value: string): string {
  return value.replaceAll('Control', 'Ctrl').replaceAll('Super', 'Meta').replace(/\+space$/i, '+Space');
}

function formatShortcut(event: KeyboardEvent): string | null {
  const modifiers = [
    event.ctrlKey ? 'Control' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Super' : ''
  ].filter(Boolean);
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key) || modifiers.length === 0) return null;
  const key = event.code === 'Space' ? 'space'
    : event.code.startsWith('Key') ? event.code.slice(3).toLowerCase()
      : event.code.startsWith('Digit') ? event.code.slice(5)
        : event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return [...modifiers, key].join('+');
}

async function apply(action: () => Promise<SettingsViewState>, confirmation = '已保存'): Promise<void> {
  try {
    render(await action());
    message.textContent = confirmation;
  } catch (error) {
    message.textContent = (error as Error).message;
  }
}

async function applyPosition(): Promise<void> {
  await apply(() => window.meloSettings.setPosition({ x: Number(x.value), y: Number(y.value) }, display.value));
}

backend.addEventListener('change', () => void apply(() => window.meloSettings.setBackend(backend.value)));
document.querySelector('#open-debug')!.addEventListener('click', () => void window.meloSettings.openDebug());
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => void apply(
    () => window.meloSettings.setPreset(button.dataset.preset!, display.value), '位置已保存'
  ));
});
document.querySelector('#apply-position')!.addEventListener('click', () => void applyPosition());
document.querySelector('#preview-overlay')!.addEventListener('click', () => void window.meloSettings.previewOverlay());

document.addEventListener('keydown', (event) => {
  if (capturingShortcut) {
    event.preventDefault();
    if (event.key === 'Escape') {
      capturingShortcut = false;
      render(state);
      return;
    }
    const value = formatShortcut(event);
    if (!value) return;
    capturingShortcut = false;
    void apply(() => window.meloSettings.setShortcut(value), '快捷键已保存');
    return;
  }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  if ((event.target as HTMLElement).matches('select, button, input[type="checkbox"]')) return;
  event.preventDefault();
  const step = event.shiftKey ? 10 : 1;
  if (event.key === 'ArrowLeft') x.value = String(Number(x.value) - step);
  if (event.key === 'ArrowRight') x.value = String(Number(x.value) + step);
  if (event.key === 'ArrowUp') y.value = String(Number(y.value) - step);
  if (event.key === 'ArrowDown') y.value = String(Number(y.value) + step);
  void applyPosition();
});

shortcut.addEventListener('click', () => {
  capturingShortcut = true;
  shortcut.textContent = '请按下新快捷键…';
  shortcut.focus();
});
autoStart.addEventListener('change', () => void apply(() => window.meloSettings.setAutoStart(autoStart.checked)));
overlayPersistent.addEventListener('change', () => void apply(
  () => window.meloSettings.setOverlayPersistent(overlayPersistent.checked)
));
repository.addEventListener('click', () => void window.meloSettings.openRepository());
window.meloSettings.onState(render);
void window.meloSettings.getState().then(render).catch((error: Error) => { message.textContent = error.message; });
