export function shouldClickMicrophoneOnCancel(active: boolean, stopping: boolean): boolean {
  return active && !stopping;
}
