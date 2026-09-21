// dynamic-styles.test.ts — the Styles `+` registry stays coherent with the
// rest of the builder: what the menu writes is a style a panel reads back
// (the oracle's STYLE_PROP_NO_CONTROL set), and the row that appears after
// adding is the row the write was meant to surface.

import { describe, it, expect } from 'vitest';
import { DYNAMIC_STYLES } from './dynamic-styles';
import { CONTROLLED_STYLE_PROPS } from '@/code/oracle/checks/surface-dialect';

describe('DYNAMIC_STYLES registry', () => {
  it('ids and labels are unique and non-empty', () => {
    const ids = DYNAMIC_STYLES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spec of DYNAMIC_STYLES) {
      expect(spec.label.trim().length).toBeGreaterThan(0);
      expect(spec.keys.length).toBeGreaterThan(0);
      expect(Object.keys(spec.defaultStyles).length).toBeGreaterThan(0);
    }
  });

  it('every style the + writes is one the oracle knows a control for', () => {
    // Otherwise an AI page carrying the same value the menu writes would be
    // flagged as a dead-end style — the menu and the oracle must agree.
    for (const spec of DYNAMIC_STYLES) {
      for (const key of Object.keys(spec.defaultStyles)) {
        expect(CONTROLLED_STYLE_PROPS.has(key), `${spec.id} writes ${key}`).toBe(true);
      }
    }
  });

  it('every key the + writes is one the row detects, so the row appears', () => {
    for (const spec of DYNAMIC_STYLES) {
      for (const key of Object.keys(spec.defaultStyles)) {
        expect(spec.keys, `${spec.id} writes ${key}`).toContain(key);
      }
    }
  });

  it('Backface adds the meaningful value', () => {
    const backface = DYNAMIC_STYLES.find((s) => s.id === 'backfaceVisibility')!;
    expect(backface.label).toBe('Backface');
    // `visible` is the CSS default — writing it would show a row that does
    // nothing. A flip card's faces need `hidden`.
    expect(backface.defaultStyles).toEqual({ backfaceVisibility: 'hidden' });
    expect(backface.requiresFrame).toBeUndefined();
  });

  it('Blend Mode sits at the bottom of the menu and adds the meaningful value', () => {
    const last = DYNAMIC_STYLES[DYNAMIC_STYLES.length - 1];
    expect(last.id).toBe('mixBlendMode');
    expect(last.label).toBe('Blend Mode');
    // `normal` is the CSS default — a no-op row. `multiply` is what a grain
    // or shadow layer is added for.
    expect(last.defaultStyles).toEqual({ mixBlendMode: 'multiply' });
    // Text blends too (a headline screened over a photo), so no frame gate.
    expect(last.requiresFrame).toBeUndefined();
  });
});
