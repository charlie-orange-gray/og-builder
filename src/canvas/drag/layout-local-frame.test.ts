// layout-local-frame.test.ts — parent-local frame maths for transform-aware
// drop lines: round trip, rotated child rects, insert index + line segment
// on a rotated flex parent.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { ScreenCorners } from '@/shared/types';

vi.mock('@/shared/debug-trace', () => ({
  trace: { action: vi.fn(), fn: vi.fn(), dom: vi.fn(), error: vi.fn() },
}));

const cornersById = new Map<string, ScreenCorners>();
const childrenOf = new Map<string, string[]>();
const computed = new Map<string, Record<string, string>>();

vi.mock('@/canvas/node-ops', () => ({
  findNodeRect: vi.fn((id: string) => aabbOf(cornersById.get(id))),
  findVisibleChildRects: vi.fn((parentId: string) =>
    (childrenOf.get(parentId) ?? []).map(id => ({ id, rect: aabbOf(cornersById.get(id))! }))),
  findNodeComputedStyle: vi.fn((id: string, _vp: string, prop: string) => computed.get(id)?.[prop] ?? ''),
  findNodeComputedStyles: vi.fn((id: string) => computed.get(id) ?? {}),
  getViewportPrefix: vi.fn(() => ''),
}));
vi.mock('@/code/stores/store', () => ({
  getNodeFromCache: vi.fn(() => undefined),
}));
vi.mock('@/canvas/canvas-bridge', () => ({
  getCanvasBridge: vi.fn(() => ({
    getCachedCorners: (id: string) => cornersById.get(id) ?? null,
  })),
}));
vi.mock('./types', () => ({
  detectParentLayoutById: vi.fn(() => 'flex'),
  getFlexDirectionById: vi.fn(() => 'row'),
}));
vi.mock('@/code/stores/container-query-store', () => ({ getOverridesAtWidth: vi.fn(() => ({})) }));

import { frameFromCorners, localRectOfCorners, segmentFromLocal, makeRect, getLayoutLocalFrame, findVisibleChildLocalRects } from './layout-local-frame';
import { calculateLayoutInsertIndexById } from './reparent-utils';
import { calculateGridDrop } from './grid-drop';
import { calculateLineSegment } from '@/canvas/selection/DropLineIndicator';

function aabbOf(c?: ScreenCorners): DOMRect | null {
  if (!c) return null;
  const xs = [c.TL.x, c.TR.x, c.BR.x, c.BL.x];
  const ys = [c.TL.y, c.TR.y, c.BR.y, c.BL.y];
  const l = Math.min(...xs), t = Math.min(...ys);
  return makeRect(l, t, Math.max(...xs) - l, Math.max(...ys) - t);
}

/** Corners of a local box (relative to the parent's unrotated TL) painted
 *  by rotating the whole parent by `deg` about the parent's TL, then
 *  translating to `origin`. */
function rotatedBox(origin: { x: number; y: number }, deg: number, x: number, y: number, w: number, h: number): ScreenCorners {
  const r = deg * Math.PI / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const p = (lx: number, ly: number) => ({ x: origin.x + lx * c - ly * s, y: origin.y + lx * s + ly * c });
  return { TL: p(x, y), TR: p(x + w, y), BR: p(x + w, y + h), BL: p(x, y + h) };
}

beforeEach(() => { cornersById.clear(); childrenOf.clear(); computed.clear(); });

