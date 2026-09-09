import { describe, it, expect } from 'vitest';
import { compensatedSizeInput, sizeInputWrite, sourceLayoutBox, needsSizeCompensation, translateOffsetPx, parseMatrix2D } from './size-input-compensation';

const ROT90 = 'matrix(0, 1, -1, 0, 0, 0)';
const vis = (x: number, y: number, box: { left: number; top: number; width: number; height: number }, m: { a: number; b: number; c: number; d: number }) => {
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  return { x: cx + m.a * (x - cx) + m.c * (y - cy), y: cy + m.b * (x - cx) + m.d * (y - cy) };
};

describe('compensatedSizeInput', () => {
  it('keeps the VISUAL top-left corner fixed when the width changes on a 90° bar (the user\'s case)', () => {
    const box = { left: 112, top: 610, width: 1119, height: 75.9 };
    const m = parseMatrix2D(ROT90)!;
    const before = vis(box.left, box.top, box, m);
    const { left, top } = compensatedSizeInput(box, 371, 75.9, ROT90);
    const after = vis(left, top, { left, top, width: 371, height: 75.9 }, m);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    // rotated 90°: shrinking the layout width moves the box along the visual Y axis, not X
    expect(left).toBeCloseTo(112 + (1119 - 371) / 2, 6);
  });
  it('is the identity without a rotation', () => {
    expect(compensatedSizeInput({ left: 10, top: 20, width: 100, height: 50 }, 300, 80, 'matrix(1, 0, 0, 1, 0, 0)')).toEqual({ left: 10, top: 20, width: 300, height: 80 });
    expect(needsSizeCompensation('matrix(1, 0, 0, 1, 5, 5)')).toBe(false);
    expect(needsSizeCompensation('none')).toBe(false);
    expect(needsSizeCompensation(ROT90)).toBe(true);
  });
});

describe('translateOffsetPx', () => {
  it('scales a percentage translate with the NEW size', () => {
    expect(translateOffsetPx('translateY(-50%) rotate(90deg)', 'y', 80)).toBe(-40);
    expect(translateOffsetPx('translateY(-50%) rotate(90deg)', 'x', 80)).toBe(0);
    expect(translateOffsetPx('translate(-50%, 10px)', 'x', 200)).toBe(-100);
    expect(translateOffsetPx('translate(-50%, 10px)', 'y', 200)).toBe(10);
  });
});

describe('sizeInputWrite — from SOURCE styles (the DOM is already scrubbed at commit)', () => {
  it('the live case: left px + top 50% + translateY(-50%) rotate(90deg); width 330.753 → 192 keeps the visual top-left, writes width + left + top%', () => {
    const styles = { position: 'absolute', width: '330.753px', height: '59.654px', left: '829px', top: '50.0000%', transform: 'translateY(-50%) rotate(90deg)' };
    const pW = 1119, pH = 671;
    const box = sourceLayoutBox(styles, pW, pH)!;
    // painted top = cssTop + ty = 0.5·pH − h/2
    expect(box.top).toBeCloseTo(335.5 - 59.654 / 2, 6);
    const out = sizeInputWrite({ styles, parentWidth: pW, parentHeight: pH, matrixStr: ROT90, axis: 'width', newValue: 192 })!;
    expect(out.width).toBe('192px');
    // 90°: shrinking the layout width shifts the layout left by (w0 − w1)/2 to keep the visual corner
    expect(parseFloat(out.left)).toBeCloseTo(829 + (330.753 - 192) / 2, 1);
    // …and the visual y moves by the same amount along the bar → re-expressed as the centring % (top is % + translateY(-50%))
    expect(out.top).toMatch(/%$/);
    const m = parseMatrix2D(ROT90)!;
    const before = vis(box.left, box.top, box, m);
    const newBox = { left: parseFloat(out.left), top: (parseFloat(out.top) / 100) * pH - 59.654 / 2, width: 192, height: 59.654 };
    const after = vis(newBox.left, newBox.top, newBox, m);
    expect(after.x).toBeCloseTo(before.x, 1);
    expect(after.y).toBeCloseTo(before.y, 1);
  });
  it('px left + px bottom pins write left + bottom', () => {
    const styles = { position: 'absolute', width: '1119px', height: '75.9px', left: '112px', bottom: '101px', transform: 'translateY(-50%) rotate(90deg)' };
    const out = sizeInputWrite({ styles, parentWidth: 1119, parentHeight: 671, matrixStr: ROT90, axis: 'width', newValue: 371 })!;
    expect(Object.keys(out).sort()).toEqual(['bottom', 'left', 'width']);
    expect(parseFloat(out.left)).toBeCloseTo(112 + (1119 - 371) / 2, 1);
  });
  it('returns null when nothing rotates or the source box is unknowable', () => {
    expect(sizeInputWrite({ styles: { left: '10px', top: '10px', width: '100px', height: '50px' }, parentWidth: 500, parentHeight: 500, matrixStr: 'none', axis: 'width', newValue: 200 })).toBeNull();
    expect(sizeInputWrite({ styles: { left: '10px', top: '10px', width: 'auto', height: '50px', transform: 'rotate(10deg)' }, parentWidth: 500, parentHeight: 500, matrixStr: ROT90, axis: 'width', newValue: 200 })).toBeNull();
  });
});

