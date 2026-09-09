// live-pin-values.ts — what the Position fields show DURING a canvas
// interaction, derived so they agree with the source before, during and
// after the gesture.
//
// Before (2026-09-09): the live poll turned the raw screen rect into four px
// numbers for every side. On a ROTATED element that rect is the painted
// bounding box, so a mere canvas PAN flipped `T 50 (%) · L 18 · R – · B –`
// into `T -224 · L 496 · R 460 · B -224`, held them after the pan (nothing
// committed, so nothing cleared them), and a drag ended with the fields
// jumping back to the source values on mouse-up.
//
// Rules: values come from the LAYOUT box (captureVisualRect undoes the
// rotation), each side is expressed in the unit the SOURCE uses (px stays px,
// `50%` stays a %), and a side the source does not set is not shown live at
// all — the field keeps showing what it shows at rest.

import { translateOffsetPx } from '@/canvas/resize/size-input-compensation';

export interface LivePinInput {
  styles: Record<string, string>;
  /** Layout box as painted (CSS px, parent space, includes the translate). */
  rect: { left: number; top: number; width: number; height: number };
  parentWidth: number;
  parentHeight: number;
}

const isPx = (v: string | undefined) => !!v && /^-?[\d.]+px$/.test(v.trim());
const isPct = (v: string | undefined) => !!v && /^-?[\d.]+%$/.test(v.trim());
const px = (n: number) => `${Math.round(n * 1000) / 1000}px`;
const pct = (n: number, total: number) => `${(Math.round((n / total) * 100 * 10000) / 10000)}%`;

/** Live values for exactly the sides the source declares, in the source's unit. */
export function livePinValues(i: LivePinInput): Record<string, string> {
  const s = i.styles;
  const cssLeft = i.rect.left - translateOffsetPx(s.transform, 'x', i.rect.width);
  const cssTop = i.rect.top - translateOffsetPx(s.transform, 'y', i.rect.height);
  const out: Record<string, string> = {};
  if (isPx(s.left)) out.left = px(cssLeft);
  else if (isPct(s.left) && i.parentWidth > 0) out.left = pct(cssLeft, i.parentWidth);
  if (isPx(s.right)) out.right = px(i.parentWidth - cssLeft - i.rect.width);
  else if (isPct(s.right) && i.parentWidth > 0) out.right = pct(i.parentWidth - cssLeft - i.rect.width, i.parentWidth);
  if (isPx(s.top)) out.top = px(cssTop);
  else if (isPct(s.top) && i.parentHeight > 0) out.top = pct(cssTop, i.parentHeight);
  if (isPx(s.bottom)) out.bottom = px(i.parentHeight - cssTop - i.rect.height);
  else if (isPct(s.bottom) && i.parentHeight > 0) out.bottom = pct(i.parentHeight - cssTop - i.rect.height, i.parentHeight);
  return out;
}
