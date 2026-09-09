// TranslationPanel.tsx — the ENTIRE right panel while a non-default locale
// is active (translation mode — localization overhaul
// Phase 2/3, docs/localization/overhaul-plan.md).
//
//   · text node selected        → one text area per locale (default first)
//   · localizable attrs present → per-locale fields per attr (placeholder…)
//   · anything else             → empty state
//
// A floating pill (portal — the panel's willChange:transform would trap a
// fixed child) shows "Editing <Locale> Translation · N%" + Done.

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { selectedNodeAtom, nodesAtom } from '@/code/stores/store';
import { activeFilePathAtom } from '@/code/project/active-file-store';
import {
  activeLocaleAtom,
  i18nConfigAtom,
  localeOverridesAtom,
} from '@/code/stores/locale-store';
import {
  commitTranslationText,
  commitTranslationAttr,
  readTranslationText,
} from '@/code/project/translation-ops';
import { LOCALIZABLE_ATTRS, attrMessageKey } from '@/code/generation/i18n-gen';
import { substituteRichTextRuns } from '@/canvas/hooks/locale-override-map';
import { innerJsxToRichMessage } from '@/shared/rich-message';
import RichLocaleField from './RichLocaleField';
import type { CanvasNode } from '@/code/parsing/parser';
import { trace } from '@/shared/debug-trace';

const PANEL_CLASS =
  'w-[260px] shrink-0 bg-[var(--bg-surface)] border-l border-[var(--border-light)] overflow-y-auto scrollbar-hide relative z-5000';

/** A node is text-translatable when it carries literal text or is already
 *  transformed — but NOT when its text is variable/CMS-bound. */
function isTextTranslatable(node: CanvasNode | undefined | null): boolean {
  if (!node) return false;
  if (node.translationKey) return true;
  if (node.textVariable || node.binding) return false;
  return !!node.textContent?.trim();
}

/** Localizable attrs actually present on the node (or already transformed). */
function localizableAttrs(node: CanvasNode | undefined | null): string[] {
  if (!node) return [];
  const out: string[] = [];
  for (const attr of LOCALIZABLE_ATTRS) {
    if (node.attrTranslationKeys?.[attr] !== undefined) { out.push(attr); continue; }
    const v = node.attrs?.[attr];
    if (typeof v === 'string' && v && !v.startsWith('var:')) out.push(attr);
  }
  // `value` only makes sense as visible text on inputs/buttons.
  return out.filter(a => a !== 'value' || node.type === 'input' || node.type === 'button');
}

export default function TranslationPanel() {
  const selectedId = useAtomValue(selectedNodeAtom);
  const nodes = useAtomValue(nodesAtom);
  const node = selectedId ? nodes.get(selectedId) : null;
  const config = useAtomValue(i18nConfigAtom);
  const activeLocale = useAtomValue(activeLocaleAtom);

  const textOk = isTextTranslatable(node);
  const attrList = localizableAttrs(node);

  return (
    <div
      data-properties-panel
      data-translation-panel
      className={PANEL_CLASS}
      style={{ marginTop: 52, willChange: 'transform', isolation: 'isolate' }}
    >
      {node && (textOk || attrList.length > 0) ? (
        <div className="p-3 flex flex-col gap-4" key={node.id}>
          {textOk && (node.richTranslation || (node.hasMixedContent && node.textContent)) ? (
            // RICH TEXT — ONE editor per locale for the whole node (marks
            // included); the message is sanitized inline HTML.
            <TranslationFieldGroup node={node} kind="text" rich />
          ) : textOk ? (
            <TranslationFieldGroup node={node} kind="text" />
          ) : null}
          {attrList.map(attr => (
            <TranslationFieldGroup key={attr} node={node} kind="attr" attr={attr} />
          ))}
        </div>
      ) : node ? (
        <div className="p-4 text-xs text-[var(--text-disabled)] leading-relaxed" data-translation-empty>
          This element has no translatable content. Select a text layer or an
          input to edit its {config?.locales.find(l => l.code === activeLocale)?.label ?? activeLocale} translation.
        </div>
      ) : null}
      <TranslationProgressPill />
    </div>
  );
}

// ─── Per-locale field group (one per translatable content piece) ───────────

