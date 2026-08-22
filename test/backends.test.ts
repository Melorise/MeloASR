import assert from 'node:assert/strict';
import test from 'node:test';
import { backendOwnsUrl } from '../src/backends/contracts';
import { getBackend, listBackends, requireBackend } from '../src/backends/registry';

test('后端注册表包含千问和元宝且 ID 唯一', () => {
  const backends = listBackends();
  assert.deepEqual(backends.map(({ id }) => id), ['qianwen', 'yuanbao']);
  assert.equal(new Set(backends.map(({ id }) => id)).size, backends.length);
  assert.equal(getBackend('qianwen')?.label, '千问');
  assert.equal(getBackend('missing'), undefined);
  assert.throws(() => requireBackend('missing'), /未知后端/);
});

test('后端 URL 校验使用精确 origin', () => {
  const qianwen = requireBackend('qianwen');
  assert.equal(backendOwnsUrl(qianwen, 'https://www.qianwen.com/chat/1'), true);
  assert.equal(backendOwnsUrl(qianwen, 'https://www.qianwen.com.evil.example/'), false);
  assert.equal(backendOwnsUrl(qianwen, 'not a url'), false);
});
