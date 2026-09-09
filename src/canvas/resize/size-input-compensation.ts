// size-input-compensation.ts — typing a Width / Height into the Dimensions
// panel on a TRANSFORMED absolute element behaves like the ResizeManager's
// bottom-right handle: the element's own top-left corner (in its rotated
// frame) stays visually fixed, exactly as a handle drag pins the opposite
// corner. Before (2026-09-08) the panel wrote the bare width/height, so with
// transform-origin at the centre a 90°-rotated bar slid along its axis on
// every value change.
//
// Same model as ResizeManager's transform compensation (canvas-math
// getTransformedPoint): with pivot P (box centre) and 2×2 matrix M, the visual
// position of a layout point q is P + M·(q − P). Keep the visual top-left
// fixed across the size change → solve for the new layout left/top.

export interface LayoutBox { left: number; top: number; width: number; height: number }

export function parseMatrix2D(matrixStr: string | undefined | null): { a: number; b: number; c: number; d: number } | null {
  if (!matrixStr || matrixStr === 'none') return null;
  const m = matrixStr.match(/matrix\(([-\d.e+]+),\s*([-\d.e+]+),\s*([-\d.e+]+),\s*([-\d.e+]+),\s*([-\d.e+]+),\s*([-\d.e+]+)\)/);
  if (!m) return null;
  return { a: parseFloat(m[1]), b: parseFloat(m[2]), c: parseFloat(m[3]), d: parseFloat(m[4]) };
}

/** Rotation / skew / flip present (a pure translate or scale needs no compensation). */
export function needsSizeCompensation(matrixStr: string | undefined | null): boolean {
  const m = parseMatrix2D(matrixStr);
  if (!m) return false;
  return Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6 || m.a < 0 || m.d < 0;
}

function visualPoint(x: number, y: number, box: LayoutBox, m: { a: number; b: number; c: number; d: number }): { x: number; y: number } {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const dx = x - cx, dy = y - cy;
  return { x: cx + m.a * dx + m.c * dy, y: cy + m.b * dx + m.d * dy };
}

/** New layout left/top for the resized box such that the VISUAL top-left
 *  corner stays where it was. `box` is the current layout box (CSS px, parent
 *  space, as painted — i.e. including any translate). */
export function compensatedSizeInput(box: LayoutBox, newWidth: number, newHeight: number, matrixStr: string): { left: number; top: number; width: number; height: number } {
  // ZERO CROSSING (the resize handle's rule): a size driven past 0 mirrors
  // the box across the anchored edge — the ORIGINAL top-left corner stays
  // put and becomes the box's top-right (or bottom-left) corner. CSS has no
  // negative size; the chevron scrub used to write `-34px` (2026-09-09).
  const mirrorX = newWidth < 0;
  const mirrorY = newHeight < 0;
  const w = Math.abs(newWidth);
  const h = Math.abs(newHeight);
  const m = parseMatrix2D(matrixStr) ?? { a: 1, b: 0, c: 0, d: 1 };
  const fixed = visualPoint(box.left, box.top, box, m);
  const trial: LayoutBox = { left: mirrorX ? box.left - w : box.left, top: mirrorY ? box.top - h : box.top, width: w, height: h };
  // The corner of the NEW box that must land on the old visual top-left.
  const anchorX = mirrorX ? trial.left + w : trial.left;
  const anchorY = mirrorY ? trial.top + h : trial.top;
  const moved = visualPoint(anchorX, anchorY, trial, m);
  return { left: trial.left + (fixed.x - moved.x), top: trial.top + (fixed.y - moved.y), width: w, height: h };
}

/** Existing translate offset in px for the NEW size (a `-50%` scales with the box). */
export function translateOffsetPx(transform: string | undefined, axis: 'x' | 'y', size: number): number {
  if (!transform) return 0;
  const pair = transform.match(/translate\(\s*([^,)]+)(?:,\s*([^)]+))?\)/i);
  const single = axis === 'x' ? transform.match(/translateX\(\s*([^)]+)\)/i) : transform.match(/translateY\(\s*([^)]+)\)/i);
  const raw = single ? single[1].trim() : pair ? (axis === 'x' ? pair[1] : (pair[2] ?? '0')).trim() : null;
  if (!raw) return 0;
  if (/%$/.test(raw)) return (parseFloat(raw) / 100) * size || 0;
  return parseFloat(raw) || 0;
}

export interface SizeInputWriteArgs {
  /** SOURCE styles — the original box is derived from these, never from the
   *  DOM: the chevron scrub has already patched the DOM width live by the
   *  time the commit runs, so a DOM-measured box is post-change and the
   *  compensation collapses to a no-op (2026-09-08, second report). */
  styles: Record<string, string>;
  parentWidth: number;
  parentHeight: number;
  /** Computed transform matrix string. */
  matrixStr: string;
  axis: 'width' | 'height';
  /** The typed value, px (already resolved from % by the caller when needed). */
  newValue: number;
  /** The value to WRITE for the axis — the typed string in its own unit
   *  ('35%' stays a %); defaults to `newValue` px. */
  writeValue?: string;
  /** Fallback for anything the source can't answer (auto size, no inset). */
  fallbackBox?: LayoutBox;
}

