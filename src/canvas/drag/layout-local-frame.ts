// layout-local-frame.ts — the layout parent's OWN (unrotated) coordinate
// frame, for every "where between the children does this drop land"
// consumer: the drop-line insert index (flex + grid) and the
// DropLineIndicator geometry.
//
// The bridge's rectCache holds post-transform axis-aligned bounding boxes.
// For a rotated / skewed layout parent those AABBs overlap each other and
// their midpoints no longer walk the flex axis, so a mouse-vs-midpoint scan
// in screen space picks the wrong gap and the indicator draws an
// axis-aligned line that cuts diagonally through the children. Standard
// tool behaviour: the line follows the parent's rotation and sits exactly in
// the gap the drop will use.
//
// Approach: read the parent's painted quad from the cornersCache, build the
// affine map screen ⇄ parent-local (origin = painted TL, x along the top
// edge, y along the left edge, in screen-pixel units), express every child
// as a local axis-aligned rect (bbox of its mapped corners) and the mouse
// as a local point, run the SAME 1D / row-major gap maths as before, then
// map the resulting segment back to screen. For an axis-aligned parent the
// frame is the identity and every consumer keeps its previous behaviour
// byte for byte (AABB rects, no corner reads).

import type { Point, ScreenCorners } from '@/shared/types';
import { findVisibleChildRects } from '@/canvas/node-ops';
import { cornersAreAxisAligned, getScreenCornersById } from '@/canvas/resize/geometry-utils';
import { trace } from '@/shared/debug-trace';

export interface LayoutLocalFrame {
  /** True when the parent paints axis-aligned — mapping is a no-op. */
  identity: boolean;
  /** Screen point of the parent's painted top-left. */
  origin: Point;
  /** Screen vectors of one local px along the parent's x / y axes. */
  ux: Point;
  uy: Point;
  /** Parent's own box in local space (origin 0,0). */
  parentRect: DOMRect;
  toLocal(p: Point): Point;
  toScreen(p: Point): Point;
}

const IDENTITY_BASIS = { ux: { x: 1, y: 0 }, uy: { x: 0, y: 1 } };

/** Plain DOMRect-compatible record (works in jsdom + any test env). */
export function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left, y: top, left, top, width, height,
    right: left + width, bottom: top + height,
    toJSON() { return { left, top, width, height }; },
  } as DOMRect;
}

function identityFrame(parentRect: DOMRect): LayoutLocalFrame {
  return {
    identity: true,
    origin: { x: 0, y: 0 },
    ...IDENTITY_BASIS,
    parentRect,
    toLocal: p => p,
    toScreen: p => p,
  };
}

/** Build the frame from a painted quad. Exported for tests + callers that
 *  already hold the corners. Returns null for a degenerate quad. */
export function frameFromCorners(corners: ScreenCorners, fallbackRect?: DOMRect | null): LayoutLocalFrame | null {
  if (cornersAreAxisAligned(corners)) {
    const rect = fallbackRect ?? makeRect(
      Math.min(corners.TL.x, corners.TR.x), Math.min(corners.TL.y, corners.BL.y),
      Math.abs(corners.TR.x - corners.TL.x), Math.abs(corners.BL.y - corners.TL.y),
    );
    return identityFrame(rect);
  }
  const ex = { x: corners.TR.x - corners.TL.x, y: corners.TR.y - corners.TL.y };
  const ey = { x: corners.BL.x - corners.TL.x, y: corners.BL.y - corners.TL.y };
  const w = Math.hypot(ex.x, ex.y);
  const h = Math.hypot(ey.x, ey.y);
  if (w < 1e-6 || h < 1e-6) return null;
  // Unit basis: one LOCAL px along each painted edge. Skew keeps the two
  // axes non-orthogonal — the 2×2 inverse below handles that exactly.
  const ux = { x: ex.x / w, y: ex.y / w };
  const uy = { x: ey.x / h, y: ey.y / h };
  const det = ux.x * uy.y - ux.y * uy.x;
  if (Math.abs(det) < 1e-9) return null;
  const origin = { x: corners.TL.x, y: corners.TL.y };
  return {
    identity: false,
    origin, ux, uy,
    parentRect: makeRect(0, 0, w, h),
    toLocal: p => {
      const dx = p.x - origin.x;
      const dy = p.y - origin.y;
      return {
        x: (dx * uy.y - dy * uy.x) / det,
        y: (ux.x * dy - ux.y * dx) / det,
      };
    },
    toScreen: p => ({
      x: origin.x + p.x * ux.x + p.y * uy.x,
      y: origin.y + p.x * ux.y + p.y * uy.y,
    }),
  };
}

/** The layout parent's local frame. `parentRect` (screen AABB) is what the
 *  identity frame reports as the parent box, so axis-aligned callers see the
 *  exact rect they used before. Null when the parent has no geometry. */
export function getLayoutLocalFrame(parentId: string, vpId: string, parentRect: DOMRect | null): LayoutLocalFrame | null {
  const corners = getScreenCornersById(parentId, vpId);
  if (!corners) return parentRect ? identityFrame(parentRect) : null;
  const frame = frameFromCorners(corners, parentRect);
  if (frame && !frame.identity) {
    trace.fn('layout-local-frame:rotated', { parentId, vpId, w: Math.round(frame.parentRect.width), h: Math.round(frame.parentRect.height) });
  }
  return frame;
}

/** Local axis-aligned bbox of a painted quad. */
export function localRectOfCorners(frame: LayoutLocalFrame, corners: ScreenCorners): DOMRect {
  const pts = [corners.TL, corners.TR, corners.BR, corners.BL].map(frame.toLocal);
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return makeRect(left, top, Math.max(...xs) - left, Math.max(...ys) - top);
}

/** `findVisibleChildRects` expressed in the parent's local frame. Identity
 *  frame → the screen AABBs verbatim (no corner reads). Rotated frame → each
 *  child's painted corners mapped into local space; a child without cached
 *  corners falls back to mapping its AABB (correct whenever the child
 *  carries no transform of its own beyond the parent's). */
export function findVisibleChildLocalRects(
  parentId: string,
  vpId: string,
  frame: LayoutLocalFrame,
): Array<{ id: string; rect: DOMRect }> {
  const screen = findVisibleChildRects(parentId, vpId);
  if (frame.identity) return screen;
  return screen.map(c => {
    const corners = getScreenCornersById(c.id, vpId);
    return { id: c.id, rect: corners ? localRectOfCorners(frame, corners) : c.rect };
  });
}

/** A drop-line segment in screen space (already mapped through the frame). */
export interface DropLineSegment {
  x1: number; y1: number; x2: number; y2: number;
  /** True when the segment is axis-aligned (identity frame) — the
   *  indicator can render it as a plain box. */
  axisAligned: boolean;
}

/** Map a local axis-parallel line to a screen segment. */
export function segmentFromLocal(
  frame: LayoutLocalFrame,
  axis: 'horizontal' | 'vertical',
  position: number,
  start: number,
  end: number,
): DropLineSegment {
  const a = axis === 'horizontal' ? { x: start, y: position } : { x: position, y: start };
  const b = axis === 'horizontal' ? { x: end, y: position } : { x: position, y: end };
  const sa = frame.toScreen(a);
  const sb = frame.toScreen(b);
  return { x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y, axisAligned: frame.identity };
}
