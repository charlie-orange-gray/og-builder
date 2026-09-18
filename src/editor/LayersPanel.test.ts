import { describe, test, expect } from 'vitest';
import { computeSelectionSets, overlayExpandPath, type FlatLayer } from './LayersPanel';
import type { CanvasNode } from '@/code/parsing/parser';

// ─── Test helpers ──────────────────────────────────────────────────────────

function makeNode(id: string, children: string[] = [], parentId: string | null = null): CanvasNode {
  return {
    id,
    type: 'div',
    name: id,
    parentId,
    children,
    styles: {},
    attrs: {},
    textContent: '',
    hasMixedContent: false,
    order: 0,
    isCanvasNode: false,
    componentFile: null,
    componentInstanceId: null,
    isComponentRoot: false,
    motionVariants: null,
    motionVariantsRef: null,
    motionProps: null,
    responsiveVariantMap: null,
    conditionalStyles: null,
  };
}

function makeLayer(id: string, nodeId: string | null = null): FlatLayer {
  return {
    id,
    nodeId,
    node: makeNode(nodeId ?? id),
    depth: 0,
    hasChildren: false,
    isExpanded: false,
  };
}

// ─── computeSelectionSets ──────────────────────────────────────────────────

describe('computeSelectionSets', () => {
  test('returns empty sets when no selection', () => {
    const result = computeSelectionSets(null, [], new Map());
    expect(result.childOfSelectedSet.size).toBe(0);
    expect(result.highlightedChildrenSet.size).toBe(0);
    expect(result.lastHighlightedChildSet.size).toBe(0);
  });

  test('returns empty sets for selection without colon separator', () => {
    const result = computeSelectionSets('invalid', [], new Map());
    expect(result.childOfSelectedSet.size).toBe(0);
  });

  test('returns empty sets when selected node not in nodes map', () => {
    const result = computeSelectionSets('desktop:missing', [], new Map());
    expect(result.childOfSelectedSet.size).toBe(0);
  });

  test('collects direct children of selected node as childOfSelected', () => {
    const nodes = new Map<string, CanvasNode>();
    nodes.set('parent', makeNode('parent', ['child1', 'child2']));
    nodes.set('child1', makeNode('child1', [], 'parent'));
    nodes.set('child2', makeNode('child2', [], 'parent'));

    const layers: FlatLayer[] = [
      makeLayer('desktop:parent', 'parent'),
      makeLayer('desktop:child1', 'child1'),
      makeLayer('desktop:child2', 'child2'),
    ];

    const result = computeSelectionSets('desktop:parent', layers, nodes);
    expect(result.childOfSelectedSet.has('desktop:child1')).toBe(true);
    expect(result.childOfSelectedSet.has('desktop:child2')).toBe(true);
    expect(result.childOfSelectedSet.has('desktop:parent')).toBe(false);
  });

  test('collects deep descendants as childOfSelected', () => {
    const nodes = new Map<string, CanvasNode>();
    nodes.set('root', makeNode('root', ['a']));
    nodes.set('a', makeNode('a', ['b'], 'root'));
    nodes.set('b', makeNode('b', ['c'], 'a'));
    nodes.set('c', makeNode('c', [], 'b'));

    const layers: FlatLayer[] = [
      makeLayer('desktop:root', 'root'),
      makeLayer('desktop:a', 'a'),
      makeLayer('desktop:b', 'b'),
      makeLayer('desktop:c', 'c'),
    ];

    const result = computeSelectionSets('desktop:root', layers, nodes);
    expect(result.childOfSelectedSet.has('desktop:a')).toBe(true);
    expect(result.childOfSelectedSet.has('desktop:b')).toBe(true);
    expect(result.childOfSelectedSet.has('desktop:c')).toBe(true);
  });

  test('highlightedChildren set includes selectedLayerId when children are visible', () => {
    const nodes = new Map<string, CanvasNode>();
    nodes.set('parent', makeNode('parent', ['child1']));
    nodes.set('child1', makeNode('child1', [], 'parent'));

    const layers: FlatLayer[] = [
      makeLayer('desktop:parent', 'parent'),
      makeLayer('desktop:child1', 'child1'),
    ];

    const result = computeSelectionSets('desktop:parent', layers, nodes);
    expect(result.highlightedChildrenSet.has('desktop:parent')).toBe(true);
  });

  test('highlightedChildren does NOT include selectedLayerId when children are collapsed (not in layers)', () => {
    const nodes = new Map<string, CanvasNode>();
    nodes.set('parent', makeNode('parent', ['child1']));
    nodes.set('child1', makeNode('child1', [], 'parent'));

    // child1 is NOT in the layers list (collapsed)
    const layers: FlatLayer[] = [
      makeLayer('desktop:parent', 'parent'),
    ];

    const result = computeSelectionSets('desktop:parent', layers, nodes);
    expect(result.highlightedChildrenSet.has('desktop:parent')).toBe(false);
  });

  test('lastHighlightedChild marks the last consecutive child-of-selected in layers', () => {
    const nodes = new Map<string, CanvasNode>();
    nodes.set('parent', makeNode('parent', ['child1', 'child2']));
    nodes.set('child1', makeNode('child1', [], 'parent'));
    nodes.set('child2', makeNode('child2', [], 'parent'));
    nodes.set('sibling', makeNode('sibling', []));

    const layers: FlatLayer[] = [
      makeLayer('desktop:parent', 'parent'),
      makeLayer('desktop:child1', 'child1'),
      makeLayer('desktop:child2', 'child2'),
      makeLayer('desktop:sibling', 'sibling'), // not a child of selected
    ];

    const result = computeSelectionSets('desktop:parent', layers, nodes);
    expect(result.lastHighlightedChildSet.has('desktop:child1')).toBe(false);
    expect(result.lastHighlightedChildSet.has('desktop:child2')).toBe(true);
  });

  test('lastHighlightedChild marks last item when it is at end of layers', () => {
    const nodes = new Map<string, CanvasNode>();
    nodes.set('parent', makeNode('parent', ['child1']));
    nodes.set('child1', makeNode('child1', [], 'parent'));

    const layers: FlatLayer[] = [
      makeLayer('desktop:parent', 'parent'),
      makeLayer('desktop:child1', 'child1'),
    ];

    const result = computeSelectionSets('desktop:parent', layers, nodes);
    expect(result.lastHighlightedChildSet.has('desktop:child1')).toBe(true);
  });

  test('viewport-scoped: only children in same viewport are collected', () => {
    const nodes = new Map<string, CanvasNode>();
    nodes.set('parent', makeNode('parent', ['child1']));
    nodes.set('child1', makeNode('child1', [], 'parent'));

    const layers: FlatLayer[] = [
      makeLayer('desktop:parent', 'parent'),
      makeLayer('desktop:child1', 'child1'),
      makeLayer('tablet:parent', 'parent'),
      makeLayer('tablet:child1', 'child1'),
    ];

    // Select in desktop viewport only
    const result = computeSelectionSets('desktop:parent', layers, nodes);
    expect(result.childOfSelectedSet.has('desktop:child1')).toBe(true);
    // tablet:child1 is still in childOf because collectDescendants uses the viewport prefix
    // from the selected layer, so tablet children won't match the desktop prefix
    expect(result.childOfSelectedSet.has('tablet:child1')).toBe(false);
  });

  test('leaf node selection: no children, no highlighted children', () => {
    const nodes = new Map<string, CanvasNode>();
    nodes.set('leaf', makeNode('leaf', []));

    const layers: FlatLayer[] = [
      makeLayer('desktop:leaf', 'leaf'),
    ];

    const result = computeSelectionSets('desktop:leaf', layers, nodes);
    expect(result.childOfSelectedSet.size).toBe(0);
    expect(result.highlightedChildrenSet.size).toBe(0);
    expect(result.lastHighlightedChildSet.size).toBe(0);
  });
});

