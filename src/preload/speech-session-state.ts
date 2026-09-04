export function shouldClickMicrophoneOnCancel(active: boolean, stopping: boolean): boolean {
  return active && !stopping;
}

export function shouldClickMicrophoneOnStop(isRecording: boolean, stopClicked: boolean): boolean {
  return isRecording && !stopClicked;
}