const isPx = (v: string | undefined) => !!v && /^-?[\d.]+px$/.test(v.trim());
const isPct = (v: string | undefined) => !!v && /^-?[\d.]+%$/.test(v.trim());
const num = (v: string | undefined) => parseFloat(v ?? '') || 0;

/** The ORIGINAL layout box (CSS px, parent space, as PAINTED = with translate)
 *  from the source styles. Exported for the tests. */
export function sourceLayoutBox(styles: Record<string, string>, parentWidth: number, parentHeight: number, fallback?: LayoutBox): LayoutBox | null {
  // Source size: px, or % of the parent (the Dimensions unit toggle).
  const w = isPx(styles.width) ? num(styles.width) : isPct(styles.width) ? (num(styles.width) / 100) * parentWidth : fallback?.width;
  const h = isPx(styles.height) ? num(styles.height) : isPct(styles.height) ? (num(styles.height) / 100) * parentHeight : fallback?.height;
  if (!(w! > 0) || !(h! > 0)) return null;
  const tx = translateOffsetPx(styles.transform, 'x', w!);
  const ty = translateOffsetPx(styles.transform, 'y', h!);
  let cssLeft: number | undefined;
  if (isPx(styles.left)) cssLeft = num(styles.left);
  else if (isPct(styles.left)) cssLeft = (num(styles.left) / 100) * parentWidth;
  else if (isPx(styles.right)) cssLeft = parentWidth - num(styles.right) - w!;
  else if (isPct(styles.right)) cssLeft = parentWidth - (num(styles.right) / 100) * parentWidth - w!;
  else if (fallback) cssLeft = fallback.left - tx;
  let cssTop: number | undefined;
  if (isPx(styles.top)) cssTop = num(styles.top);
  else if (isPct(styles.top)) cssTop = (num(styles.top) / 100) * parentHeight;
  else if (isPx(styles.bottom)) cssTop = parentHeight - num(styles.bottom) - h!;
  else if (isPct(styles.bottom)) cssTop = parentHeight - (num(styles.bottom) / 100) * parentHeight - h!;
  else if (fallback) cssTop = fallback.top - ty;
  if (cssLeft == null || cssTop == null) return null;
  return { left: cssLeft + tx, top: cssTop + ty, width: w!, height: h! };
}

/**
 * The style write for a Dimensions-panel size change on a transformed
 * absolute element: the new size plus the insets that keep the element's
 * VISUAL top-left fixed (the resize handle's opposite-corner rule). Every
 * positioning form the builder writes is re-expressed: px left/top, px
 * right/bottom, and the % + translate(-50%) centering channel. Null = no
 * compensation applies (no rotation/skew, or the box is unknowable).
 */
export function sizeInputWrite(a: SizeInputWriteArgs): Record<string, string> | null {
  // No rotation AND no zero crossing → the plain size write is exact.
  if (!needsSizeCompensation(a.matrixStr) && a.newValue >= 0) return null;
  const box = sourceLayoutBox(a.styles, a.parentWidth, a.parentHeight, a.fallbackBox);
  if (!box) return null;
  const { left, top, width: newWidth, height: newHeight } = compensatedSizeInput(
    box, a.axis === 'width' ? a.newValue : box.width, a.axis === 'height' ? a.newValue : box.height, a.matrixStr,
  );
  // The painted box includes the translate; CSS left/top exclude it (at the NEW size).
  const cssLeft = left - translateOffsetPx(a.styles.transform, 'x', newWidth);
  const cssTop = top - translateOffsetPx(a.styles.transform, 'y', newHeight);
  const r2 = (n: number) => `${Math.round(n * 100) / 100}px`;
  const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(4)}%`;
  const out: Record<string, string> = {};
  // A crossed size is written as its magnitude (CSS has no negative size).
  const wv = a.writeValue ?? r2(a.newValue);
  out[a.axis] = a.newValue < 0 ? wv.replace(/^-/, '') : wv;
  const s = a.styles;
  if (isPx(s.left)) out.left = r2(cssLeft);
  else if (isPct(s.left) && a.parentWidth > 0) out.left = pct(cssLeft, a.parentWidth);
  else if (isPx(s.right)) out.right = r2(a.parentWidth - cssLeft - newWidth);
  else if (isPct(s.right) && a.parentWidth > 0) out.right = pct(a.parentWidth - cssLeft - newWidth, a.parentWidth);
  if (isPx(s.top)) out.top = r2(cssTop);
  else if (isPct(s.top) && a.parentHeight > 0) out.top = pct(cssTop, a.parentHeight);
  else if (isPx(s.bottom)) out.bottom = r2(a.parentHeight - cssTop - newHeight);
  else if (isPct(s.bottom) && a.parentHeight > 0) out.bottom = pct(a.parentHeight - cssTop - newHeight, a.parentHeight);
  return out;
}
