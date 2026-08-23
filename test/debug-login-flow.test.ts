import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDebugLoginAction } from '../src/main/debug-login-flow';

test('首次打开调试页时先显示应用内登录提示', () => {
  assert.deepEqual(resolveDebugLoginAction(false, false), { action: 'prompt', markShown: false });
});

test('用户确认或已经提示过时直接打开调试页', () => {
  assert.deepEqual(resolveDebugLoginAction(false, true), { action: 'open', markShown: true });
  assert.deepEqual(resolveDebugLoginAction(true, false), { action: 'open', markShown: false });
});
