// live-inset-writes.ts — which inset properties an ABSOLUTE node's resize
// writes every frame, from the transform-compensated rect. Pure, so the
// axis rules are testable outside the pointer loop.
//
// The two axes are INDEPENDENT. They used to share one if/else chain, so a
// single BOTTOM pin (`bottom: 97px`) returned early and the X axis was never
// written: a left-edge drag on a `left: 25%` + `bottom: 97px` frame grew the
// box out of its RIGHT side while the left edge stayed nailed to the stale %
// (2026-09-08, "pinned bottom only, drag left, it increases to the right").

export interface LiveInsetInputs {
  pins: { left: boolean; right: boolean; top: boolean; bottom: boolean };
  isFixedLeft: boolean;
  isFixedTop: boolean;
  isCenteredX: boolean;
  isCenteredY: boolean;
  isPercentX: boolean;
  isPercentY: boolean;
  handleAffectsX: boolean;
  handleAffectsY: boolean;
  hasTransform: boolean;
  symmetricResize: boolean;
  pW: number;
  pH: number;
  newLeft: number;
  newTop: number;
  newWidth: number;
  newHeight: number;
  startWidth: number;
  startHeight: number;
  posPx: (n: number) => string;
}

export interface LiveInsetWrites {
  styles: Record<string, string>;
  wrotePctLeft: boolean;
  wrotePctTop: boolean;
}

export function liveInsetWrites(i: LiveInsetInputs): LiveInsetWrites {
  const styles: Record<string, string> = {};
  let wrotePctLeft = false;
  let wrotePctTop = false;
  const { pins, pW, pH } = i;
  const pinnedCount = [pins.left, pins.right, pins.top, pins.bottom].filter(Boolean).length;

  if (pinnedCount >= 2) {
    // Multi-pin: recalculate ALL pinned sides from the compensated rect.
    if (pins.left) styles.left = i.posPx(i.newLeft);
    if (pins.right) styles.right = i.posPx(pW - i.newLeft - i.newWidth);
    if (pins.top) styles.top = i.posPx(i.newTop);
    if (pins.bottom) styles.bottom = i.posPx(pH - i.newTop - i.newHeight);
    return { styles, wrotePctLeft, wrotePctTop };
  }

  // ── X axis ──
  if (pins.right) {
    styles.right = i.posPx(pW - i.newLeft - i.newWidth);
  } else if (pins.left || i.isFixedLeft) {
    styles.left = i.posPx(i.newLeft);
  } else if (i.isCenteredX && (i.handleAffectsX || i.hasTransform) && !i.symmetricResize && pW > 0) {
    // Centered x (left:% + translateX(-50%)): the compensation pins against
    // the CONSTANT start matrix while the browser re-derives −50% of the NEW
    // width — the discrepancy is exactly (newWidth−startWidth)/2.
    styles.left = `${(((i.newLeft + (i.newWidth - i.startWidth) / 2) / pW) * 100).toFixed(4)}%`;
    wrotePctLeft = true;
  } else if (i.isPercentX && (i.handleAffectsX || i.hasTransform) && pW > 0) {
    // Plain-% left: newLeft maps 1:1 to the css value.
    styles.left = `${((i.newLeft / pW) * 100).toFixed(4)}%`;
    wrotePctLeft = true;
  }

  // ── Y axis ──
  if (pins.bottom) {
    styles.bottom = i.posPx(pH - i.newTop - i.newHeight);
  } else if (pins.top || i.isFixedTop) {
    styles.top = i.posPx(i.newTop);
  } else if (i.isCenteredY && (i.handleAffectsY || i.hasTransform) && !i.symmetricResize && pH > 0) {
    styles.top = `${(((i.newTop + (i.newHeight - i.startHeight) / 2) / pH) * 100).toFixed(4)}%`;
    wrotePctTop = true;
  } else if (i.isPercentY && (i.handleAffectsY || i.hasTransform) && pH > 0) {
    styles.top = `${((i.newTop / pH) * 100).toFixed(4)}%`;
    wrotePctTop = true;
  }

  return { styles, wrotePctLeft, wrotePctTop };
}
