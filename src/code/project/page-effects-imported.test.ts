import { describe, it, expect } from 'vitest';
import { pageEffectFromImportedSpec } from './page-effects-config';

describe('pageEffectFromImportedSpec', () => {
  it('keeps the imported site\'s own opacity, timing and easing', () => {
    const e = pageEffectFromImportedSpec({
      exit: { opacity: 0, duration: 0.2, delay: 0.2, bezier: [0.27, 0, 0.51, 1] },
      enter: { opacity: 0, duration: 0.2, delay: 0, bezier: [0.27, 0, 0.51, 1] },
    })!;
    expect(e.target).toBe('all');
    expect(e.exit!.opacity).toBe(0);
    expect(e.exit!.transition).toMatchObject({ duration: 0.2, delay: 0.2, ease: 'custom', bezier: [0.27, 0, 0.51, 1] });
    expect(e.enter!.transition).toMatchObject({ duration: 0.2, delay: 0 });
    // Exit starts only once the enter has finished → the sequenced shape.
    expect(e.preset).toBe('fade-out-in');
  });

  it('reads overlapping sides as a crossfade, and identity channels stay identity', () => {
    const e = pageEffectFromImportedSpec({
      exit: { opacity: 0, duration: 0.4, delay: 0 },
      enter: { opacity: 0, duration: 0.4, delay: 0 },
    })!;
    expect(e.preset).toBe('crossfade');
    expect(e.exit!.scale).toBe(1);
    expect(e.exit!.offsetX).toBe(0);
  });

  it('is null when the site has no transition', () => {
    expect(pageEffectFromImportedSpec({})).toBeNull();
  });
});

describe('pageEffectFromImportedSpec — moving channels', () => {
  it('carries offsets, scale and rotation, and names the shape custom', () => {
    const e = pageEffectFromImportedSpec({
      enter: { offsetX: 100, offsetUnit: 'relative', scale: 0.9, rotateZ: 12, duration: 0.5, delay: 0 },
    })!;
    expect(e.preset).toBe('custom');
    expect(e.enter).toMatchObject({ offsetX: 100, offsetXUnit: 'relative', scale: 0.9, rotateZ: 12, rotate: '2d' });
    expect(e.enter!.transition.duration).toBe(0.5);
  });

  it('switches to 3D rotation when the site rotates off the Z axis', () => {
    const e = pageEffectFromImportedSpec({ enter: { rotateY: 30, duration: 0.3 } })!;
    expect(e.enter).toMatchObject({ rotate: '3d', rotateY: 30, rotateX: 0 });
  });
});
