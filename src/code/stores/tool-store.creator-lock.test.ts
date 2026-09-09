import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import { toolModeAtom, creatorToolsLockedAtom, isCreatorToolMode } from './tool-store';

// Translation mode (non-default locale active) must make creator tools inert
// everywhere — toolbar clicks, shortcuts and programmatic writes all go
// through toolModeAtom's setter.
describe('creator tool lock', () => {
  it('ignores creator modes while locked, still allows select / hand', () => {
    const store = createStore();
    store.set(creatorToolsLockedAtom, true);
    for (const m of ['frame', 'text', 'layout-rows', 'shape-triangle', 'sketch'] as const) {
      store.set(toolModeAtom, m as any);
      expect(store.get(toolModeAtom)).toBe('select');
    }
    store.set(toolModeAtom, 'hand' as any);
    expect(store.get(toolModeAtom)).toBe('hand');
  });
  it('lets creator modes through when unlocked', () => {
    const store = createStore();
    store.set(toolModeAtom, 'frame' as any);
    expect(store.get(toolModeAtom)).toBe('frame');
    expect(isCreatorToolMode('frame')).toBe(true);
    expect(isCreatorToolMode('select')).toBe(false);
  });
});
