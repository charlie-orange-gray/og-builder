// Pasting an instance of the ACTIVE master into that master is refused before
// any rule runs — a master rendering itself recurses forever (2026-09-08).
import { describe, it, expect } from 'vitest';
import { executePaste } from './paste';
import type { ClipboardNode } from './types';

const instance: ClipboardNode = {
  id: 'Header-inst-1', type: 'Header', parentId: null, children: [], order: 0,
  styles: { position: 'relative', width: '300px' }, name: 'Header', componentFile: 'components/Header.tsx',
} as ClipboardNode;

describe('paste — component cycle guard', () => {
  it('refuses an instance of the active master with a user-facing message and creates nothing', () => {
    const result = executePaste({
      selectedIds: [], nodes: new Map(), activeFilePath: 'components/Header.tsx',
      overrideClipboard: { nodes: [instance], sourceFilePath: 'app/page.client.tsx' } as any,
    } as any);
    expect(result.success).toBe(false);
    expect(result.createdIds).toEqual([]);
    expect(result.message).toContain('own master');
    expect(result.userFacing).toBe(true);
  });
});
