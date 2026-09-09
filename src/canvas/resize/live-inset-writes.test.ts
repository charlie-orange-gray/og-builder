import { describe, it, expect } from 'vitest';
import { liveInsetWrites, type LiveInsetInputs } from './live-inset-writes';

const px = (n: number) => `${Math.round(n)}px`;
const base: LiveInsetInputs = {
  pins: { left: false, right: false, top: false, bottom: false },
  isFixedLeft: false, isFixedTop: false, isCenteredX: false, isCenteredY: false, isPercentX: false, isPercentY: false,
  handleAffectsX: true, handleAffectsY: false, hasTransform: false, symmetricResize: false,
  pW: 1440, pH: 900,
  // left-edge drag 100px to the LEFT on a 763px-wide box at left 367px, bottom 97px (height 127, top 676)
  newLeft: 267, newTop: 676, newWidth: 863, newHeight: 127, startWidth: 763, startHeight: 127,
  posPx: px,
};

describe('liveInsetWrites — axes are independent', () => {
  it('bottom-only pin + percent left: a left-edge drag re-aims left as % AND keeps bottom (the 2026-09-08 bug)', () => {
    const w = liveInsetWrites({ ...base, pins: { ...base.pins, bottom: true }, isPercentX: true });
    expect(w.styles.left).toBe(`${((267 / 1440) * 100).toFixed(4)}%`);
    expect(w.styles.bottom).toBe(px(900 - 676 - 127));
    expect(w.wrotePctLeft).toBe(true);
  });
  it('bottom-only pin + px left: writes left px and bottom', () => {
    const w = liveInsetWrites({ ...base, pins: { ...base.pins, bottom: true }, isFixedLeft: true });
    expect(w.styles).toEqual({ left: '267px', bottom: px(900 - 676 - 127) });
  });
  it('right-only pin + fixed top: writes right and top', () => {
    const w = liveInsetWrites({ ...base, pins: { ...base.pins, right: true }, isFixedTop: true, handleAffectsY: true });
    expect(w.styles).toEqual({ right: px(1440 - 267 - 863), top: '676px' });
  });
  it('two pins: every pinned side is recomputed, nothing else', () => {
    const w = liveInsetWrites({ ...base, pins: { left: true, right: false, top: false, bottom: true }, isPercentX: true });
    expect(w.styles).toEqual({ left: '267px', bottom: px(900 - 676 - 127) });
    expect(w.wrotePctLeft).toBe(false);
  });
  it('centered x keeps the (newWidth−startWidth)/2 correction; alt/symmetric skips it', () => {
    const w = liveInsetWrites({ ...base, isCenteredX: true });
    expect(w.styles.left).toBe(`${(((267 + (863 - 763) / 2) / 1440) * 100).toFixed(4)}%`);
    expect(liveInsetWrites({ ...base, isCenteredX: true, symmetricResize: true }).styles.left).toBeUndefined();
  });
  it('a vertical-only drag does not touch a plain-% left unless a transform couples the axes', () => {
    expect(liveInsetWrites({ ...base, isPercentX: true, handleAffectsX: false, handleAffectsY: true }).styles.left).toBeUndefined();
    expect(liveInsetWrites({ ...base, isPercentX: true, handleAffectsX: false, handleAffectsY: true, hasTransform: true }).styles.left).toBeDefined();
  });
});