describe('frameFromCorners', () => {
  test('axis-aligned quad → identity frame that keeps the screen rect', () => {
    const rect = makeRect(10, 20, 300, 100);
    const frame = frameFromCorners({ TL: { x: 10, y: 20 }, TR: { x: 310, y: 20 }, BR: { x: 310, y: 120 }, BL: { x: 10, y: 120 } }, rect)!;
    expect(frame.identity).toBe(true);
    expect(frame.parentRect).toBe(rect);
    expect(frame.toLocal({ x: 5, y: 7 })).toEqual({ x: 5, y: 7 });
  });

  test('rotated quad → toLocal/toScreen round-trip and local parent box = unrotated size', () => {
    const corners = rotatedBox({ x: 400, y: 300 }, 30, 0, 0, 300, 100);
    const frame = frameFromCorners(corners)!;
    expect(frame.identity).toBe(false);
    expect(frame.parentRect.width).toBeCloseTo(300, 6);
    expect(frame.parentRect.height).toBeCloseTo(100, 6);
    const local = frame.toLocal(corners.BR);
    expect(local.x).toBeCloseTo(300, 6);
    expect(local.y).toBeCloseTo(100, 6);
    const back = frame.toScreen({ x: 120, y: 40 });
    const again = frame.toLocal(back);
    expect(again.x).toBeCloseTo(120, 6);
    expect(again.y).toBeCloseTo(40, 6);
  });

  test('skewed quad (non-orthogonal axes) still inverts exactly', () => {
    const corners: ScreenCorners = { TL: { x: 0, y: 0 }, TR: { x: 200, y: 0 }, BR: { x: 250, y: 100 }, BL: { x: 50, y: 100 } };
    const frame = frameFromCorners(corners)!;
    const l = frame.toLocal({ x: 150, y: 50 }); // midpoint of the quad
    const s = frame.toScreen(l);
    expect(s.x).toBeCloseTo(150, 6);
    expect(s.y).toBeCloseTo(50, 6);
  });

  test('localRectOfCorners recovers the child box inside a rotated parent', () => {
    const frame = frameFromCorners(rotatedBox({ x: 400, y: 300 }, 45, 0, 0, 300, 100))!;
    const child = rotatedBox({ x: 400, y: 300 }, 45, 110, 10, 80, 80);
    const r = localRectOfCorners(frame, child);
    expect(r.left).toBeCloseTo(110, 6);
    expect(r.top).toBeCloseTo(10, 6);
    expect(r.width).toBeCloseTo(80, 6);
    expect(r.height).toBeCloseTo(80, 6);
  });

  test('segmentFromLocal maps an axis-parallel local line to the rotated screen segment', () => {
    const frame = frameFromCorners(rotatedBox({ x: 0, y: 0 }, 90, 0, 0, 200, 100))!;
    // vertical local line at x=100 from y=0..100 → after 90° rotation it is horizontal
    const seg = segmentFromLocal(frame, 'vertical', 100, 0, 100);
    expect(seg.axisAligned).toBe(false);
    expect(seg.y1).toBeCloseTo(100, 6);
    expect(seg.y2).toBeCloseTo(100, 6);
    expect(seg.x1).toBeCloseTo(0, 6);
    expect(seg.x2).toBeCloseTo(-100, 6);
  });
});

