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

const OVERLAY_SIZE = 88;
const PRESET_MARGIN = 32;
const PRESET_LABELS: Record<string, string> = {
  'top-left': '左上角',
  'top-center': '顶部居中',
  'top-right': '右上角',
  'middle-left': '左侧居中',
  'middle-center': '屏幕中央',
  'middle-right': '右侧居中',
  'bottom-left': '左下角',
  'bottom-center': '底部居中',
  'bottom-right': '右下角'
};

const backend = document.querySelector<HTMLSelectElement>('#backend')!;
const backendStatus = document.querySelector<HTMLElement>('#backend-status')!;
const appStatus = document.querySelector<HTMLElement>('#app-status')!;
const loginWarning = document.querySelector<HTMLElement>('#login-warning')!;
const display = document.querySelector<HTMLSelectElement>('#display')!;
const x = document.querySelector<HTMLInputElement>('#position-x')!;
const y = document.querySelector<HTMLInputElement>('#position-y')!;
const shortcut = document.querySelector<HTMLButtonElement>('#shortcut')!;
const autoStart = document.querySelector<HTMLInputElement>('#auto-start')!;
const diagnosticLogging = document.querySelector<HTMLInputElement>('#diagnostic-logging')!;
const version = document.querySelector<HTMLElement>('#version')!;
const repository = document.querySelector<HTMLButtonElement>('#repository')!;
const repositoryLabel = repository.querySelector<HTMLElement>('span')!;
const message = document.querySelector<HTMLElement>('#message')!;
const settingsView = document.querySelector<HTMLElement>('#settings-view')!;
const positionView = document.querySelector<HTMLElement>('#position-view')!;
const positionScreen = document.querySelector<HTMLElement>('#position-screen')!;
const positionBall = document.querySelector<HTMLElement>('#position-ball')!;
const positionSummary = document.querySelector<HTMLElement>('#position-summary')!;
const loginNotice = document.querySelector<HTMLDialogElement>('#login-notice')!;
const loginNoticeTitle = document.querySelector<HTMLElement>('#login-notice-title')!;
const presetButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-preset]')];
let state: SettingsViewState;
let capturingShortcut = false;
let positionMode = false;
let messageTimer: ReturnType<typeof setTimeout> | null = null;

function statusText(status: BackendRuntimeStatus): string {
  if (status.ready || status.login === 'logged-in') return '已登录';
  if (status.login === 'logged-out') return '需要登录';
  return '加载中';
}

function renderServiceStatus(status: BackendRuntimeStatus): void {
  const backendStatusText = backendStatus.querySelector<HTMLElement>('span')!;
  backendStatusText.textContent = statusText(status);
  backendStatus.dataset.state = status.ready ? 'ready'
    : status.login === 'logged-out' ? 'warning' : 'loading';

  const appStatusText = appStatus.querySelector<HTMLElement>('span')!;
  if (status.ready) {
    appStatusText.textContent = '服务已就绪';
    appStatus.dataset.state = 'ready';
  } else if (status.login === 'logged-out') {
    appStatusText.textContent = '需要登录';
    appStatus.dataset.state = 'warning';
  } else {
    appStatusText.textContent = '正在连接';
    appStatus.dataset.state = 'loading';
  }
}

function render(next: SettingsViewState): void {
  state = next;
  backend.replaceChildren(...next.backends.map((item) => new Option(item.label, item.id)));
  backend.value = next.backendId;
  const active = next.backends.find((item) => item.id === next.backendId)!;
  renderServiceStatus(active.status);
  loginWarning.hidden = active.status.login !== 'logged-out';

  const previousDisplay = display.value;
  display.replaceChildren(...next.displays.map((item) => new Option(item.label, item.id)));
  const containing = next.displays.find((item) => containsPosition(item.workArea, next.overlayPosition));
  display.value = next.displays.some((item) => item.id === previousDisplay)
    ? previousDisplay : (containing?.id ?? next.displays[0]?.id ?? '');
  x.value = String(next.overlayPosition.x);
  y.value = String(next.overlayPosition.y);
  renderPositionPreview(next);
  renderPositionSummary(next, containing);

  shortcut.textContent = capturingShortcut ? '请按下新快捷键…' : displayShortcut(next.shortcut);
  shortcut.dataset.capturing = String(capturingShortcut);
  shortcut.setAttribute('aria-pressed', String(capturingShortcut));
  autoStart.checked = next.autoStart;
  diagnosticLogging.checked = next.diagnosticLogging;
  version.textContent = next.version;
  repositoryLabel.textContent = next.repositoryUrl ? '项目仓库' : '仓库未配置';
  repository.disabled = !next.repositoryUrl;
}

function containsPosition(area: SettingsViewState['displays'][number]['workArea'], point: { x: number; y: number }): boolean {
  return point.x >= area.x && point.x < area.x + area.width && point.y >= area.y && point.y < area.y + area.height;
}

function selectedDisplay(next: SettingsViewState): SettingsViewState['displays'][number] | undefined {
  return next.displays.find((item) => item.id === display.value) ?? next.displays[0];
}

function presetPoint(area: SettingsViewState['displays'][number]['workArea'], preset: string): { x: number; y: number } {
  const [vertical, horizontal] = preset.split('-');
  const pointX = horizontal === 'left' ? area.x + PRESET_MARGIN
    : horizontal === 'right' ? area.x + area.width - OVERLAY_SIZE - PRESET_MARGIN
      : area.x + (area.width - OVERLAY_SIZE) / 2;
  const pointY = vertical === 'top' ? area.y + PRESET_MARGIN
    : vertical === 'bottom' ? area.y + area.height - OVERLAY_SIZE - PRESET_MARGIN
      : area.y + (area.height - OVERLAY_SIZE) / 2;
  return { x: Math.round(pointX), y: Math.round(pointY) };
}

