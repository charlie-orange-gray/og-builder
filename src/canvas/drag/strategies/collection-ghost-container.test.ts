// Dragging ANY node inside a CMS collection row hides the row's ghost copies
// (the row itself, or a title / image inside it); a sibling outside the list
// leaves the ghosts alone.
import { describe, it, expect, beforeEach } from 'vitest';
import { seedNodesForCode } from '@/code/stores/store';
import { findCollectionGhostContainer } from './LayoutLiftedStrategy';

const PAGE = `'use client';
import React from 'react';
import rows from '@/cms/rows.json';
export default function Page() {
  return <div data-id="root" style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column' }}>
    <div data-id="list" style={{ display: 'flex', flexDirection: 'column', position: 'relative', order: '0' }}>
      {rows.map((item, index) => (
        <div key={item._slug} data-id="row" style={{ display: 'flex', flexDirection: 'row', position: 'relative', order: '0' }}>
          <img data-id="thumb" src={item.image} style={{ position: 'relative', width: '56px', order: '0' }} />
          <div data-id="copy" style={{ display: 'flex', flexDirection: 'column', position: 'relative', order: '1' }}>
            <p data-id="title" style={{ position: 'relative', order: '0' }}>{item.title}</p>
          </div>
        </div>
      ))}
    </div>
    <div data-id="outside" style={{ position: 'relative', width: '100px', height: '40px', order: '1' }} />
  </div>;
}
`;

describe('findCollectionGhostContainer', () => {
  beforeEach(() => { seedNodesForCode(PAGE); });
  it('the template row itself → the list, as a ROW drag (whole ghost rows hide)', () => {
    expect(findCollectionGhostContainer('row', 'list')).toEqual({ containerId: 'list', isRow: true });
  });
  it('a direct child of the row (thumb) → the list, NOT a row drag (only its copies hide)', () => {
    expect(findCollectionGhostContainer('thumb', 'row')).toEqual({ containerId: 'list', isRow: false });
  });
  it('a deep descendant of the row (title inside copy) → the list, not a row drag', () => {
    expect(findCollectionGhostContainer('title', 'copy')).toEqual({ containerId: 'list', isRow: false });
  });
  it('a node outside the list → null', () => {
    expect(findCollectionGhostContainer('outside', 'root')).toBeNull();
    expect(findCollectionGhostContainer('list', 'root')).toBeNull();
  });
});
