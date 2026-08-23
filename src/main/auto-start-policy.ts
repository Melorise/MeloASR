export type AutoStartAction = 'unchanged' | 'write-hidden-override' | 'remove-user-override';

export function resolveAutoStartAction(isPackaged: boolean, enabled: boolean): AutoStartAction {
  if (!isPackaged) return 'unchanged';
  return enabled ? 'remove-user-override' : 'write-hidden-override';
}
