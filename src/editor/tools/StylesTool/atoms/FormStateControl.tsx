// FormStateControl.tsx — the Focus and Checked rows of a form control's Styles
// "Focus" on every input / textarea / select, "Checked" on a
// checkbox or radio. Each state is a rule in the page's style block —
// `[data-id]:focus`, `[data-id]:checked` — written through updatePseudoStyle,
// and edited in a popup with the Styles tool's REAL Fill / Border / Shadow
// controls (scrollStop bridge, like ::before/::after), plus Icon and Transition.
//
// The popup edits a local draft and writes debounced, like Smooth Scroll: a
// write per colour-drag frame would re-render the panel and the canvas.

import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { ControlLabel, ControlActionRow, RemoveButton, ToolInput, ToolRow } from '../../../controls';
import type { AtomProps } from '../../../controls/unified/types';
import { FillControl } from './FillControl';
import { BorderControl } from './BorderControl';
import { ShadowControl } from './ShadowControl';
import ColorInput from '../../../controls/ColorInput';
import ToolPopup from '../../../ui/ToolPopup';
import { useControl } from '../../../controls/ControlProvider';
import { pseudoStylesAtom } from '@/code/stores/pseudo-store';
import { queueMutation, flushNow } from '@/code/mutation/mutation-queue';
import { forceCanvasRender } from '@/canvas/node-ops';
import { checkIconStyles, readCheckIconColor } from '@/code/generation/form-fields';
import { trace } from '@/shared/debug-trace';

type StateKind = 'focus' | 'checked';
const COMMIT_DELAY_MS = 200;
const ICON_KEYS = ['backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat'];

function EffectBadge() {
  return (
    <span className="flex items-center justify-center w-5 h-5 rounded shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--accent-fg)"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>
    </span>
  );
}