describe('sizeInputWrite — % sizes', () => {
  it('a % width source box resolves against the parent and the % is written back verbatim', () => {
    const styles = { position: 'absolute', width: '35%', height: '149px', left: '980px', bottom: '119px', transform: 'rotate(90deg)' };
    const pW = 1119, pH = 671;
    const box = sourceLayoutBox(styles, pW, pH)!;
    expect(box.width).toBeCloseTo(0.35 * pW, 6);
    const out = sizeInputWrite({ styles, parentWidth: pW, parentHeight: pH, matrixStr: ROT90, axis: 'width', newValue: 0.2 * pW, writeValue: '20%' })!;
    expect(out.width).toBe('20%');
    expect(parseFloat(out.left)).toBeCloseTo(980 + (0.35 * pW - 0.2 * pW) / 2, 1);
    expect(out.bottom).toBeDefined();
  });
});

describe('zero crossing (chevron past 0)', () => {
  it('unrotated: −60px width mirrors the box to the left of its anchored left edge', () => {
    const styles = { position: 'absolute', width: '100px', height: '50px', left: '200px', top: '100px' };
    const out = sizeInputWrite({ styles, parentWidth: 1000, parentHeight: 800, matrixStr: 'none', axis: 'width', newValue: -60 })!;
    expect(out.width).toBe('60px');
    expect(out.left).toBe('140px');   // right edge of the mirrored box == old left edge
    expect(out.top).toBe('100px');
  });
  it('% value crossing writes the magnitude in %', () => {
    const styles = { position: 'absolute', width: '20%', height: '50px', left: '200px', top: '100px' };
    const out = sizeInputWrite({ styles, parentWidth: 1000, parentHeight: 800, matrixStr: 'none', axis: 'width', newValue: -150, writeValue: '-15%' })!;
    expect(out.width).toBe('15%');
    expect(out.left).toBe('50px');
  });
  it('rotated 90°: the original visual top-left stays fixed through the crossing', () => {
    const styles = { position: 'absolute', width: '300px', height: '60px', left: '500px', top: '300px', transform: 'rotate(90deg)' };
    const box = sourceLayoutBox(styles, 1119, 671)!;
    const m = parseMatrix2D(ROT90)!;
    const before = vis(box.left, box.top, box, m);
    const r = compensatedSizeInput(box, -120, 60, ROT90);
    // the mirrored box's top-RIGHT corner is the anchor
    const after = vis(r.left + r.width, r.top, { left: r.left, top: r.top, width: r.width, height: r.height }, m);
    expect(r.width).toBe(120);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });
});
