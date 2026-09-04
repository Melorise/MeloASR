import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldFinishAfterStop } from '../src/preload/stop-completion';

const base = {
  elapsedMs: 700,
  quietMs: 500,
  stopClicked: true,
  isRecording: false,
  minimumWaitMs: 250,
  quietWindowMs: 450,
  timeoutMs: 4_500
};

test('网页仍在录音时不得提前提交', () => {
  assert.equal(shouldFinishAfterStop({ ...base, isRecording: true }), false);
});

test('尚未点击停止时不得提交', () => {
  assert.equal(shouldFinishAfterStop({ ...base, stopClicked: false }), false);
});

test('网页结束且最终文本静默窗口满足时立即提交', () => {
  assert.equal(shouldFinishAfterStop(base), true);
});

test('网页结束后仍有文本修正时继续等待', () => {
  assert.equal(shouldFinishAfterStop({ ...base, quietMs: 120 }), false);
});

test('网页仍在录音时超时也不得提交', () => {
  assert.equal(shouldFinishAfterStop({ ...base, elapsedMs: 4_500, isRecording: true }), false);
});

test('网页已停止时超时可以结束静默等待', () => {
  assert.equal(shouldFinishAfterStop({ ...base, elapsedMs: 4_500, quietMs: 120 }), true);
});
