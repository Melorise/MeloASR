export type SessionState = 'idle' | 'starting' | 'recording' | 'stopping';
export type BackendLoginState = 'unknown' | 'logged-in' | 'logged-out';
export type BackendReadyState = 'loading' | 'ready' | 'login-required' | 'error';

export interface Point {
  x: number;
  y: number;
}

export interface AppSettings {
  backendId: string;
  shortcut: string;
  autoStart: boolean;
  overlayPersistent: boolean;
  overlayPosition: Point | null;
  loginNoticeShown: Record<string, boolean>;
}

export interface BackendRuntimeStatus {
  backendId: string;
  ready: boolean;
  login: BackendLoginState;
  detail: string;
}

export interface BackendStatusPayload {
  backend: string;
  ready: boolean;
  loggedIn: boolean | null;
  detail?: string;
}

export interface DisplayInfo {
  id: string;
  label: string;
  workArea: Electron.Rectangle;
}

export interface SettingsViewState {
  backendId: string;
  backends: Array<{ id: string; label: string; status: BackendRuntimeStatus }>;
  sessionState: SessionState;
  shortcut: string;
  autoStart: boolean;
  overlayPersistent: boolean;
  overlayPosition: Point;
  displays: DisplayInfo[];
  version: string;
  repositoryUrl: string | null;
}
