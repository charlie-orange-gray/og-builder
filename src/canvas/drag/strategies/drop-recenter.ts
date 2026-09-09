// drop-recenter.ts — the post-drop correction that puts an AUTO-sized drop
// under the cursor.
//
// The toolbar/library drop centres the new node on the cursor using its
// authored px size, falling back to the item's GHOST size (200×120 for a
// component) when width/height are auto / min-content. A hugging button is
// 136×41, so it landed offset by half the ghost (2026-09-08). The real size
// only exists after the first render, so the drop is corrected once the
// bridge can measure it: shift left/top by the difference between where the
// element's centre painted and where the cursor was.

export interface RecenterInput {
  /** Painted rect of the new node in SCREEN space (bridge parent-space). */
  rect: { left: number; top: number; width: number; height: number };
  /** Cursor at drop, screen space. */
  mouseScreen: { x: number; y: number };
  /** Canvas zoom — screen px per CSS px. */
  scale: number;
  /** The left/top that were written (CSS px). */
  writtenLeft: number;
  writtenTop: number;
  /** Largest plausible correction (CSS px) — the ghost assumption can be off
   *  by at most half the ghost plus half the real box, so a delta beyond
   *  this means the node was measured mid-layout (first paint at the
   *  origin, structural render still pending) and must NOT be applied. */
  maxShift?: number;
}

/** New left/top (CSS px) that centre the painted box on the cursor, or null
 *  when the drop is already within a pixel (no write, no history entry). */
export function recenteredPosition(i: RecenterInput): { left: number; top: number } | null {
  const scale = i.scale || 1;
  if (!(i.rect.width > 0) || !(i.rect.height > 0)) return null;
  const cx = i.rect.left + i.rect.width / 2;
  const cy = i.rect.top + i.rect.height / 2;
  const dx = (i.mouseScreen.x - cx) / scale;
  const dy = (i.mouseScreen.y - cy) / scale;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
  if (i.maxShift != null && (Math.abs(dx) > i.maxShift || Math.abs(dy) > i.maxShift)) return null;
  return { left: Math.round(i.writtenLeft + dx), top: Math.round(i.writtenTop + dy) };
}