function TranslationFieldGroup({ node, kind, attr, rich }: {
  node: CanvasNode;
  kind: 'text' | 'attr';
  attr?: string;
  /** RICH text: one HTML message per node, edited with RichLocaleField. */
  rich?: boolean;
}) {
  const runKey: string | undefined = undefined;
  const runSource: string | undefined = undefined;
  const config = useAtomValue(i18nConfigAtom);
  const filePath = useAtomValue(activeFilePathAtom);
  const activeLocale = useAtomValue(activeLocaleAtom);
  const setLocaleOverrides = useSetAtom(localeOverridesAtom);
  const defaultLocale = config?.defaultLocale ?? 'en';
  const locales = useMemo(() => {
    const list = config?.locales ?? [];
    return [...list].sort((a, b) => (a.code === defaultLocale ? -1 : b.code === defaultLocale ? 1 : 0));
  }, [config, defaultLocale]);

  const msgKey = runKey ?? (kind === 'text' ? node.id : attrMessageKey(node.id, attr!));
  const transformed = kind === 'text'
    ? !!node.translationKey
    : node.attrTranslationKeys?.[attr!] !== undefined;

  // Stored/default values per locale (recomputed per render — cheap reads).
  const valueFor = (code: string): string => {
    const stored = readTranslationText({ filePath, key: msgKey, locale: code });
    if (stored !== null) return stored;
    if (code === defaultLocale) {
      if (runKey !== undefined) return runSource ?? '';
      if (rich && kind === 'text') {
        // Untransformed rich node: the default is the inner JSX as HTML
        // (legacy `{t('id__rN')}` runs resolved from the default messages).
        const resolved = substituteRichTextRuns(node.textContent ?? '', (k) =>
          readTranslationText({ filePath, key: k, locale: defaultLocale }) ?? '');
        return innerJsxToRichMessage(resolved);
      }
      return kind === 'text' ? (node.textContent ?? '') : (node.attrs?.[attr!] ?? '');
    }
    return '';
  };
  const defaultText = valueFor(defaultLocale);

  const commit = (code: string, text: string) => {
    if (text === valueFor(code)) return;
    trace.action('translation-panel:commit', { nodeId: node.id, kind, attr, locale: code, text: text.slice(0, 40) });
    if (kind === 'text') {
      commitTranslationText({
        filePath, nodeId: runKey ?? node.id, locale: code, defaultLocale, text,
        fallbackDefaultText: runKey !== undefined ? (runSource ?? '') : (node.textContent ?? ''),
        rich,
      });
      // Instant canvas repaint when the ACTIVE locale's value changed —
      // messages-only writes don't retrigger the code-driven override
      // reload; JSX transforms do (code change → nodesAtom → effect).
      if (code === activeLocale && runKey === undefined) {
        setLocaleOverrides(prev => {
          const next = new Map(prev);
          const existing = next.get(node.id) || {};
          next.set(node.id, rich ? { ...existing, innerJsx: text } : { ...existing, text });
          return next;
        });
      }
      // Rich-text run fast path: recompute the node's substituted innerJsx
      // from the (just-written) messages so an already-transformed run's
      // messages-only edit repaints without a code change.
      if (runKey !== undefined && node.textContent) {
        const innerJsx = substituteRichTextRuns(node.textContent, (k) =>
          readTranslationText({ filePath, key: k, locale: activeLocale })
          ?? readTranslationText({ filePath, key: k, locale: defaultLocale })
          ?? '');
        setLocaleOverrides(prev => {
          const next = new Map(prev);
          const existing = next.get(node.id) || {};
          next.set(node.id, { ...existing, innerJsx });
          return next;
        });
      }
    } else {
      commitTranslationAttr({
        filePath, nodeId: node.id, attr: attr!, locale: code, defaultLocale, text,
        transformed, fallbackDefaultValue: node.attrs?.[attr!] ?? '',
      });
      if (code === activeLocale) {
        setLocaleOverrides(prev => {
          const next = new Map(prev);
          const existing = next.get(node.id) || {};
          next.set(node.id, { ...existing, props: { ...(existing.props || {}), [attr!]: text } });
          return next;
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {kind === 'attr' && (
        <div className="text-[11px] font-semibold text-[var(--text-primary)] capitalize">{attr}</div>
      )}
      {locales.map(l => rich ? (
        <RichLocaleField
          key={`${node.id}:${msgKey}:${l.code}:rich`}
          label={l.label}
          isDefault={l.code === defaultLocale}
          initialHtml={valueFor(l.code)}
          placeholderHtml={l.code === defaultLocale ? '' : defaultText}
          onCommit={(html) => commit(l.code, html)}
        />
      ) : (
        <LocaleField
          key={`${node.id}:${msgKey}:${l.code}`}
          label={l.label}
          isDefault={l.code === defaultLocale}
          initialValue={valueFor(l.code)}
          placeholder={l.code === defaultLocale ? '' : defaultText}
          onCommit={(text) => commit(l.code, text)}
        />
      ))}
    </div>
  );
}

function LocaleField({ label, isDefault, initialValue, placeholder, onCommit }: {
  label: string;
  isDefault: boolean;
  initialValue: string;
  placeholder: string;
  onCommit: (text: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="flex flex-col gap-1.5" data-locale-field={label}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
        {isDefault && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-disabled)]">Default</span>
        )}
      </div>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={Math.max(2, Math.ceil((value || placeholder).length / 30))}
        // The DEFAULT locale is design: edited on the canvas, shown here only.
        readOnly={isDefault}
        tabIndex={isDefault ? -1 : undefined}
        aria-readonly={isDefault || undefined}
        title={isDefault ? 'Edit the default text on the canvas' : undefined}
        onChange={e => { if (!isDefault) setValue(e.target.value); }}
        onFocus={e => {
          // Select-all on focus — same affordance as ToolInput (type to
          // overwrite without triple-clicking). rAF so the selection lands
          // after React's controlled-value sync.
          if (isDefault) { e.currentTarget.blur(); return; }
          const el = e.currentTarget;
          requestAnimationFrame(() => el.select());
        }}
        onMouseUp={e => {
          // Browsers collapse the selection on click-focus mouseup — restore
          // the select-all unless the user drag-selected a range (ToolInput's
          // exact recipe).
          if (isDefault) return;
          const el = e.currentTarget;
          if (el.selectionStart === el.selectionEnd) {
            requestAnimationFrame(() => el.select());
          }
        }}
        onBlur={() => { if (!isDefault) onCommit(value); }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onCommit(value);
            (e.target as HTMLTextAreaElement).blur();
          }
          e.stopPropagation();
        }}
        className={`${isDefault ? 'opacity-60 cursor-default select-text ' : ''}w-full px-2 py-2 text-xs bg-[var(--grid-line)] border border-[var(--control-border)] [--cut-border-color:var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] cut-corners cut-border hover:[--cut-border-color:var(--control-border-hover)] focus:[--cut-border-color:var(--border-focus)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none transition-colors resize-none leading-relaxed`}
      />
    </div>
  );
}