function matchingPreset(next: SettingsViewState, displayInfo = selectedDisplay(next)): string | null {
  if (!displayInfo) return null;
  for (const button of presetButtons) {
    const preset = button.dataset.preset!;
    const point = presetPoint(displayInfo.workArea, preset);
    if (point.x === next.overlayPosition.x && point.y === next.overlayPosition.y) return preset;
  }
  return null;
}

function renderPositionPreview(next: SettingsViewState): void {
  const displayInfo = selectedDisplay(next);
  if (!displayInfo) return;
  const area = displayInfo.workArea;
  const centerX = next.overlayPosition.x - area.x + OVERLAY_SIZE / 2;
  const centerY = next.overlayPosition.y - area.y + OVERLAY_SIZE / 2;
  const px = Math.max(OVERLAY_SIZE / 2, Math.min(area.width - OVERLAY_SIZE / 2, centerX));
  const py = Math.max(OVERLAY_SIZE / 2, Math.min(area.height - OVERLAY_SIZE / 2, centerY));
  positionBall.style.left = `clamp(25px, ${(px / area.width) * 100}%, calc(100% - 25px))`;
  positionBall.style.top = `clamp(25px, ${(py / area.height) * 100}%, calc(100% - 25px))`;

  const preset = matchingPreset(next, displayInfo);
  presetButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.preset === preset)));
}

function renderPositionSummary(
  next: SettingsViewState,
  containing = next.displays.find((item) => containsPosition(item.workArea, next.overlayPosition))
): void {
  const displayInfo = containing ?? selectedDisplay(next);
  if (!displayInfo) {
    positionSummary.textContent = '未检测到显示器';
    return;
  }
  const preset = matchingPreset(next, displayInfo);
  const screenName = displayInfo.label.split(' · ')[0].split('（')[0];
  positionSummary.textContent = preset
    ? `${screenName} · ${PRESET_LABELS[preset]}`
    : `${screenName} · X ${next.overlayPosition.x}，Y ${next.overlayPosition.y}`;
}

function displayShortcut(value: string): string {
  return value
    .replaceAll('Control', 'Ctrl')
    .replaceAll('Super', 'Meta')
    .replace(/\+space$/i, '+Space')
    .replaceAll('+', '  +  ');
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

function showMessage(text: string, kind: 'success' | 'error' = 'success'): void {
  if (messageTimer) clearTimeout(messageTimer);
  message.textContent = text;
  message.dataset.kind = kind;
  message.dataset.visible = 'true';
  messageTimer = setTimeout(() => {
    message.dataset.visible = 'false';
    messageTimer = null;
  }, kind === 'error' ? 4200 : 2200);
}

async function apply(action: () => Promise<SettingsViewState>, confirmation = '设置已保存'): Promise<void> {
  try {
    render(await action());
    showMessage(confirmation);
  } catch (error) {
    showMessage((error as Error).message, 'error');
  }
}

async function applyPosition(): Promise<void> {
  await apply(() => window.meloSettings.setPosition({ x: Number(x.value), y: Number(y.value) }, display.value), '位置已保存');
}

backend.addEventListener('change', () => void apply(() => window.meloSettings.setBackend(backend.value), '语音服务已切换'));
display.addEventListener('change', () => {
  renderPositionPreview(state);
  renderPositionSummary(state);
});
document.querySelector('#open-debug')!.addEventListener('click', () => void window.meloSettings.openDebug());
document.querySelector('#open-position')!.addEventListener('click', () => {
  positionMode = true;
  settingsView.hidden = true;
  positionView.hidden = false;
  void window.meloSettings.beginPositioning();
  renderPositionPreview(state);
});
document.querySelector('#back-settings')!.addEventListener('click', () => {
  positionMode = false;
  positionView.hidden = true;
  settingsView.hidden = false;
  void window.meloSettings.endPositioning();
});
document.querySelector('#login-notice-cancel')!.addEventListener('click', () => loginNotice.close());
document.querySelector('#login-notice-continue')!.addEventListener('click', () => {
  loginNotice.close();
  void window.meloSettings.openDebug(true);
});
presetButtons.forEach((button) => {
  button.addEventListener('click', () => void apply(
    () => window.meloSettings.setPreset(button.dataset.preset!, display.value), '位置已保存'
  ));
});

async function nudge(direction: string): Promise<void> {
  if (direction === 'center') {
    await apply(() => window.meloSettings.setPreset('middle-center', display.value), '位置已保存');
    return;
  }
  const next = { x: Number(x.value), y: Number(y.value) };
  if (direction === 'left') next.x -= 1;
  if (direction === 'right') next.x += 1;
  if (direction === 'up') next.y -= 1;
  if (direction === 'down') next.y += 1;
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
  shortcut.dataset.capturing = 'true';
  shortcut.setAttribute('aria-pressed', 'true');
  shortcut.focus();
});
autoStart.addEventListener('change', () => void apply(
  () => window.meloSettings.setAutoStart(autoStart.checked),
  autoStart.checked ? '已开启开机自动启动' : '已关闭开机自动启动'
));
diagnosticLogging.addEventListener('change', () => void apply(
  () => window.meloSettings.setDiagnosticLogging(diagnosticLogging.checked),
  diagnosticLogging.checked ? '已开启诊断日志' : '已关闭诊断日志'
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
void window.meloSettings.getState().then(render).catch((error: Error) => showMessage(error.message, 'error'));
