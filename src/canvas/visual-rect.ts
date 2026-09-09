// visual-rect.ts — the parent-relative LAYOUT-BOX rect of a node in CSS px,
// read through the iframe bridge caches (never the canvas DOM).
//
// Lifted verbatim from PinControl's captureRectViaBridge so the pin toggles,
// the shape position model (resize start / align / X-Y fields) and any future
// writer derive positions from ONE implementation — the rotated-AABB → layout
// box correction below is exactly the kind of math that drifts when copied.

import { getNodesSnapshot, getNodeFromCache } from '@/code/stores/store';
import { transformManager } from '@/canvas/transform';
import { findNodeRect, findNodeComputedStyles, findNodeParentInnerSize } from '@/canvas/node-ops';
import { trace } from '@/shared/debug-trace';
import type { VisualRect } from '@/shared/position-utils';
import { getScreenCornersById } from '@/canvas/resize/geometry-utils';
import { frameFromCorners, localRectOfCorners } from '@/canvas/drag/layout-local-frame';

export function captureVisualRect(nodeId: string, vpId: string): VisualRect | null {
  // IMPERATIVE CACHE FIRST. nodesAtom does not re-derive during a drag
  // (deferred flush), so a canvas node that just ENTERED a frame mid-gesture
  // still reads `parentId: null` from the snapshot — the Position fields then
  // froze at their lift values until the next drag (2026-09-09). The drag
  // strategies keep `moveNodeInCache` current at every enter/exit, and at
  // rest the cache equals the atom, so the cache is the fresher truth here.
  const node = getNodeFromCache(nodeId) ?? getNodesSnapshot().get(nodeId);
  const parentId = node?.parentId;
  if (!parentId) return null;
  const scale = transformManager.getTransform().scale || 1;

  const elScreen = findNodeRect(nodeId, vpId);
  const parentScreen = findNodeRect(parentId, vpId);
  if (!elScreen || !parentScreen) return null;

  const computed = findNodeComputedStyles(nodeId, vpId, ['width', 'height']);
  const width = parseFloat(computed.width) || elScreen.width / scale;
  const height = parseFloat(computed.height) || elScreen.height / scale;

  const parentInner = findNodeParentInnerSize(nodeId, vpId);
  const parentWidth = parentInner.width || parentScreen.width / scale;
  const parentHeight = parentInner.height || parentScreen.height / scale;

  // CSS left/top for absolute children resolve against the parent's PADDING
  // box; the BCR delta is from the border edge — subtract the parent borders.
  const parentBorders = findNodeComputedStyles(parentId, vpId, ['borderLeftWidth', 'borderTopWidth']);
  const borderL = parseFloat(parentBorders.borderLeftWidth) || 0;
  const borderT = parseFloat(parentBorders.borderTopWidth) || 0;

  // Layout-box top-left from the (possibly rotated) screen AABB: with
  // transform-origin 50% 50% the AABB centre IS the layout-box centre, so
  // layoutLeft = aabbCentreX - layoutW / 2 (collapses to the plain formula
  // when un-rotated).
  //
  // ROTATED / SKEWED PARENT: the child's and the parent's screen AABBs are
  // both bounding boxes of tilted quads, so their delta is NOT the child's
  // offset inside the parent (a 1px drag inside a 45° frame jumped the live
  // T/L from 168/29 to 265/79 and back on mouse-up, 2026-09-09). Map the
  // child's painted corners into the parent's own frame (origin = parent's
  // painted TL, axes along its edges) and take the bbox there — its centre is
  // the layout-box centre whatever the child's own rotation.
  let aabbCssW = elScreen.width / scale;
  let aabbCssH = elScreen.height / scale;
  let aabbLeft = (elScreen.left - parentScreen.left) / scale - borderL;
  let aabbTop = (elScreen.top - parentScreen.top) / scale - borderT;
  const parentCorners = getScreenCornersById(parentId, vpId);
  const frame = parentCorners ? frameFromCorners(parentCorners, parentScreen) : null;
  if (frame && !frame.identity) {
    const elCorners = getScreenCornersById(nodeId, vpId);
    if (elCorners) {
      const local = localRectOfCorners(frame, elCorners);
      aabbCssW = local.width / scale;
      aabbCssH = local.height / scale;
      aabbLeft = local.left / scale - borderL;
      aabbTop = local.top / scale - borderT;
    }
  }
  const left = aabbLeft + (aabbCssW - width) / 2;
  const top = aabbTop + (aabbCssH - height) / 2;

  const centerX = left + width / 2;
  const centerY = top + height / 2;
  const centerXPercent = parentWidth > 0 ? (centerX / parentWidth) * 100 : 50;
  const centerYPercent = parentHeight > 0 ? (centerY / parentHeight) * 100 : 50;

  trace.action('visual-rect:capture', { nodeId, vpId, parentId, scale, borderL, borderT, parentWidth, parentHeight, result: { left, top, width, height } });
  return { left, top, width, height, parentWidth, parentHeight, centerXPercent, centerYPercent };
}
