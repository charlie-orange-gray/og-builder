// AddFormFieldUI.tsx — the "+" under a selected form: a round
// badge centred on the form's bottom edge that opens Text / Checkbox / Radio /
// Select. Each choice inserts a real field (form-fields.ts) before the form's
// submit button and writes its Checked / Focus state rules, then selects it.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { selectedNodeAtom, selectedIdsAtom, canvasInteractingAtom, getNodesSnapshot } from '@/code/stores/store';
import { useNode } from '@/code/stores/node-family';
import { interactingViewportIdAtom } from '@/code/stores/viewport-store';
import { findNodeRect, forceCanvasRender } from '@/canvas/node-ops';
import { queueMutation, flushNow } from '@/code/mutation/mutation-queue';
import { buildFormField, type FormFieldKind } from '@/code/generation/form-fields';
import { whenNodeRectReady } from '@/canvas/ui/AddEntryUI';
import { trace } from '@/shared/debug-trace';

const baseTag = (t: string | undefined) => (t ?? '').replace(/^motion\./, '');

const CHOICES: { kind: FormFieldKind; label: string }[] = [
  { kind: 'text', label: 'Text' },
  { kind: 'checkbox', label: 'Checkbox' },
  { kind: 'radio', label: 'Radio' },
  { kind: 'select', label: 'Select' },
];

/** The index before the form's submit control (a submit button or the FormSubmit component), else the end. */
function insertIndexIn(formId: string): number {
  const nodes = getNodesSnapshot();
  const form = nodes.get(formId);
  if (!form) return 0;
  const idx = form.children.findIndex((cid) => {
    const c = nodes.get(cid);
    if (!c) return false;
    const tag = baseTag(c.type);
    return (tag === 'button' && (c.attrs?.type ?? 'submit') === 'submit')
      || (tag === 'input' && c.attrs?.type === 'submit')
      || /FormSubmit/.test(c.type);
  });
  return idx === -1 ? form.children.length : idx;
}

export default function AddFormFieldUI() {
  const selectedId = useAtomValue(selectedNodeAtom);
  const setSelectedIds = useSetAtom(selectedIdsAtom);
  const isInteracting = useAtomValue(canvasInteractingAtom);
  const vpId = useAtomValue(interactingViewportIdAtom);
  const node = useNode(selectedId) ?? null;
  const isForm = !!node && baseTag(node.type) === 'form';
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [selectedId]);

  useEffect(() => {
    if (!isForm || !selectedId) { setPos(null); return; }
    let raf = 0;
    let last = '';
    const poll = () => {
      const r = findNodeRect(selectedId, vpId || 'desktop');
      const key = r ? `${Math.round(r.left + r.width / 2)}:${Math.round(r.bottom)}` : '';
      if (key !== last) {
        last = key;
        setPos(r ? { x: r.left + r.width / 2, y: r.bottom } : null);
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [isForm, selectedId, vpId]);

  useEffect(() => {
    if (!open) return;
    // The badge and the menu both count as inside: pressing the badge to close must not close-then-reopen.
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open]);

  if (!isForm || !pos || !selectedId) return null;

  const add = (kind: FormFieldKind) => {
    setOpen(false);
    const built = buildFormField(kind);
    queueMutation({ type: 'addNode', parentId: selectedId, node: built.node, index: insertIndexIn(selectedId) });
    for (const rule of built.rules) queueMutation({ type: 'updatePseudoStyle', nodeId: rule.nodeId, pseudo: rule.pseudo, styles: rule.styles });
    flushNow();
    forceCanvasRender();
    trace.action('add-form-field:add', { formId: selectedId, kind, fieldId: built.node.id });
    whenNodeRectReady(built.node.id, vpId || 'desktop', () => setSelectedIds([built.node.id]));
  };

  return createPortal(
    <div
      ref={wrapRef}
      data-canvas-wheel=""
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)', zIndex: 2002,
        pointerEvents: isInteracting ? 'none' : 'auto', opacity: isInteracting ? 0 : 1,
      }}
    >
      <button
        type="button"
        title="Add field"
        data-testid="add-form-field"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        // Solid accent — `--accent` is already the secondary (purple) accent on
        // component and template files (App.tsx), the normal one on pages.
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, padding: 0, border: 'none', borderRadius: '50%', background: 'var(--accent)', cursor: 'pointer', opacity: 1 }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M6 2v8M2 6h8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="bg-[var(--surface-elevated,#1f1f1f)] border border-[var(--border-light)] shadow-lg"
          style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', minWidth: 140, padding: 4, borderRadius: 10 }}
        >
          {CHOICES.map((c) => (
            <button
              key={c.kind}
              type="button"
              role="menuitem"
              data-testid={`add-form-field-${c.kind}`}
              onClick={(e) => { e.stopPropagation(); add(c.kind); }}
              className="w-full text-left text-xs px-3 py-2 rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-hover,rgba(255,255,255,0.06))]"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
