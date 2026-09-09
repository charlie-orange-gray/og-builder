import { describe, it, expect } from 'vitest';
import { fillClearStyles, isTransparentColor } from './fill-clear';

describe('isTransparentColor', () => {
  it('recognises the no-paint colours only', () => {
    expect(isTransparentColor('transparent')).toBe(true);
    expect(isTransparentColor('rgba(0, 0, 0, 0)')).toBe(true);
    expect(isTransparentColor('rgba(0,0,0,0.0)')).toBe(true);
    expect(isTransparentColor('rgb(0 0 0 / 0)')).toBe(true);
    expect(isTransparentColor('rgba(0, 0, 0, 0.39)')).toBe(false);
    expect(isTransparentColor('#bae1ff')).toBe(false);
    expect(isTransparentColor('')).toBe(false);
  });
});

describe('fillClearStyles', () => {
  it('primary / page: every fill key is deleted', () => {
    const out = fillClearStyles(false, { backgroundColor: '#bae1ff' });
    expect(Object.values(out).every((v) => v === '')).toBe(true);
    expect(out.backgroundColor).toBe('');
  });
  it('non-default variant tile: the painted fill becomes an explicit neutral so the variant stops inheriting it', () => {
    const out = fillClearStyles(true, { backgroundColor: '#bae1ff' });
    expect(out.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(out.backgroundImage).toBe('');
  });
  it('variant tile with a gradient/image fill: image → none too; already-transparent colour needs nothing', () => {
    const out = fillClearStyles(true, { backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'linear-gradient(#000, #fff)' });
    expect(out.backgroundColor).toBe('');
    expect(out.backgroundImage).toBe('none');
  });
});
