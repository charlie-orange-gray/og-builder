// unfold-flow-sizing.ts — what a flow child wears once its layout frame is
// unfolded into a layout grandparent (unfoldChildren CASE 3: both have
// layout). Pure; unit-tested.
//
// The child's sizing was written AGAINST THE FRAME: `flex: 3 0 0px` filled the
// frame's column, `width: 100%` filled its cross axis. Re-parented into a ROW
// grandparent the same declarations mean something else — the flex grow now
// fights the row siblings for WIDTH and the height (nothing declared) resolves
// to auto → 0px: a frame with only a background image vanished (user report
// 2026-09-09). Two rules:
//
//   • SINGLE child: it takes the frame's slot 1:1 — inherit the frame's own
//     sizing in the grandparent (flex, width/height, min/max, alignSelf) and
//     its `order`, so the layout doesn't move.
//   • SEVERAL children: each keeps the size it PAINTED — any axis whose size
//     came from the frame (fill/percent/stretch) is baked to measured px and
//     the flex becomes fixed; explicit px/fit sizes stay.

export interface UnfoldFlowInput {
  frameStyles: Record<string, string>;
  childStyles: Record<string, string>;
  /** Painted size of the child in CSS px (bridge rect / canvas scale). */
  measured: { width: number; height: number } | null;
  siblingCount: number;
}

const FRAME_SLOT_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'alignSelf', 'justifySelf'] as const;

function flexGrowOf(s: Record<string, string>): number {
  if (s.flexGrow) return parseFloat(s.flexGrow) || 0;
  const parts = (s.flex ?? '').trim().split(/\s+/);
  return parts[0] ? parseFloat(parts[0]) || 0 : 0;
}

function frameAxis(frameStyles: Record<string, string>): 'row' | 'column' {
  const d = frameStyles.display ?? '';
  if (d === 'grid' || d === 'inline-grid') return 'column';
  const dir = frameStyles.flexDirection ?? 'row';
  return dir.startsWith('column') ? 'column' : 'row';
}

const isRelative = (v: string | undefined) => !!v && /%$/.test(v.trim());
const isFitLike = (v: string | undefined) => !!v && /^(auto|fit-content|min-content|max-content)/.test(v.trim());

/** True when the child's size on `axis` was supplied by the frame, not by
 *  its own declaration (flex fill on the main axis, % / stretch on either). */
export function axisSizedByFrame(axis: 'width' | 'height', frameStyles: Record<string, string>, childStyles: Record<string, string>): boolean {
  const v = childStyles[axis];
  if (isRelative(v)) return true;
  const main = frameAxis(frameStyles) === 'row' ? 'width' : 'height';
  if (axis === main) {
    if (flexGrowOf(childStyles) > 0) return true;
    return !v || isFitLike(v) ? false : false;
  }
  // Cross axis: no declaration = stretch (default align-items) unless the
  // frame opted out with a non-stretch alignment.
  const align = childStyles.alignSelf || frameStyles.alignItems || 'stretch';
  return !v && align === 'stretch';
}

export function unfoldFlowStyles(i: UnfoldFlowInput): Record<string, string> {
  const f = i.frameStyles;
  const c = i.childStyles;
  const out: Record<string, string> = { position: 'relative', left: '', top: '' };
  if (f.order !== undefined) out.order = f.order;
  if (i.siblingCount <= 1) {
    for (const k of FRAME_SLOT_KEYS) out[k] = f[k] ?? '';
    // A frame that wore no flex at all sat as `0 0 auto` in its parent; the
    // child must not keep a grow that now points at the grandparent's axis.
    if (!f.flex && !f.flexGrow && !f.flexBasis) out.flex = '0 0 auto';
    return out;
  }
  out.flex = '0 0 auto';
  for (const axis of ['width', 'height'] as const) {
    if (axisSizedByFrame(axis, f, c) && i.measured) {
      out[axis] = `${Math.round(i.measured[axis])}px`;
    }
  }
  if (c.alignSelf) out.alignSelf = '';
  return out;
}
