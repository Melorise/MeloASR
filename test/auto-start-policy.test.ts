import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAutoStartAction } from '../src/main/auto-start-policy';

test('开发模式不创建用户级自启动覆盖文件', () => {
  assert.equal(resolveAutoStartAction(false, true), 'unchanged');
  assert.equal(resolveAutoStartAction(false, false), 'unchanged');
});

test('安装包启用自启动时移除用户级覆盖，交由系统 desktop 文件启动', () => {
  assert.equal(resolveAutoStartAction(true, true), 'remove-user-override');
});

test('安装包关闭自启动时写入 Hidden 覆盖', () => {
  assert.equal(resolveAutoStartAction(true, false), 'write-hidden-override');
});
