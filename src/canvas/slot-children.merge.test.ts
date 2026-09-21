// Slot wiring that lives in another FILE than the page being rendered.
//
// A slot connection is recorded in the file owning both ends. The canvas
// renders one merged tree, where a template's nodes arrive `layout::`-prefixed
// and a component instance's arrive `${instanceId}:`-prefixed at any depth. A
// Marquee placed in a TEMPLATE therefore showed its "Connect Content"
// placeholder on every page using that template — the page's own code says
// nothing about the wiring (2026-09-18).

import { describe, it, expect } from 'vitest';
import { mergeSlotConnections } from './slot-children';

const m = (o: Record<string, string[]>) => new Map(Object.entries(o));

describe('mergeSlotConnections', () => {
  it('keeps the page\'s own connections untouched', () => {
    const out = mergeSlotConnections(m({ 'marquee-1': ['cn-a', 'cn-b'] }), []);
    expect(out.get('marquee-1')).toEqual(['cn-a', 'cn-b']);
  });

  it('re-keys a TEMPLATE\'s wiring with the layout prefix, both ends', () => {
    const out = mergeSlotConnections(m({}), [
      { prefix: 'layout::', connections: m({ 'marquee-1': ['cn-a', 'cn-b'] }) },
    ]);
    expect(out.get('layout::marquee-1')).toEqual(['layout::cn-a', 'layout::cn-b']);
    expect(out.has('marquee-1')).toBe(false);
  });

  it('re-keys a nested instance with its full path', () => {
    const out = mergeSlotConnections(m({}), [
      { prefix: 'outer-1:inner-2:', connections: m({ 'marquee-1': ['cn-a'] }) },
    ]);
    expect(out.get('outer-1:inner-2:marquee-1')).toEqual(['outer-1:inner-2:cn-a']);
  });

  it('merges a template and an instance in the same tree', () => {
    const out = mergeSlotConnections(m({ 'page-mq': ['cn-p'] }), [
      { prefix: 'layout::', connections: m({ 'tpl-mq': ['cn-t'] }) },
      { prefix: 'card-1:', connections: m({ 'comp-mq': ['cn-c'] }) },
    ]);
    expect([...out.keys()].sort()).toEqual(['card-1:comp-mq', 'layout::tpl-mq', 'page-mq']);
  });

  it('concatenates rather than overwrites when one component is reached twice', () => {
    const out = mergeSlotConnections(m({}), [
      { prefix: 'card-1:', connections: m({ mq: ['cn-a'] }) },
      { prefix: 'card-1:', connections: m({ mq: ['cn-b'] }) },
    ]);
    expect(out.get('card-1:mq')).toEqual(['card-1:cn-a', 'card-1:cn-b']);
  });
});
