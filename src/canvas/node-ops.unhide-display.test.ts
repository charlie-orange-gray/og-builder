// Unhiding a component node must not delete a display it legitimately has.
//
// The eye on a component layer writes `display: ''` alongside the
// setVariantVisibility gate, to clear a stale baked `display: 'none'`. But `''`
// means DELETE the property (invariant #3), so on a node that was hidden by the
// render gate alone it deleted the element's real display. Unhiding the
// Hamburger Menu Button on the desktop stripped `display: 'flex'` from its
// inline style AND its `default` variant entry, so the burger's three bars
// collapsed into one on every variant — the user read it as their mobile
// overrides being replaced by the desktop's (2026-09-18).

import { describe, it, expect } from 'vitest';
import { hasBakedDisplayNone } from './node-ops';

describe('hasBakedDisplayNone', () => {
  it('is false for a node hidden by the render gate alone — nothing to clear', () => {
    const node = {
      styles: { display: 'flex', alignItems: 'center' },
      motionVariants: { default: { display: 'flex' }, 'variant-2': { gap: '8px' } },
    };
    expect(hasBakedDisplayNone(node, 'default', true)).toBe(false);
    expect(hasBakedDisplayNone(node, 'variant-2', false)).toBe(false);
  });

  it('is true for an inline display:none', () => {
    expect(hasBakedDisplayNone({ styles: { display: 'none' } }, 'default', true)).toBe(true);
  });

  it('is true when the targeted variant entry carries it', () => {
    const node = { styles: {}, motionVariants: { default: {}, 'variant-2': { display: 'none' } } };
    expect(hasBakedDisplayNone(node, 'variant-2', false)).toBe(true);
    // …and not when a DIFFERENT variant does and we are unhiding one variant.
    expect(hasBakedDisplayNone(node, 'variant-1', false)).toBe(false);
  });

  it('sweeps every variant when the PRIMARY is unhidden (it shows everywhere)', () => {
    const node = { styles: {}, motionVariants: { default: {}, 'variant-2': { display: 'none' } } };
    expect(hasBakedDisplayNone(node, 'default', true)).toBe(true);
  });

  it('treats a missing variants object as nothing to clear', () => {
    expect(hasBakedDisplayNone({ styles: { display: 'grid' }, motionVariants: null }, 'default', true)).toBe(false);
  });
});