// ─── computeRangeSelection (shift+click range, the reference/Figma model) ─────────────

import { computeRangeSelection } from './LayersPanel';

const noRedirect = () => null;

/** Row list + node map for: root > [f1(c1), f2, f3, f4, f5] with c1 visible. */
function rangeFixture() {
  const nodes = new Map<string, CanvasNode>([
    ['root', makeNode('root', ['f1', 'f2', 'f3', 'f4', 'f5'])],
    ['f1', makeNode('f1', ['c1'], 'root')],
    ['c1', makeNode('c1', [], 'f1')],
    ['f2', makeNode('f2', [], 'root')],
    ['f3', makeNode('f3', [], 'root')],
    ['f4', makeNode('f4', [], 'root')],
    ['f5', makeNode('f5', [], 'root')],
  ]);
  const row = (nodeId: string): FlatLayer => ({
    id: `desktop:${nodeId}`, nodeId, node: nodes.get(nodeId)!,
    depth: 0, hasChildren: false, isExpanded: false,
  });
  const header: FlatLayer = { ...makeLayer('__vp_desktop', null) };
  const rows = [header, row('f1'), row('c1'), row('f2'), row('f3'), row('f4'), row('f5')];
  return { nodes, rows };
}

describe('computeRangeSelection', () => {
  test('anchor frame 1 → target frame 5 selects every visible row in order', () => {
    const { nodes, rows } = rangeFixture();
    const result = computeRangeSelection(rows, 'desktop:f1', 'desktop:f5', nodes, noRedirect);
    expect(result).toEqual(['f1', 'c1', 'f2', 'f3', 'f4', 'f5']);
  });

  test('reverse direction (anchor 5 → target 1) selects the same range', () => {
    const { nodes, rows } = rangeFixture();
    const result = computeRangeSelection(rows, 'desktop:f5', 'desktop:f1', nodes, noRedirect);
    expect(result).toEqual(['f1', 'c1', 'f2', 'f3', 'f4', 'f5']);
  });

  test('EVERY visible row in the span is selected — nested rows included', () => {
    const { nodes, rows } = rangeFixture();
    const result = computeRangeSelection(rows, 'desktop:f1', 'desktop:f3', nodes, noRedirect);
    expect(result).toEqual(['f1', 'c1', 'f2', 'f3']); // c1 is visible in the span
  });

  test('deep child → ancestor selects everything on the way up (parent+descendant pairs allowed)', () => {
    const { nodes, rows } = rangeFixture();
    // Anchor at the expanded child c1, target its grandparent-level sibling
    // range going UP to f1 (c1's own parent): both endpoints + span selected.
    const result = computeRangeSelection(rows, 'desktop:c1', 'desktop:f1', nodes, noRedirect);
    expect(result).toEqual(['f1', 'c1']);
  });

  test('range starting AT a child keeps the child', () => {
    const { nodes, rows } = rangeFixture();
    const result = computeRangeSelection(rows, 'desktop:c1', 'desktop:f3', nodes, noRedirect);
    expect(result).toEqual(['c1', 'f2', 'f3']);
  });

  test('viewport header rows inside the range are skipped', () => {
    const { nodes, rows } = rangeFixture();
    // Header is row 0; put anchor before it is impossible — instead splice a
    // header between f2 and f3 to prove mid-range headers are skipped.
    const midHeader: FlatLayer = { ...makeLayer('__vp_tablet', null) };
    const spliced = [...rows.slice(0, 4), midHeader, ...rows.slice(4)];
    const result = computeRangeSelection(spliced, 'desktop:f1', 'desktop:f5', nodes, noRedirect);
    expect(result).toEqual(['f1', 'c1', 'f2', 'f3', 'f4', 'f5']);
  });

  test('no anchor → null (caller falls back to toggle)', () => {
    const { nodes, rows } = rangeFixture();
    expect(computeRangeSelection(rows, null, 'desktop:f5', nodes, noRedirect)).toBeNull();
    expect(computeRangeSelection(rows, 'desktop:gone', 'desktop:f5', nodes, noRedirect)).toBeNull();
  });

  test('anchor === target → null', () => {
    const { nodes, rows } = rangeFixture();
    expect(computeRangeSelection(rows, 'desktop:f2', 'desktop:f2', nodes, noRedirect)).toBeNull();
  });
});

