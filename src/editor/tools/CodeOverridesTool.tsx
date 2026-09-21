// CodeOverridesTool.tsx — Code Overrides on the selected element.
//
// File = an `overrides/*.tsx` project file, Override = one of its
// `withX(Component)` exports. Writing wraps the element in
// `<Override with={withX}>` (see code-override-gen.ts). Overrides run in
// preview and on the published site, never on the canvas.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ToolSection, ToolSelect, ToolButton, ControlLabel } from '../controls';
import { useControl } from '../controls/ControlProvider';
import { queueMutation } from '@/code/mutation/mutation-queue';
import { projectFS, projectVersionAtom } from '@/code/project/project-fs';
import { activeFilePathAtom } from '@/code/project/active-file-store';
import { codeEditorOpenAtom, codeEditorViewRequestAtom } from '@/code/stores/left-panel-store';
import NameInputModal from '@/editor/ui/NameInputModal';
import {
  OVERRIDES_DIR, listOverrideExports, resolveOverrideLocal, type CodeOverrideRef,
} from '@/code/generation/code-override-gen';
import { trace } from '@/shared/debug-trace';

const NEW_FILE = '__new__';

export const OVERRIDE_FILE_TEMPLATE = `import { forwardRef, type ComponentType } from 'react';
import { createStore } from '@revyme/runtime';

// Code overrides: export functions that take a component and return a new one.
// Apply them from the "Code Overrides" section of any element. They run in
// preview and on the published site.

const useStore = createStore({
  background: '#0099FF',
});

export function withRotate(Component): ComponentType {
  return forwardRef((props, ref) => {
    return <Component ref={ref} {...props} animate={{ rotate: 90 }} transition={{ duration: 2 }} />;
  });
}

export function withHover(Component): ComponentType {
  return forwardRef((props, ref) => {
    return <Component ref={ref} {...props} whileHover={{ scale: 1.05 }} />;
  });
}

export function withStoreBackground(Component): ComponentType {
  return forwardRef((props, ref) => {
    const [store, setStore] = useStore();
    return (
      <Component
        ref={ref}
        {...props}
        style={{ ...props.style, background: store.background }}
        onClick={() => setStore({ background: store.background === '#0099FF' ? '#FF5500' : '#0099FF' })}
      />
    );
  });
}
`;

export default function CodeOverridesTool() {
  const { node, nodeId } = useControl();
  const filePath = useAtomValue(activeFilePathAtom);
  useAtomValue(projectVersionAtom); // re-read override files on any FS change
  const openEditor = useSetAtom(codeEditorOpenAtom);
  const requestView = useSetAtom(codeEditorViewRequestAtom);

  const locals = node?.codeOverrides ?? [];
  const current: CodeOverrideRef | null = useMemo(() => {
    if (locals.length === 0) return null;
    return resolveOverrideLocal(projectFS.readFile(filePath) ?? '', locals[0]);
  }, [locals, filePath]); // eslint-disable-line react-hooks/exhaustive-deps

  const files = projectFS.listFiles(OVERRIDES_DIR).filter((f) => /\.(tsx|ts|jsx|js)$/.test(f)).sort();
  const [open, setOpen] = useState(locals.length > 0);
  const [file, setFile] = useState<string>(current?.file ?? files[0] ?? '');
  const [newFileOpen, setNewFileOpen] = useState(false);

  useEffect(() => {
    setOpen(locals.length > 0);
    setFile(current?.file ?? projectFS.listFiles(OVERRIDES_DIR).sort()[0] ?? '');
  }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (current?.file) setFile(current.file); }, [current?.file]);

  const exportsOfFile = file ? listOverrideExports(projectFS.readFile(file) ?? '') : [];

  const commit = useCallback((overrides: CodeOverrideRef[]) => {
    if (!nodeId) return;
    trace.action('code-overrides-tool:set', { nodeId, overrides });
    queueMutation({ type: 'setCodeOverrides', nodeId, overrides });
  }, [nodeId]);

  const onFile = useCallback((value: string) => {
    if (value === NEW_FILE) { setNewFileOpen(true); return; }
    setFile(value);
    // Switching file clears an override that pointed at the old one.
    if (current && current.file !== value) commit([]);
  }, [current, commit]);

  const onOverride = useCallback((name: string) => {
    commit(name ? [{ file, name }] : []);
  }, [file, commit]);

  const createFile = useCallback((raw: string) => {
    const base = raw.trim().replace(/\.(tsx|ts|jsx|js)$/, '').replace(/[^\w-]/g, '') || 'Overrides';
    const path = `${OVERRIDES_DIR}${base}.tsx`;
    if (projectFS.readFile(path) == null) {
      queueMutation({ type: 'writeFile', filePath: path, content: OVERRIDE_FILE_TEMPLATE });
    }
    trace.action('code-overrides-tool:new-file', { path });
    setFile(path);
  }, []);

  const editCode = useCallback(() => {
    if (!file) return;
    requestView(file);
    openEditor(true);
  }, [file, requestView, openEditor]);

  const toggle = useCallback(() => {
    const next = !open;
    if (!next && locals.length > 0) commit([]);
    setOpen(next);
  }, [open, locals.length, commit]);

  const toggleBtn = (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      className="flex items-center justify-end pl-[80px] -ml-[80px] cursor-pointer group text-[var(--text-primary)]"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="transition-opacity group-hover:opacity-80">
        {open
          ? <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          : <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
      </svg>
    </button>
  );

  const fileOptions = [
    ...(file && !files.includes(file) ? [{ value: file, label: fileLabel(file) }] : []),
    ...(files.length === 0 && !file ? [{ value: '', label: 'Select…' }] : []),
    ...files.map((f) => ({ value: f, label: fileLabel(f) })),
    { value: NEW_FILE, label: 'New File…' },
  ];
  const overrideOptions = [
    { value: '', label: 'Select…' },
    ...exportsOfFile.map((name) => ({ value: name, label: name })),
    ...(current && current.file === file && !exportsOfFile.includes(current.name)
      ? [{ value: current.name, label: `${current.name} (missing)` }] : []),
  ];

  return (
    <ToolSection title="Code Overrides" collapsible action={toggleBtn} hasContent={open}>
      <div className="contents">
        <div className="flex items-center justify-between w-full">
          <ControlLabel label="File" property="__override-file" plain />
          <div className="flex items-center gap-2 w-full">
            <ToolSelect value={file} onChange={onFile} options={fileOptions} />
          </div>
        </div>
        <div className="flex items-center justify-between w-full">
          <ControlLabel label="Override" property="__override-name" plain />
          <div className="flex items-center gap-2 w-full">
            <ToolSelect
              value={current && current.file === file ? current.name : ''}
              onChange={onOverride}
              options={overrideOptions}
              disabled={!file}
            />
          </div>
        </div>
        {locals.length > 1 && (
          <div className="text-[11px] text-[var(--text-secondary)] w-full">
            Also applied: {locals.slice(1).join(', ')}
          </div>
        )}
        <ToolButton onClick={editCode} disabled={!file}>Edit Code</ToolButton>
      </div>
      <NameInputModal
        isOpen={newFileOpen}
        onClose={() => setNewFileOpen(false)}
        onSubmit={(name) => { setNewFileOpen(false); createFile(name); }}
        title="New Override File"
        placeholder="File name (e.g. Effects)"
        submitLabel="Create"
      />
    </ToolSection>
  );
}

function fileLabel(path: string): string {
  return path.slice(OVERRIDES_DIR.length).replace(/\.(tsx|ts|jsx|js)$/, '');
}
