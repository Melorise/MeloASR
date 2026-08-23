export interface DebugLoginAction {
  action: 'prompt' | 'open';
  markShown: boolean;
}

export function resolveDebugLoginAction(alreadyShown: boolean, confirmed: boolean): DebugLoginAction {
  if (!alreadyShown && !confirmed) return { action: 'prompt', markShown: false };
  return { action: 'open', markShown: !alreadyShown };
}