// ─── Entering overlay edit mode reveals the overlay in the tree ─────────────
//
// An overlay row is displayed under its TRIGGER, not its real parent. The
// existing auto-expand walks the real parent chain from the SELECTED node, so
// it can't reveal an overlay — and entering overlay mode need not change the
// selection at all. Most visible on a component instance, which is a forced
// leaf showing only the overlay it triggers: the subtree stayed collapsed with
// no way to see the layers being edited (user report 2026-09-18).
describe('overlayExpandPath', () => {
  const overlayAttrs = (triggerId: string) => ({ 'data-overlay': JSON.stringify({ triggerId }) });

  function tree(): Map<string, CanvasNode> {
    // root › navbar (component instance) › — and the overlay, whose REAL
    // parent is root but which displays under the navbar that triggers it.
    const nodes = new Map<string, CanvasNode>();
    nodes.set('root', { ...makeNode('root', ['navbar', 'ov']) });
    nodes.set('navbar', { ...makeNode('navbar', [], 'root'), isComponentInstance: true } as CanvasNode);
    nodes.set('ov', { ...makeNode('ov', ['inner'], 'root'), attrs: overlayAttrs('navbar') } as CanvasNode);
    nodes.set('inner', { ...makeNode('inner', [], 'ov') });
    return nodes;
  }

  test('expands the viewport, the overlay and the TRIGGER chain', () => {
    const path = overlayExpandPath(tree(), 'ov', 'desktop');
    expect(path).toContain('__vp_desktop');
    expect(path).toContain('desktop:ov');       // the overlay, so its children show
    expect(path).toContain('desktop:navbar');   // the instance it displays under
    expect(path).toContain('desktop:root');
  });

  test('falls back to the real parent when the overlay has no trigger', () => {
    const nodes = tree();
    nodes.set('ov', { ...makeNode('ov', ['inner'], 'root'), attrs: {} } as CanvasNode);
    const path = overlayExpandPath(nodes, 'ov', 'desktop');
    expect(path).toEqual(['__vp_desktop', 'desktop:ov', 'desktop:root']);
  });

  test('ignores a trigger that is not in the tree, and a malformed spec', () => {
    const nodes = tree();
    nodes.set('ov', { ...makeNode('ov', [], 'root'), attrs: { 'data-overlay': JSON.stringify({ triggerId: 'gone' }) } } as CanvasNode);
    expect(overlayExpandPath(nodes, 'ov', 'desktop')).toEqual(['__vp_desktop', 'desktop:ov', 'desktop:root']);
    nodes.set('ov', { ...makeNode('ov', [], 'root'), attrs: { 'data-overlay': 'not json' } } as CanvasNode);
    expect(overlayExpandPath(nodes, 'ov', 'desktop')).toEqual(['__vp_desktop', 'desktop:ov', 'desktop:root']);
  });

  test('returns nothing for an overlay that is not in the tree', () => {
    expect(overlayExpandPath(tree(), 'missing', 'desktop')).toEqual([]);
  });

  test('survives a parent cycle', () => {
    const nodes = new Map<string, CanvasNode>();
    nodes.set('a', { ...makeNode('a', [], 'b') });
    nodes.set('b', { ...makeNode('b', [], 'a') });
    nodes.set('ov', { ...makeNode('ov', [], 'a'), attrs: overlayAttrs('a') } as CanvasNode);
    expect(() => overlayExpandPath(nodes, 'ov', 'desktop')).not.toThrow();
  });
});
