// A code component in a TEMPLATE must resolve its slot on every page.
//
// The template's nodes merge into the page tree `layout::`-prefixed, but two
// things stay behind in the template FILE: the slot wiring, and the canvas
// nodes it points at (the template merge drops those deliberately — they are
// off-canvas authoring artifacts and would render as stray boxes beside every
// page). So a Marquee placed in a template rendered its "Connect Content"
// placeholder on every page using it, while resolving fine with the template
// itself open (2026-09-18). This walks the same chain CodeComponentHost does.

import { describe, it, expect } from 'vitest';
import { getAllSlotConnections } from '@/code/generation/slot-ops';
import { parseProjectFile } from '@/code/parsing/project-parser';
import { projectFS } from '@/code/project/project-fs';
import { mergeSlotConnections, serializeSlotChildren } from './slot-children';
import type { CanvasNode } from '@/code/parsing/parser';

const TEMPLATE_PATH = 'app/(Body)/LayoutClient.tsx';
const TEMPLATE = `'use client';
import Marquee from '@/components/Marquee';

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  return <div data-id="tpl-root" style={{ display: 'flex', flexDirection: 'column' }}>
    <Marquee data-id="marquee-1" data-name="Marquee" speed={40}>{cn_ticker_1}</Marquee>
    {children}
  </div>;
}
const cn_ticker_1 = <div data-id="ticker-1" data-canvas-node="true" data-name="Ticker" style={{ position: 'absolute', left: '-2000px', top: '0px' }}><p data-id="ticker-text-1">WORLDWIDE SHIPPING</p></div>;
`;

/** The template's canvas-node subtrees, `layout::`-prefixed — what the host builds. */
function templateSlotNodes(parsed: Map<string, CanvasNode>): Map<string, CanvasNode> {
  const out = new Map<string, CanvasNode>();
  const take = (id: string) => {
    const n = parsed.get(id);
    if (!n || out.has('layout::' + id)) return;
    out.set('layout::' + id, {
      ...n, id: 'layout::' + id,
      parentId: n.parentId ? 'layout::' + n.parentId : null,
      children: n.children.map((c) => 'layout::' + c),
    } as CanvasNode);
    n.children.forEach(take);
  };
  for (const [id, n] of parsed) if (n.isCanvasNode) take(id);
  return out;
}

describe('a slot-bearing code component inside a template', () => {
  projectFS.writeFile(TEMPLATE_PATH, TEMPLATE);
  const parsed = parseProjectFile(TEMPLATE_PATH, projectFS);

  it('parses the template\'s connection and its canvas node', () => {
    expect(getAllSlotConnections(TEMPLATE).get('marquee-1')).toEqual(['ticker-1']);
    expect(parsed.get('ticker-1')?.isCanvasNode).toBe(true);
  });

  it('resolves the slot with the ids the PAGE tree uses', () => {
    // The page's own code knows nothing about any of this.
    const connections = mergeSlotConnections(new Map(), [
      { prefix: 'layout::', connections: getAllSlotConnections(TEMPLATE) },
    ]);
    const connectedIds = connections.get('layout::marquee-1') ?? [];
    expect(connectedIds).toEqual(['layout::ticker-1']);

    const kids = serializeSlotChildren(connectedIds, templateSlotNodes(parsed), connections);
    expect(kids).toHaveLength(1);
    // …and the real content travels with it, not a placeholder.
    expect(JSON.stringify(kids)).toContain('WORLDWIDE SHIPPING');
  });

  it('serializes nothing when the page tree alone is consulted (the bug)', () => {
    const pageOnly = mergeSlotConnections(new Map(), []);
    expect(pageOnly.get('layout::marquee-1')).toBeUndefined();
    expect(serializeSlotChildren([], new Map(), pageOnly)).toEqual([]);
  });
});
