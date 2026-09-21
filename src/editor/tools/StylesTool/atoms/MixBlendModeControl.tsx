// MixBlendModeControl.tsx — Self-contained mix-blend-mode ToolAtom.
// How the WHOLE element composites with what is painted behind it — a
// grain overlay multiplied onto a photo, a logo screened over a dark hero.
// Distinct from the Fill panel's per-layer blend (backgroundBlendMode),
// which only mixes an element's own fill layers with each other. Same
// select shape as User Select; the option list is the Fill panel's, so the
// two Blend menus read the same. `normal` is the CSS default.

import { ToolSelect } from '../../../controls';
import { UnifiedControlProvider, ControlRow, useControlContext } from '../../../controls/unified';
import type { AtomProps } from '../../../controls/unified/types';

export const MIX_BLEND_MODE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
];

function MixBlendModeAtom() {
  const { value, onChange } = useControlContext();
  return (
    <ToolSelect
      value={value || 'normal'}
      onChange={onChange}
      options={MIX_BLEND_MODE_OPTIONS}
    />
  );
}

export function MixBlendModeControl({ mode = 'direct', ...mp }: AtomProps) {
  return (
    <UnifiedControlProvider property="mixBlendMode" defaultValue="normal" mode={mode} {...mp}>
      <ControlRow label="Blend Mode"><MixBlendModeAtom /></ControlRow>
    </UnifiedControlProvider>
  );
}
