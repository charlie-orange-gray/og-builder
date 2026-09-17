// BackfaceControl.tsx — Self-contained backface-visibility ToolAtom.
// Whether the element's back face paints when a 3D rotate turns it away
// from the viewer. `visible` is the CSS default; `hidden` is what a flip
// card needs (front and back faces stacked, each hiding its own back so
// only the face turned towards the viewer paints). Same segmented shape as
// Preserve 3D — the two travel together on 3D transforms.

import { ToolSegmentedControl } from '../../../controls';
import { UnifiedControlProvider, ControlRow, useControlContext } from '../../../controls/unified';
import type { AtomProps } from '../../../controls/unified/types';

const BACKFACE_OPTIONS = [
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
];

function BackfaceAtom() {
  const { value, onChange } = useControlContext();
  return (
    <div className="w-full">
      <ToolSegmentedControl
        value={value === 'hidden' ? 'hidden' : 'visible'}
        onChange={onChange}
        options={BACKFACE_OPTIONS}
        size="sm" />
    </div>
  );
}

export function BackfaceControl({ mode = 'direct', ...mp }: AtomProps) {
  return (
    <UnifiedControlProvider property="backfaceVisibility" defaultValue="visible" mode={mode} {...mp}>
      <ControlRow label="Backface"><BackfaceAtom /></ControlRow>
    </UnifiedControlProvider>
  );
}
