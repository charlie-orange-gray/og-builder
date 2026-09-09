import { describe, it, expect } from 'vitest';
import { recenteredPosition } from './drop-recenter';

describe('recenteredPosition', () => {
  it('moves an auto-sized drop so its painted centre sits under the cursor (ghost 200×120 vs real 136×41)', () => {
    // written left/top assumed a 200×120 box centred on the cursor at (500, 300) @ scale 1
    // → left 400, top 240; the real 136×41 box painted at (400, 240)
    const out = recenteredPosition({
      rect: { left: 400, top: 240, width: 136, height: 41 }, mouseScreen: { x: 500, y: 300 }, scale: 1,
      writtenLeft: 400, writtenTop: 240,
    });
    expect(out).toEqual({ left: 432, top: 280 });
  });
  it('divides the screen delta by the canvas scale', () => {
    const out = recenteredPosition({
      rect: { left: 100, top: 100, width: 50, height: 50 }, mouseScreen: { x: 175, y: 175 }, scale: 0.5,
      writtenLeft: 10, writtenTop: 20,
    });
    // centre painted at (125,125); cursor (175,175); delta 50 screen px = 100 css px
    expect(out).toEqual({ left: 110, top: 120 });
  });
  it('no-op when already centred or when the box has no size yet', () => {
    expect(recenteredPosition({ rect: { left: 0, top: 0, width: 100, height: 100 }, mouseScreen: { x: 50.4, y: 49.6 }, scale: 1, writtenLeft: 0, writtenTop: 0 })).toBeNull();
    expect(recenteredPosition({ rect: { left: 0, top: 0, width: 0, height: 0 }, mouseScreen: { x: 50, y: 50 }, scale: 1, writtenLeft: 0, writtenTop: 0 })).toBeNull();
  });
});

describe('recenteredPosition — maxShift guard', () => {
  it('rejects a correction larger than the ghost box (a mid-layout measurement)', () => {
    expect(recenteredPosition({
      rect: { left: 0, top: 800, width: 50, height: 15 }, mouseScreen: { x: 500, y: 300 }, scale: 1,
      writtenLeft: 400, writtenTop: 240, maxShift: 200,
    })).toBeNull();
  });
  it('accepts a correction within the ghost box', () => {
    expect(recenteredPosition({
      rect: { left: 400, top: 240, width: 136, height: 41 }, mouseScreen: { x: 500, y: 300 }, scale: 1,
      writtenLeft: 400, writtenTop: 240, maxShift: 200,
    })).toEqual({ left: 432, top: 280 });
  });
});