// ─── Progress pill — "Editing French Translation · N%" + Done ──────────────

function TranslationProgressPill() {
  const nodes = useAtomValue(nodesAtom);
  const config = useAtomValue(i18nConfigAtom);
  const activeLocale = useAtomValue(activeLocaleAtom);
  const filePath = useAtomValue(activeFilePathAtom);
  const setActiveLocale = useSetAtom(activeLocaleAtom);
  const label = config?.locales.find(l => l.code === activeLocale)?.label ?? activeLocale;

  const percent = useMemo(() => {
    let total = 0;
    let translated = 0;
    for (const [, n] of nodes) {
      if (isTextTranslatable(n)) {
        total++;
        if (readTranslationText({ filePath, key: n.id, locale: activeLocale }) !== null) translated++;
      }
      for (const attr of localizableAttrs(n)) {
        total++;
        if (readTranslationText({ filePath, key: attrMessageKey(n.id, attr), locale: activeLocale }) !== null) translated++;
      }
    }
    return total === 0 ? 100 : Math.round((translated / total) * 100);
  }, [nodes, filePath, activeLocale]);

  return createPortal(
    <div
      data-translation-pill
      className="fixed bottom-[68px] left-1/2 -translate-x-1/2 z-[6000] flex items-center gap-3 pl-4 pr-2 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-light)] shadow-lg"
    >
      <span className="text-xs text-[var(--text-primary)] whitespace-nowrap">
        Editing {label} Translation · {percent}%
      </span>
      <button
        onClick={() => {
          trace.action('translation-pill:done', { locale: activeLocale });
          setActiveLocale(config?.defaultLocale ?? 'en');
        }}
        className="text-xs font-medium px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 cursor-pointer"
      >
        Done
      </button>
    </div>,
    document.body,
  );
}
