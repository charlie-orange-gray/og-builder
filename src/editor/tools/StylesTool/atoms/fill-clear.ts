// fill-clear.ts — what the Fill row's × writes, and what counts as "no fill".
//
// On the PRIMARY (and on page replicas) clearing = delete the keys (''): the
// node falls back to no background. On a component VARIANT tile '' means
// "reset override → inherit default" by contract (ControlLabel's Reset), so
// the × did nothing visible when the default had a fill: the variant just
// kept inheriting the blue (2026-09-08, "can't remove the background on
// variant 2"). There the × must write the explicit CSS NEUTRAL — the same
// values the animate-back seed uses — so the variant paints no fill.

/** A colour that paints nothing: `transparent` or any rgba/hsla with alpha 0. */
export function isTransparentColor(c: string | undefined | null): boolean {
  if (!c) return false;
  const v = c.trim().toLowerCase();
  if (v === 'transparent') return true;
  const m = /^(?:rgba|hsla)\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*(0|0?\.0+)\s*\)$/.exec(v);
  if (m) return true;
  return /^(?:rgb|hsl)\([^/]+\/\s*0(?:\.0+)?%?\s*\)$/.test(v);
}

export const FILL_CLEAR_KEYS = [
  'backgroundColor', 'background', 'backgroundImage', 'backgroundSize',
  'backgroundPosition', 'backgroundRepeat', 'backgroundAttachment', 'backgroundBlendMode',
] as const;

/** The style write for the Fill ×. `onVariantTile` = a NON-default variant of
 *  a component master is being edited; `effective` = the styles the tile shows
 *  (default ⊕ variant), used to decide which neutrals are needed. */
export function fillClearStyles(onVariantTile: boolean, effective: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of FILL_CLEAR_KEYS) out[k] = '';
  if (!onVariantTile) return out;
  // Explicit neutrals ONLY for what the tile currently paints — a sparse
  // variant entry stays sparse (no `backgroundImage: 'none'` on a node that
  // never had an image).
  if (effective.backgroundColor && !isTransparentColor(effective.backgroundColor)) out.backgroundColor = 'rgba(0, 0, 0, 0)';
  if (effective.backgroundImage && effective.backgroundImage !== 'none') out.backgroundImage = 'none';
  if (effective.background) out.background = 'none';
  return out;
}
