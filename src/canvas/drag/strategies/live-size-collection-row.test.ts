// live-size-collection-row.test.ts — the drag lift must not "correct" a CMS
// template row's size mid-gesture.
//
// The live-size correction exists for STALE CACHES: an offscreen section
// replays remembered geometry, so a component measuring 657px live got lifted
// at a cached 418px and visibly collapsed (2026-07-27). It issues an async
// `getRectAsync` and applies the answer when it lands.
//
// Dragging a COLLECTION-LIST template row breaks that. The drag hides the
// ghost siblings so one row drags cleanly, which leaves the template as the
// only flex child and reflows it to the container's full width. The read is a
// Comlink RPC — its completion is NOT ordered against our own mutations — so
// the answer can describe the post-hide layout instead of the pre-drag one.
//
// Live find 2026-08-11, from the user's trace:
//   layout-lifted:lifted             width 424    ← correct, matches the screen
//   sandbox:collection-ghosts-hidden
//   layout-lifted:live-size-correct  from {w:424} to {w:1328}   ← the whole row
//
// The card visibly exploded to container width on mousedown.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, 'LayoutLiftedStrategy.ts'), 'utf8');
const READ_BLOCK = SRC.slice(SRC.indexOf('const liveSizeReads'), SRC.indexOf('const primaryIdx'));

describe('live-size correction skips collection template rows', () => {
  it('gates the read out BEFORE it is issued', () => {
    expect(READ_BLOCK).toContain('hidesCollectionGhosts');
    expect(READ_BLOCK.indexOf('hidesCollectionGhosts')).toBeLessThan(READ_BLOCK.indexOf('liveSizeReads.set'));
  });

  it('derives the flag from the SAME test the ghost-hide uses', () => {
    // Two different tests would drift: the read would skip rows the hide
    // doesn't touch, or miss rows it does.
    // Both go through ONE helper (findCollectionGhostContainerId), which walks
    // up from the dragged node so a title INSIDE the row hides ghosts too
    // (2026-09-08: ghost titles floated offset while dragging a row title).
    const hoisted = SRC.slice(SRC.indexOf('const ghostScope = findCollectionGhostContainer('), SRC.indexOf('const liveSizeReads'));
    expect(hoisted).toContain('findCollectionGhostContainer(');
    expect(hoisted).toContain('isRow');
    const hideBlock = SRC.slice(SRC.indexOf('const ghostHide = findCollectionGhostContainer('));
    expect(hideBlock.length).toBeGreaterThan(0);
    const helper = SRC.slice(SRC.indexOf('export function findCollectionGhostContainer'), SRC.indexOf('export class LayoutLiftedStrategy'));
    expect(helper).toContain('collectionList');
    expect(helper).toContain('templateIds');
  });

  it('keeps the rotated/scaled skip that was already there', () => {
    expect(READ_BLOCK).toContain('ns0.transform || ns0.rotate');
  });

  it('keeps the correction for every OTHER node — the stale-cache case', () => {
    // The skip must be the collection test alone. A blanket flex-fill skip was
    // tried first and disabled the feature for its own regression fixture
    // (`inst-1`, `flex: '1 0 0px'`), which is exactly the offscreen-component
    // case this correction was written for.
    expect(READ_BLOCK).not.toContain('flexGrow');
    expect(SRC).toContain('layout-lifted:live-size-skip-collection-row');
  });
});
