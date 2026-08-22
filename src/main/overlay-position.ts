import type { Rectangle } from 'electron';
import type { Point } from '../shared/contracts';

export const PRESETS = new Set([
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right'
]);

export function presetPosition(workArea: Rectangle, size: { width: number; height: number }, preset: string, margin = 32): Point {
  if (!PRESETS.has(preset)) throw new Error('未知的悬浮球位置预设');
  const [vertical, horizontal] = preset.split('-');
  const x = horizontal === 'left' ? workArea.x + margin
    : horizontal === 'right' ? workArea.x + workArea.width - size.width - margin
      : workArea.x + (workArea.width - size.width) / 2;
  const y = vertical === 'top' ? workArea.y + margin
    : vertical === 'bottom' ? workArea.y + workArea.height - size.height - margin
      : workArea.y + (workArea.height - size.height) / 2;
  return { x: Math.round(x), y: Math.round(y) };
}

export function clampPosition(position: Point, workArea: Rectangle, size: { width: number; height: number }): Point {
  const maxX = workArea.x + Math.max(0, workArea.width - size.width);
  const maxY = workArea.y + Math.max(0, workArea.height - size.height);
  return {
    x: Math.round(Math.min(Math.max(position.x, workArea.x), maxX)),
    y: Math.round(Math.min(Math.max(position.y, workArea.y), maxY))
  };
}
