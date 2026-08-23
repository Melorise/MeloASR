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
  diagnosticLogging: boolean;
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
const diagnosticLogging = document.querySelector<HTMLInputElement>('#diagnostic-logging')!;
const version = document.querySelector<HTMLElement>('#version')!;
const repository = document.querySelector<HTMLButtonElement>('#repository')!;
const message = document.querySelector<HTMLElement>('#message')!;
const settingsView = document.querySelector<HTMLElement>('body > main')!;
const positionView = document.querySelector<HTMLElement>('#position-view')!;
const positionScreen = document.querySelector<HTMLElement>('#position-screen')!;
const positionBall = document.querySelector<HTMLElement>('#position-ball')!;
const loginNotice = document.querySelector<HTMLDialogElement>('#login-notice')!;
const loginNoticeTitle = document.querySelector<HTMLElement>('#login-notice-title')!;
let state: SettingsViewState;
let capturingShortcut = false;
let positionMode = false;

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
  renderPositionPreview(next);
  shortcut.textContent = capturingShortcut ? '请按下新快捷键…' : displayShortcut(next.shortcut);
  autoStart.checked = next.autoStart;
  diagnosticLogging.checked = next.diagnosticLogging;
  version.textContent = next.version;
  repository.textContent = next.repositoryUrl ?? '尚未配置';
  repository.disabled = !next.repositoryUrl;
}

function renderPositionPreview(next: SettingsViewState): void {
  const area = next.displays.find((item) => item.id === display.value)?.workArea ?? next.displays[0]?.workArea;
  if (!area) return;
  const px = Math.max(0, Math.min(area.width, next.overlayPosition.x - area.x));
  const py = Math.max(0, Math.min(area.height, next.overlayPosition.y - area.y));
  positionBall.style.left = `${(px / area.width) * 100}%`;
  positionBall.style.top = `${(py / area.height) * 100}%`;
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
document.querySelector('#open-position')!.addEventListener('click', () => {
  positionMode = true;
  settingsView.style.display = 'none';
  positionView.style.display = 'grid';
  void window.meloSettings.beginPositioning();
  renderPositionPreview(state);
});
document.querySelector('#back-settings')!.addEventListener('click', () => {
  positionMode = false;
  positionView.style.display = 'none';
  settingsView.style.display = 'grid';
  void window.meloSettings.endPositioning();
});
document.querySelector('#login-notice-cancel')!.addEventListener('click', () => loginNotice.close());
document.querySelector('#login-notice-continue')!.addEventListener('click', () => {
  loginNotice.close();
  void window.meloSettings.openDebug(true);
});
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => void apply(
    () => window.meloSettings.setPreset(button.dataset.preset!, display.value), '位置已保存'
  ));
});

async function nudge(direction: string): Promise<void> {
  if (direction === 'center') {
    await apply(() => window.meloSettings.setPreset('middle-center', display.value), '位置已保存');
    return;
  }
  const step = 1;
  const next = { x: Number(x.value), y: Number(y.value) };
  if (direction === 'left') next.x -= step;
  if (direction === 'right') next.x += step;
  if (direction === 'up') next.y -= step;
  if (direction === 'down') next.y += step;
  x.value = String(next.x);
  y.value = String(next.y);
  await applyPosition();
}
document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach((button) => {
  button.addEventListener('click', () => void nudge(button.dataset.direction!));
});
x.addEventListener('change', () => void applyPosition());
y.addEventListener('change', () => void applyPosition());

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
  if (!positionMode || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  if ((event.target as HTMLElement).matches('select, input')) return;
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
diagnosticLogging.addEventListener('change', () => void apply(
  () => window.meloSettings.setDiagnosticLogging(diagnosticLogging.checked)
));
repository.addEventListener('click', () => void window.meloSettings.openRepository());
window.meloSettings.onState(render);
window.meloSettings.onLoginNotice((backendLabel) => {
  loginNoticeTitle.textContent = `登录${backendLabel}`;
  if (!loginNotice.open) loginNotice.showModal();
});
window.addEventListener('beforeunload', () => {
  if (positionMode) void window.meloSettings.endPositioning();
});
void window.meloSettings.getState().then(render).catch((error: Error) => { message.textContent = error.message; });
