import { describe, test, expect } from 'vitest';
import { selectionTargetIds } from './multi-select-targets';

describe('selectionTargetIds', () => {
  test('multi-selection containing the bound node → every selected id', () => {
    expect(selectionTargetIds('c', ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
  test('single selection → just the node', () => {
    expect(selectionTargetIds('a', ['a'])).toEqual(['a']);
  });
  test('bound node outside the selection (overlay editor) → just the node', () => {
    expect(selectionTargetIds('ov', ['a', 'b'])).toEqual(['ov']);
  });
  test('empty node id → nothing', () => {
    expect(selectionTargetIds('', ['a', 'b'])).toEqual([]);
  });
});
