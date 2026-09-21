// dynamic-styles.ts — the Styles tool's `+` registry: every addable style,
// how to detect it on a node, and what the menu writes. Pure data, no
// React — so a test can hold it against the oracle's controlled-props set
// (what the + writes must be a style some panel reads back).

// ─── Dynamic-style registry ─────────────────────────────────────────────────
//
// One entry per addable style. `keys` lists the CSS properties to check
// when deciding whether the row is already "set" on the node. `defaultStyles`
// is what the +-dropdown writes when the user picks the row — sensible
// no-ops or safe placeholders, chosen so the row appears with a recognisable
// preview the user can then refine. `requiresFrame` flags entries that
// only make sense on frame-like elements (Mask/ClipPath/Filter on text are
// noisy and the original code already gated them).
//
// NOTE: Pseudo is NOT in this registry — it has its own `pseudoStylesAtom`
// detection and the PseudoElementControl ships its own "Add ::before /
// Add ::after" affordance, so the row needs to render whenever a pseudo
// rule exists for the node, period.

export interface DynamicStyleSpec {
  id: string;
  label: string;
  /** CSS properties any of which means "this style is in use on this node". */
  keys: string[];
  /** What to write when the user picks this from the +-dropdown. */
  defaultStyles: Record<string, string>;
  /** Hide on text nodes (matches the existing `!isText` gates). */
  requiresFrame?: boolean;
}

export const DYNAMIC_STYLES: DynamicStyleSpec[] = [
  {
    id: 'overflowX',
    label: 'Overflow X',
    keys: ['overflowX'],
    // 'hidden' is the most common reason to set overflowX explicitly — visible
    // is already the default, so writing it would be a no-op.
    defaultStyles: { overflowX: 'hidden' },
  },
  {
    id: 'overflowY',
    label: 'Overflow Y',
    keys: ['overflowY'],
    defaultStyles: { overflowY: 'hidden' },
  },
  {
    id: 'mask',
    label: 'Mask',
    // Multiple keys because the Mask control reads several variants.
    keys: ['mask', 'maskImage', 'WebkitMask', 'WebkitMaskImage'],
    // Transparent → opaque vertical fade so the user immediately SEES a
    // mask effect when the row appears. The previous `black, black` default
    // was a no-op that left both gradient stops opaque — once parsed
    // through gradient-utils, every subsequent edit (rotation, stop drag)
    // re-emitted a black/black gradient, and the user could never make the
    // mask visible without manually replacing the value. Match
    // MaskControl.handleAdd's add-another-entry default so both entry
    // points produce the same visible starting gradient.
    defaultStyles: { maskImage: 'linear-gradient(0deg, rgba(0,0,0,0) 0%, rgb(0,0,0) 100%)', WebkitMaskImage: 'linear-gradient(0deg, rgba(0,0,0,0) 0%, rgb(0,0,0) 100%)' },
    requiresFrame: true,
  },
  {
    id: 'clipPath',
    label: 'Clip Path',
    keys: ['clipPath'],
    // `inset(0)` is the identity clip — clips nothing — so the row appears
    // visibly no-op until the user picks a real shape.
    defaultStyles: { clipPath: 'inset(0)' },
    requiresFrame: true,
  },
  {
    id: 'filter',
    label: 'Filter',
    keys: ['filter'],
    // `blur(0px)` renders identical to no filter — safe placeholder.
    defaultStyles: { filter: 'blur(0px)' },
  },
  {
    id: 'backdropFilter',
    label: 'Backdrop',
    // Both the standard and Safari-prefixed keys count as "in use", and the
    // control writes them together so they never drift apart.
    keys: ['backdropFilter', 'WebkitBackdropFilter'],
    // A visible frosted-glass blur so the effect is obvious the moment the
    // row is added (`blur(0px)` would render identical to no backdrop filter).
    defaultStyles: { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' },
  },
  {
    id: 'zIndex',
    label: 'Z-Index',
    keys: ['zIndex'],
    // 0 is the default stacking context but writing it explicitly opts the
    // element into z-index participation, which is what the user asked for
    // by adding the row.
    defaultStyles: { zIndex: '0' },
  },
  {
    id: 'pointerEvents',
    label: 'Pointer',
    keys: ['pointerEvents'],
    // 'none' is the most common reason to set pointer-events explicitly —
    // makes the element pass through clicks. 'auto' is the default and
    // wouldn't change behaviour, so we add the meaningful one.
    defaultStyles: { pointerEvents: 'none' },
  },
  {
    id: 'userSelect',
    label: 'User Select',
    keys: ['userSelect'],
    // 'none' blocks text selection — common for buttons / chrome.
    defaultStyles: { userSelect: 'none' },
  },
  {
    id: 'backfaceVisibility',
    label: 'Backface',
    keys: ['backfaceVisibility'],
    // 'visible' is the CSS default and would be a no-op; 'hidden' is the
    // reason anyone reaches for the property — the faces of a 3D flip card
    // each hide their own back so only the one turned towards the viewer
    // paints. Pairs with Preserve 3D on the parent (Transform tool).
    defaultStyles: { backfaceVisibility: 'hidden' },
  },
  {
    id: 'mixBlendMode',
    label: 'Blend Mode',
    keys: ['mixBlendMode'],
    // 'normal' is the CSS default and would be a no-op; 'multiply' is the
    // reason anyone reaches for the property — a grain or a shadow layer
    // sinking into what is behind it. Distinct from the Fill panel's
    // per-layer blend (backgroundBlendMode): this composites the WHOLE
    // element with the page behind it.
    defaultStyles: { mixBlendMode: 'multiply' },
  },
];
