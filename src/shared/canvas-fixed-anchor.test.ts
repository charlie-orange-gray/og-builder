// canvas-fixed-anchor.test.ts — a `fixed` node belongs in ONE viewport height.
//
// The canvas converts `fixed` → `absolute` (a transformed ancestor breaks
// fixed positioning), which leaves `bottom` measured from the bottom of the
// whole page: a dock meant to float over the hero rendered 10,000px down,
// past the footer. Anchor it to the first 100vh from the top of the tile
// instead — that is where a real screen would show it.

import { describe, expect, it } from 'vitest';
import { canvasFixedAnchor, simulatedVpHeight } from './responsive-units';

describe('canvasFixedAnchor', () => {
  it('anchors a bottom-fixed node inside the first viewport height', () => {
    const out = canvasFixedAnchor({ position: 'fixed', bottom: '50px' }, 1440)!;
    // 1440 desktop → 900px of simulated viewport; the element's BOTTOM edge
    // lands on 900 − 50, hence top + translateY(-100%).
    expect(simulatedVpHeight(1440)).toBe(900);
    expect(out.top).toBe('850px');
    expect(out.bottom).toBe('auto');
    expect(out.transform).toBe('translateY(-100%)');
  });

  it('keeps an existing transform (pure translations commute)', () => {
    const out = canvasFixedAnchor(
      { position: 'fixed', bottom: '50px', transform: 'translate(-50%)' }, 1440)!;
    expect(out.transform).toBe('translateY(-100%) translate(-50%)');
  });

  it('scales with the tile width, like vh does', () => {
    expect(canvasFixedAnchor({ position: 'fixed', bottom: '0px' }, 809)!.top)
      .toBe(`${Math.round(simulatedVpHeight(809))}px`);
  });

  it('resolves a vh offset before anchoring', () => {
    const out = canvasFixedAnchor({ position: 'fixed', bottom: '10vh' }, 1440)!;
    expect(out.top).toBe('810px');   // 900 − 90
  });

  it('leaves a TOP-anchored fixed node alone (already measured from the top)', () => {
    expect(canvasFixedAnchor({ position: 'fixed', top: '0px', bottom: '50px' }, 1440)).toBeNull();
  });

  it('ignores anything that is not bottom-anchored fixed', () => {
    expect(canvasFixedAnchor({ position: 'absolute', bottom: '50px' }, 1440)).toBeNull();
    expect(canvasFixedAnchor({ position: 'fixed' }, 1440)).toBeNull();
    expect(canvasFixedAnchor({ position: 'fixed', bottom: 'auto' }, 1440)).toBeNull();
  });
});
