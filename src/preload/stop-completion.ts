export interface StopCompletionInput {
  readonly elapsedMs: number;
  readonly quietMs: number;
  readonly wasRecordingAtStop: boolean;
  readonly isRecording: boolean;
  readonly minimumWaitMs: number;
  readonly quietWindowMs: number;
  readonly timeoutMs: number;
}

export function shouldFinishAfterStop(input: StopCompletionInput): boolean {
  if (input.elapsedMs >= input.timeoutMs) return true;
  if (input.wasRecordingAtStop && input.isRecording) return false;
  return input.elapsedMs >= input.minimumWaitMs && input.quietMs >= input.quietWindowMs;
}
