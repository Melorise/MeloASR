import type { BackendLoginStatus, BackendPageStatus } from './contracts';

export function decideOperationalStatus(
  hasEditor: boolean,
  hasMicrophone: boolean,
  hasLoginControl: boolean
): BackendPageStatus {
  if (hasLoginControl) {
    return { loginStatus: 'logged-out', ready: false, message: '尚未登录' };
  }
  if (hasEditor && hasMicrophone) return { loginStatus: 'logged-in', ready: true };
  if (hasEditor) {
    return {
      loginStatus: 'logged-in',
      ready: false,
      message: '语音入口尚未就绪'
    };
  }

  const loginStatus: BackendLoginStatus = 'unknown';
  return {
    loginStatus,
    ready: false,
    message: '页面尚未进入可语音输入状态'
  };
}
