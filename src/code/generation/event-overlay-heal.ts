// event-overlay-heal.ts — load-time heal for event-triggered overlays.
// Standalone (no generator/store imports): project-fs runs it while loading,
// before any store exists.

import { trace } from '@/shared/debug-trace';
import { nodeIdToVarName } from '@/shared/id-utils';

const stateVarName = (overlayId: string) => `${nodeIdToVarName(overlayId)}Open`;

/**
 * Load-time heal: event-triggered overlays written before 2026-09-17 only
 * OPENED (`event1={() => setXOpen(true)}`), so tapping the trigger again (the
 * button now reading Close) left the overlay open. Rewrite to the toggle the
 * generator writes now — only on tags whose data-overlay-trigger is an event
 * trigger for that same overlay. Idempotent.
 */
export function healEventOverlayToggle(code: string): string {
  if (!code.includes('"trigger":"event"')) return code;
  let out = code;
  for (const m of code.matchAll(/data-overlay-trigger='(\{[^']*\})'/g)) {
    let cfg: { trigger?: string; eventName?: string; targetId?: string };
    try { cfg = JSON.parse(m[1]); } catch { continue; }
    if (cfg.trigger !== 'event' || !cfg.eventName || !cfg.targetId) continue;
    const varName = stateVarName(cfg.targetId);
    const setter = `set${varName.charAt(0).toUpperCase() + varName.slice(1)}`;
    // The setter is unique per overlay; the trigger's event handler is the
    // `<eventName>={() => set…(true)}` form (a close binding writes `false`).
    const from = `${cfg.eventName}={() => ${setter}(true)}`;
    if (!out.includes(from)) continue;
    out = out.split(from).join(`${cfg.eventName}={() => ${setter}(!${varName})}`);
    trace.action('overlay-gen:heal-event-toggle', { overlayId: cfg.targetId, eventName: cfg.eventName });
  }
  return out;
}