function StateEditor({ nodeId, kind, initial, isCheckbox }: {
  nodeId: string; kind: StateKind; initial: Record<string, string>; isCheckbox: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const latest = useRef(initial);
  const pending = useRef<number | null>(null);
  const flush = () => {
    if (pending.current === null) return;
    window.clearTimeout(pending.current);
    pending.current = null;
    const styles: Record<string, string> = {};
    for (const [k, v] of Object.entries(latest.current)) if (v !== '') styles[k] = v;
    queueMutation({ type: 'updatePseudoStyle', nodeId, pseudo: kind, styles });
    flushNow();
    forceCanvasRender();
    trace.action('form-state:commit', { nodeId, kind, keys: Object.keys(styles) });
  };
  useEffect(() => flush, []);
  /** The real atoms hand back the WHOLE style object (scrollStop mode). */
  const replace = (next: Record<string, string>) => {
    latest.current = next;
    setDraft(next);
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(flush, COMMIT_DELAY_MS);
  };
  const set = (patch: Record<string, string>) => replace({ ...latest.current, ...patch });

  // The Styles tool's own Fill / Border / Shadow controls, editing the state
  // rule's declarations instead of the node's inline style — the same bridge
  // the ::before / ::after editor uses.
  const mp: AtomProps = { mode: 'scrollStop' as const, stopProps: draft, onStopChange: replace };
  const iconColor = readCheckIconColor(draft.backgroundImage);
  // The check icon is a background-image: Fill must not see it (it would read
  // as an Image fill) nor drop it when it writes — hide it going in, keep it
  // coming back.
  const iconDecls = iconColor ? Object.fromEntries(ICON_KEYS.filter((k) => draft[k] !== undefined).map((k) => [k, draft[k]])) : {};
  const fillProps: AtomProps = iconColor
    ? {
      mode: 'scrollStop' as const,
      stopProps: Object.fromEntries(Object.entries(draft).filter(([k]) => !ICON_KEYS.includes(k))),
      onStopChange: (next: Record<string, string>) => {
        const clean = Object.fromEntries(Object.entries(next).filter(([k]) => !ICON_KEYS.includes(k)));
        replace({ ...clean, ...iconDecls });
      },
    }
    : mp;
  const seconds = /([\d.]+)s/.exec(draft.transition ?? '')?.[1] ?? '';

  return (
    <div className="flex flex-col gap-2">
      <FillControl {...fillProps} />
      <BorderControl {...mp} />
      <ShadowControl {...mp} />
      {kind === 'checked' && isCheckbox && (
        <ToolRow label="Icon">
          <ColorInput value={iconColor ?? ''} empty={!iconColor}
            onChange={(v) => set(checkIconStyles(v))}
            onRemove={iconColor ? () => set(Object.fromEntries(ICON_KEYS.map((k) => [k, '']))) : undefined} />
        </ToolRow>
      )}
      <ToolRow label="Transition">
        <ToolInput value={seconds} placeholder="0.2" chevronLabel="s" step={0.1}
          onChange={(v) => set({ transition: v === '' ? '' : `all ${Math.max(0, parseFloat(v) || 0)}s cubic-bezier(0.44, 0, 0.56, 1)` })} />
      </ToolRow>
    </div>
  );
}

function StateRow({ nodeId, kind, styles, isCheckbox }: {
  nodeId: string; kind: StateKind; styles: Record<string, string> | undefined; isCheckbox: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const label = kind === 'focus' ? 'Focus' : 'Checked';
  const has = !!styles && Object.keys(styles).length > 0;
  const add = () => {
    const seed: Record<string, string> = kind === 'focus'
      ? { borderColor: '#0099ff' }
      : isCheckbox ? { backgroundColor: '#0099ff', borderColor: '#0099ff', ...checkIconStyles('#ffffff') }
      : { backgroundColor: '#ffffff', borderColor: '#0099ff', borderWidth: '5px' };
    queueMutation({ type: 'updatePseudoStyle', nodeId, pseudo: kind, styles: seed });
    flushNow();
    forceCanvasRender();
    setOpen(true);
  };
  const remove = () => {
    queueMutation({ type: 'removePseudo', nodeId, pseudo: kind });
    flushNow();
    forceCanvasRender();
    setOpen(false);
  };
  return (
    <div ref={anchor} className="flex items-center justify-between w-full">
      <ControlLabel label={label} property="" plain />
      <ControlActionRow onClick={() => (has ? setOpen(true) : add())}>
        {has ? <EffectBadge /> : null}
        <span className={`truncate flex-1 ${has ? '' : 'text-[var(--text-secondary)]'}`}>{has ? 'Effect' : 'Add…'}</span>
        {has && <RemoveButton onClick={(e) => { e.stopPropagation(); remove(); }} />}
      </ControlActionRow>
      {has && (
        <ToolPopup isOpen={open} onClose={() => setOpen(false)} title={label} anchorRef={anchor}>
          <StateEditor key={`${nodeId}:${kind}`} nodeId={nodeId} kind={kind} initial={styles!} isCheckbox={isCheckbox} />
        </ToolPopup>
      )}
    </div>
  );
}

export function FormStateControl() {
  const { node } = useControl();
  const pseudo = useAtomValue(pseudoStylesAtom);
  if (!node) return null;
  const tag = node.type;
  const inputType = node.attrs?.type ?? 'text';
  const isControl = tag === 'input' || tag === 'textarea' || tag === 'select';
  if (!isControl || ['submit', 'button', 'reset', 'hidden'].includes(inputType)) return null;
  const isBoolean = tag === 'input' && (inputType === 'checkbox' || inputType === 'radio');
  const own = pseudo.get(node.id);
  return (
    <>
      <StateRow nodeId={node.id} kind="focus" styles={own?.focus} isCheckbox={inputType === 'checkbox'} />
      {isBoolean && <StateRow nodeId={node.id} kind="checked" styles={own?.checked} isCheckbox={inputType === 'checkbox'} />}
    </>
  );
}
