import assert from 'node:assert/strict';
import test from 'node:test';
import { decideOperationalStatus } from '../src/backends/status-decision';

test('登录入口存在时不得被编辑器和麦克风误判为已登录', () => {
  assert.deepEqual(decideOperationalStatus(true, true, true), {
    loginStatus: 'logged-out',
    ready: false,
    message: '尚未登录'
  });
});

test('对话页具备编辑器和麦克风时允许录音', () => {
  assert.deepEqual(decideOperationalStatus(true, true, false), {
    loginStatus: 'logged-in',
    ready: true
  });
});
