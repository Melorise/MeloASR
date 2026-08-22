import assert from 'node:assert/strict';
import test from 'node:test';
import { JsonLineDecoder, defaultSocketPath } from '../src/main/fcitx-bridge';

test('Socket 路径只使用当前用户运行时目录', () => {
  assert.equal(defaultSocketPath({ XDG_RUNTIME_DIR: '/run/user/1000' }), '/run/user/1000/meloasr/fcitx5.sock');
  assert.throws(() => defaultSocketPath({}), /XDG_RUNTIME_DIR/);
});

test('JSONL 解码器支持拆包、粘包与无效 JSON', () => {
  const messages: unknown[] = [];
  const errors: Error[] = [];
  const decoder = new JsonLineDecoder((message) => messages.push(message), (error) => errors.push(error));
  decoder.push('{"type":"hel');
  decoder.push('lo","protocol":2}\n{"type":"request-start"}\nnot-json\n');
  assert.deepEqual(messages, [{ type: 'hello', protocol: 2 }, { type: 'request-start' }]);
  assert.equal(errors.length, 1);
});
