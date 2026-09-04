export interface StopCompletionInput {
  readonly elapsedMs: number;
  readonly quietMs: number;
  readonly stopClicked: boolean;
  readonly isRecording: boolean;
  readonly minimumWaitMs: number;
  readonly quietWindowMs: number;
  readonly timeoutMs: number;
}

export function shouldFinishAfterStop(input: StopCompletionInput): boolean {
  if (!input.stopClicked || input.isRecording) return false;
  if (input.elapsedMs >= input.timeoutMs) return true;
  return input.elapsedMs >= input.minimumWaitMs && input.quietMs >= input.quietWindowMs;
}