describe('rotated flex row parent — index + line agree in the parent frame', () => {
  const origin = { x: 500, y: 400 };
  const deg = 40;
  function setupRow() {
    cornersById.set('p', rotatedBox(origin, deg, 0, 0, 340, 100));
    cornersById.set('a', rotatedBox(origin, deg, 10, 10, 100, 80));
    cornersById.set('b', rotatedBox(origin, deg, 120, 10, 100, 80));
    cornersById.set('c', rotatedBox(origin, deg, 230, 10, 100, 80));
    childrenOf.set('p', ['a', 'b', 'c']);
    computed.set('p', { display: 'flex', flexDirection: 'row' });
  }
  const screenOfLocal = (x: number, y: number) => {
    const f = frameFromCorners(cornersById.get('p')!)!;
    return f.toScreen({ x, y });
  };

  test('getLayoutLocalFrame + local child rects are the unrotated boxes', () => {
    setupRow();
    const frame = getLayoutLocalFrame('p', 'vp', aabbOf(cornersById.get('p')))!;
    expect(frame.identity).toBe(false);
    const rects = findVisibleChildLocalRects('p', 'vp', frame);
    expect(rects.map(r => Math.round(r.rect.left))).toEqual([10, 120, 230]);
    expect(rects.map(r => Math.round(r.rect.width))).toEqual([100, 100, 100]);
  });

  test('insert index follows the parent axis, not the screen x', () => {
    setupRow();
    // Cursor in the gap between a and b (local x = 115) — after a 40° turn
    // its screen x is far from the AABB midpoints.
    expect(calculateLayoutInsertIndexById(screenOfLocal(115, 50), 'p', 'vp', 'row')).toBe(1);
    expect(calculateLayoutInsertIndexById(screenOfLocal(225, 50), 'p', 'vp', 'row')).toBe(2);
    expect(calculateLayoutInsertIndexById(screenOfLocal(5, 50), 'p', 'vp', 'row')).toBe(0);
    expect(calculateLayoutInsertIndexById(screenOfLocal(335, 50), 'p', 'vp', 'row')).toBe(3);
  });

  test('line segment for index 1 sits in the a→b gap, rotated with the parent', () => {
    setupRow();
    const seg = calculateLineSegment({ parentId: 'p', insertIndex: 1, vpId: 'vp' })!;
    expect(seg.axisAligned).toBe(false);
    const expTop = screenOfLocal(115, 0);
    const expBottom = screenOfLocal(115, 100);
    expect(seg.x1).toBeCloseTo(expTop.x, 4);
    expect(seg.y1).toBeCloseTo(expTop.y, 4);
    expect(seg.x2).toBeCloseTo(expBottom.x, 4);
    expect(seg.y2).toBeCloseTo(expBottom.y, 4);
    // and the segment is tilted by the parent's angle
    const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1) * 180 / Math.PI;
    expect(angle).toBeCloseTo(90 + deg, 4);
  });

  test('axis-aligned parent keeps the classic box geometry', () => {
    cornersById.set('p', rotatedBox({ x: 100, y: 100 }, 0, 0, 0, 340, 100));
    cornersById.set('a', rotatedBox({ x: 100, y: 100 }, 0, 10, 10, 100, 80));
    cornersById.set('b', rotatedBox({ x: 100, y: 100 }, 0, 120, 10, 100, 80));
    childrenOf.set('p', ['a', 'b']);
    computed.set('p', { display: 'flex', flexDirection: 'row' });
    const seg = calculateLineSegment({ parentId: 'p', insertIndex: 1, vpId: 'vp' })!;
    expect(seg.axisAligned).toBe(true);
    expect(seg.x1).toBe(215); expect(seg.x2).toBe(215);
    expect(seg.y1).toBe(100); expect(seg.y2).toBe(200);
  });
});

describe('rotated grid parent', () => {
  test('grid drop picks the row gap in local space and the line follows the rotation', () => {
    const origin = { x: 300, y: 300 };
    const deg = -25;
    cornersById.set('g', rotatedBox(origin, deg, 0, 0, 220, 220));
    cornersById.set('c1', rotatedBox(origin, deg, 10, 10, 90, 90));
    cornersById.set('c2', rotatedBox(origin, deg, 120, 10, 90, 90));
    cornersById.set('c3', rotatedBox(origin, deg, 10, 120, 90, 90));
    cornersById.set('c4', rotatedBox(origin, deg, 120, 120, 90, 90));
    childrenOf.set('g', ['c1', 'c2', 'c3', 'c4']);
    computed.set('g', { display: 'grid' });
    const frame = frameFromCorners(cornersById.get('g')!)!;
    // cursor in the inter-row gap (local y = 110), under the first column
    const r = calculateGridDrop(frame.toScreen({ x: 50, y: 110 }), 'g', 'vp');
    expect(r.insertIndex).toBe(2);
    expect(r.line?.axis).toBe('horizontal');
    expect(r.line?.position).toBeCloseTo(110, 4);
    // cursor in the column gap of row 1 (local x = 110)
    expect(calculateGridDrop(frame.toScreen({ x: 110, y: 50 }), 'g', 'vp').insertIndex).toBe(1);
    const seg = calculateLineSegment({ parentId: 'g', insertIndex: 2, vpId: 'vp' })!;
    const a = frame.toScreen({ x: 0, y: 110 });
    const b = frame.toScreen({ x: 220, y: 110 });
    expect(seg.x1).toBeCloseTo(a.x, 4); expect(seg.y1).toBeCloseTo(a.y, 4);
    expect(seg.x2).toBeCloseTo(b.x, 4); expect(seg.y2).toBeCloseTo(b.y, 4);
  });
});
