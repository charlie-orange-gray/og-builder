/**
 * SmoothScrollPopup.tsx — the Smooth Scroll (Lenis) editor for ONE page,
 * opened from the viewport's Animation section.
 *
 * The popup owns a local draft: every control updates it instantly (the
 * slider thumb and the segmented tab animate on the draft alone) and the
 * project write is debounced behind it. Writing on every change rewrote the
 * data module and re-rendered the panel per slider tick, which is what made
 * dragging the intensity stutter and the tabs switch late.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ToolRow, ToolSegmentedControl } from '../../controls';
import { SliderRow } from './shared';
import type { SmoothScrollConfig } from '@/code/project/smooth-scroll-config';

const YES_NO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];
const COMMIT_DELAY_MS = 250;

// Direction as arrows: "Horizontal" overflowed its half of the segmented control.
const arrow = (d: string) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const DIRECTION_OPTIONS = [
  { value: 'vertical', icon: arrow('M12 5v14M6 13l6 6 6-6') },
  { value: 'horizontal', icon: arrow('M5 12h14M13 6l6 6-6 6') },
];

export default function SmoothScrollPopup({ config, onChange }: {
  config: SmoothScrollConfig;
  onChange: (next: SmoothScrollConfig) => void;
}) {
  const [draft, setDraft] = useState(config);
  const latest = useRef(config);
  const pending = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const flush = () => {
    if (pending.current === null) return;
    window.clearTimeout(pending.current);
    pending.current = null;
    onChangeRef.current(latest.current);
  };
  // Closing the popup mid-drag still saves the last value.
  useEffect(() => flush, []);

  const set = (patch: Partial<SmoothScrollConfig>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(flush, COMMIT_DELAY_MS);
  };
  const yn = (v: boolean) => (v ? 'yes' : 'no');

  return (
    <div className="flex flex-col gap-2">
      <ToolRow label="Enabled">
        <ToolSegmentedControl value={yn(draft.enabled)} onChange={(v) => set({ enabled: v === 'yes' })} options={YES_NO} size="sm" />
      </ToolRow>
      {draft.enabled && (
        <>
          <SliderRow label="Intensity" value={draft.intensity} min={1} max={50} step={1}
            onChange={(v) => set({ intensity: v })}
            // Release of the slider, or a value typed in the box: take it and write now.
            onCommit={(v) => { set({ intensity: Math.min(50, Math.max(1, Math.round(v) || 1)) }); flush(); }} />
          <ToolRow label="Direction">
            <ToolSegmentedControl value={draft.orientation} onChange={(v) => set({ orientation: v === 'horizontal' ? 'horizontal' : 'vertical' })}
              options={DIRECTION_OPTIONS} size="sm" />
          </ToolRow>
          <ToolRow label="Wheel">
            <ToolSegmentedControl value={yn(draft.smoothWheel)} onChange={(v) => set({ smoothWheel: v === 'yes' })} options={YES_NO} size="sm" />
          </ToolRow>
          <ToolRow label="Touch">
            <ToolSegmentedControl value={yn(draft.smoothTouch)} onChange={(v) => set({ smoothTouch: v === 'yes' })} options={YES_NO} size="sm" />
          </ToolRow>
          <ToolRow label="Infinite">
            <ToolSegmentedControl value={yn(draft.infinite)} onChange={(v) => set({ infinite: v === 'yes' })} options={YES_NO} size="sm" />
          </ToolRow>
        </>
      )}
    </div>
  );
}
