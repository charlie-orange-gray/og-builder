// visual-rect.test.ts — captureVisualRect reads the node's parent from the
// IMPERATIVE cache (fresh mid-drag), not the frozen jotai snapshot.
import { describe, test, expect, vi } from 'vitest';

vi.mock('@/shared/debug-trace', () => ({ trace: { action: vi.fn(), fn: vi.fn(), dom: vi.fn(), error: vi.fn() } }));
vi.mock('@/canvas/transform', () => ({ transformManager: { getTransform: () => ({ scale: 1, x: 0, y: 0 }) } }));
import { makeRect } from '@/canvas/drag/layout-local-frame';
const rects: Record<string, DOMRect> = {
  frame: makeRect(100, 100, 400, 300),
  box: makeRect(150, 160, 50, 40),
};
vi.mock('@/canvas/node-ops', () => ({
  findNodeRect: vi.fn((id: string) => rects[id] ?? null),
  findNodeComputedStyles: vi.fn((id: string) => (id === 'box' ? { width: '50px', height: '40px' } : {})),
  findNodeParentInnerSize: vi.fn(() => ({ width: 400, height: 300 })),
  findNodeComputedStyle: vi.fn(() => ''),
  getViewportPrefix: vi.fn(() => ''),
}));
const corners = new Map<string, any>();
vi.mock('@/canvas/canvas-bridge', () => ({
  getCanvasBridge: () => ({ getCachedCorners: (id: string) => corners.get(id) ?? null }),
}));
const cache = new Map<string, any>();
const snapshot = new Map<string, any>();
vi.mock('@/code/stores/store', () => ({
  getNodeFromCache: (id: string) => cache.get(id),
  getNodesSnapshot: () => snapshot,
}));

import { captureVisualRect } from './visual-rect';

describe('captureVisualRect parent source', () => {
  test('uses the cache parent when the snapshot still says canvas (mid-drag entry)', () => {
    snapshot.set('box', { id: 'box', parentId: null, styles: {} });
    cache.set('box', { id: 'box', parentId: 'frame', styles: {} });
    const r = captureVisualRect('box', 'vp');
    expect(r).not.toBeNull();
    expect(r!.left).toBe(50);
    expect(r!.top).toBe(60);
    expect(r!.parentWidth).toBe(400);
  });

  test('falls back to the snapshot when the cache has no entry', () => {
    cache.clear();
    snapshot.set('box', { id: 'box', parentId: 'frame', styles: {} });
    expect(captureVisualRect('box', 'vp')?.left).toBe(50);
  });

  test('rotated parent: offset is measured along the parent edges, not between AABBs', () => {
    // frame 400×300 rotated 45° about its centre (250, 250); child 50×40 at local (29, 168)
    const cx = 300, cy = 250;
    const rot = (lx: number, ly: number) => {
      const x = lx - 200, y = ly - 150; // relative to frame centre in local space
      const c = Math.SQRT1_2;
      return { x: cx + x * c - y * c, y: cy + x * c + y * c };
    };
    corners.set('frame', { TL: rot(0, 0), TR: rot(400, 0), BR: rot(400, 300), BL: rot(0, 300) });
    corners.set('box', { TL: rot(29, 168), TR: rot(79, 168), BR: rot(79, 208), BL: rot(29, 208) });
    const aabb = (id: string) => {
      const c = corners.get(id); const xs = [c.TL.x, c.TR.x, c.BR.x, c.BL.x]; const ys = [c.TL.y, c.TR.y, c.BR.y, c.BL.y];
      return makeRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    };
    rects.frame = aabb('frame'); rects.box = aabb('box');
    cache.set('box', { id: 'box', parentId: 'frame', styles: {} });
    const r = captureVisualRect('box', 'vp')!;
    expect(r.left).toBeCloseTo(29, 4);
    expect(r.top).toBeCloseTo(168, 4);
    corners.clear();
    rects.frame = makeRect(100, 100, 400, 300);
    rects.box = makeRect(150, 160, 50, 40);
  });

  test('no parent anywhere → null', () => {
    cache.clear();
    snapshot.set('box', { id: 'box', parentId: null, styles: {} });
    expect(captureVisualRect('box', 'vp')).toBeNull();
  });
});
