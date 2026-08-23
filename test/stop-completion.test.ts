import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldFinishAfterStop } from '../src/preload/stop-completion';

const base = {
  elapsedMs: 700,
  quietMs: 500,
  wasRecordingAtStop: true,
  isRecording: false,
  minimumWaitMs: 250,
  quietWindowMs: 450,
  timeoutMs: 4_500
};

test('网页仍在录音时不得提前提交', () => {
  assert.equal(shouldFinishAfterStop({ ...base, isRecording: true }), false);
});

test('网页结束且最终文本静默窗口满足时立即提交', () => {
  assert.equal(shouldFinishAfterStop(base), true);
});

test('网页结束后仍有文本修正时继续等待', () => {
  assert.equal(shouldFinishAfterStop({ ...base, quietMs: 120 }), false);
});

test('网页状态未回切时由超时兜底结束', () => {
  assert.equal(shouldFinishAfterStop({ ...base, elapsedMs: 4_500, isRecording: true }), true);
});
