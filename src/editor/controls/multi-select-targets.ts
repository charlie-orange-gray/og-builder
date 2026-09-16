// multi-select-targets.ts — which nodes a panel write should hit.
//
// The outer ControlProvider fans `updateStyle` / `updateMultipleStyles` out to
// every selected id, so ordinary style atoms are multi-select safe for free.
// Controls that write through their OWN node-scoped mutations (border
// overlay `::after` rules, pseudo-element styles, SVG shape attrs, video
// fill) bypass that fan-out and used to hit only the node the panel was
// bound to — the LAST selected one (user report 2026-09-09: a 32px overlay
// border on a 3-node selection painted on one node). Route those writes
// through here so they behave like every other control.

import { getDefaultStore } from 'jotai';
import { selectedIdsAtom } from '@/code/stores/store';

/** All selected ids when `nodeId` is part of a multi-selection, else just
 *  `[nodeId]` (single select, or a panel bound to a node outside the
 *  selection — e.g. an overlay editor). */
export function selectionTargetIds(nodeId: string, selected: readonly string[] = getDefaultStore().get(selectedIdsAtom)): string[] {
  if (!nodeId) return [];
  if (selected.length > 1 && selected.includes(nodeId)) return [...selected];
  return [nodeId];
}

export function forSelectionTargets(nodeId: string, fn: (id: string) => void): void {
  for (const id of selectionTargetIds(nodeId)) fn(id);
}
