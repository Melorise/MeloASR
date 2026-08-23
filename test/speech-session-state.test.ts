import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldClickMicrophoneOnCancel } from '../src/preload/speech-session-state';

test('停止命令已经点击过麦克风后，取消不得再次点击并重新开启录音', () => {
  assert.equal(shouldClickMicrophoneOnCancel(true, true), false);
});

test('录音期间直接取消时仍应点击麦克风停止网页录音', () => {
  assert.equal(shouldClickMicrophoneOnCancel(true, false), true);
});

test('本地会话未激活时取消不得点击麦克风', () => {
  assert.equal(shouldClickMicrophoneOnCancel(false, false), false);
});
