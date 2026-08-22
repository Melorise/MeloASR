import assert from 'node:assert/strict';
import test from 'node:test';
import { clampPosition, presetPosition } from '../src/main/overlay-position';

const workArea = { x: 100, y: 50, width: 1200, height: 800 };
const size = { width: 88, height: 88 };

test('九宫格预设基于屏幕工作区计算', () => {
  assert.deepEqual(presetPosition(workArea, size, 'top-left'), { x: 132, y: 82 });
  assert.deepEqual(presetPosition(workArea, size, 'middle-center'), { x: 656, y: 406 });
  assert.deepEqual(presetPosition(workArea, size, 'bottom-right'), { x: 1180, y: 730 });
});

test('精确坐标被限制在工作区内', () => {
  assert.deepEqual(clampPosition({ x: -500, y: 2000 }, workArea, size), { x: 100, y: 762 });
});
