import { describe, it, expect, vi } from 'vitest';
vi.mock('@/shared/debug-trace', () => ({ trace: { action: vi.fn(), fn: vi.fn(), error: vi.fn(), dom: vi.fn() } }));
import { createOverlayInCode } from './overlay-gen';
import { healEventOverlayToggle } from './event-overlay-heal';
import { checkFile } from '@/code/oracle/check-file';

// An overlay shown by an instance's component EVENT toggles —
// the same button opens it and, fired again (Menu → Close), closes it.
const PAGE = `'use client';
import React, { useState, useEffect } from 'react';
import DaNePa from '@/components/DaNePa';
export default function Page() {
  return (
<div data-id="root" data-name="Page" style={{ position: 'relative', width: '100%', height: '900px' }}>
    <DaNePa data-id="frame-mu5g5ceg-1" data-name="Frame" style={{ position: 'fixed', width: '421px', height: '299px', zIndex: '3' }} />
    </div>
  );
}`;

// The user's page as the previous generator wrote it (open only).
const OPEN_ONLY = `<DaNePa data-id="frame-mu5g5ceg-1" data-name="Frame" style={{ position: 'fixed' }} data-overlay-trigger='{"targetId":"overlay-frame-mu5g5ceg-1-1","trigger":"event","dismiss":"outside","eventName":"event1"}' event1={() => setOverlayFrameMu5g5ceg_1_1Open(true)} />`;

describe('event-triggered overlays toggle', () => {
  it('the generator writes the toggle handler for an event trigger', () => {
    const out = createOverlayInCode(PAGE, 'frame-mu5g5ceg-1', 'overlay-frame-mu5g5ceg-1-1',
      { type: 'fixed', triggerId: 'frame-mu5g5ceg-1', side: 'bottom', align: 'center', offsetX: 0, offsetY: 10 } as any,
      { targetId: 'overlay-frame-mu5g5ceg-1-1', trigger: 'event', dismiss: 'outside', eventName: 'event1' });
    expect(out).toContain('event1={() => setOverlayFrameMu5g5ceg_1_1Open(!overlayFrameMu5g5ceg_1_1Open)}');
    expect(checkFile(out, { kind: 'page' } as any).filter((v: any) => v.code.startsWith('OVERLAY_')).map((v: any) => v.code)).toEqual([]);
  });

  it('heals an open-only event handler to the toggle, idempotently', () => {
    const healed = healEventOverlayToggle(OPEN_ONLY);
    expect(healed).toContain('event1={() => setOverlayFrameMu5g5ceg_1_1Open(!overlayFrameMu5g5ceg_1_1Open)}');
    expect(healEventOverlayToggle(healed)).toBe(healed);
  });

  it('leaves click triggers and close bindings alone', () => {
    const click = `<Card data-id="c" data-overlay-trigger='{"targetId":"ov","trigger":"click","dismiss":"outside"}' onClick={() => setOvOpen(!ovOpen)} />`;
    expect(healEventOverlayToggle(click)).toBe(click);
    const close = `<CloseBtn data-id="x" event1={() => setOvOpen(false)} />`;
    expect(healEventOverlayToggle(close)).toBe(close);
  });
});
