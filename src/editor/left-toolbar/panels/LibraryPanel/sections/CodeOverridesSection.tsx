// CodeOverridesSection — the "Code Overrides" section of the Library panel.
// One row per `overrides/*.tsx` file with a usage badge: click it for the
// elements the file's overrides are applied to (each shows which export).
// Clicking the row opens the file in the code editor.

import React, { useCallback, useMemo, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { toast } from 'sonner';
import SidebarRow from '@/design-system/SidebarRow';
import ConfirmDialog from '@/design-system/ConfirmDialog';
import { type DropdownMenuEntry } from '@/design-system/DropdownMenu';
import NameInputModal from '@/editor/ui/NameInputModal';
import { projectFS, projectVersionAtom } from '@/code/project/project-fs';
import { queueMutation } from '@/code/mutation/mutation-queue';
import { codeEditorOpenAtom, codeEditorViewRequestAtom } from '@/code/stores/left-panel-store';
import { codeOverrideUsageAtom } from '@/code/stores/library-usage-store';
import { OVERRIDES_DIR, listOverrideExports } from '@/code/generation/code-override-gen';
import { OVERRIDE_FILE_TEMPLATE } from '@/editor/tools/CodeOverridesTool';
import { useIsViewer } from '@/code/stores/viewer-mode-store';
import { UsageBadge } from '../presets/UsagePopup';
import { LibrarySectionHeader, LibraryEmptyState } from '../shared/SectionChrome';
import { trace } from '@/shared/debug-trace';

const OverrideIcon = React.memo(function OverrideIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-secondary)' }}>
      <path d="M8 6 3 12l5 6" />
      <path d="m16 6 5 6-5 6" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
});


const fileLabel = (path: string) => path.slice(OVERRIDES_DIR.length).replace(/\.(tsx|ts|jsx|js)$/, '');

export function CodeOverridesSection({ searchQuery }: { searchQuery?: string }) {
  const [version, setVersion] = useAtom(projectVersionAtom);
  const usage = useAtomValue(codeOverrideUsageAtom);
  const openEditor = useSetAtom(codeEditorOpenAtom);
  const requestView = useSetAtom(codeEditorViewRequestAtom);
  const isViewer = useIsViewer();
  const [newOpen, setNewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const files = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase();
    return projectFS.listFiles(OVERRIDES_DIR)
      .filter((f) => /\.(tsx|ts|jsx|js)$/.test(f))
      .sort()
      .map((path) => ({ path, exports: listOverrideExports(projectFS.readFile(path) ?? '') }))
      .filter((f) => !q || fileLabel(f.path).toLowerCase().includes(q) || f.exports.some((e) => e.toLowerCase().includes(q)));
  }, [version, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCode = useCallback((path: string) => {
    trace.action('library:code-override-open', { path });
    requestView(path);
    openEditor(true);
  }, [requestView, openEditor]);

  const create = useCallback((raw: string) => {
    const base = raw.trim().replace(/\.(tsx|ts|jsx|js)$/, '').replace(/[^\w-]/g, '') || 'Overrides';
    const path = `${OVERRIDES_DIR}${base}.tsx`;
    setNewOpen(false);
    if (projectFS.readFile(path) != null) { toast.error(`"${base}" already exists`); return; }
    queueMutation({ type: 'writeFile', filePath: path, content: OVERRIDE_FILE_TEMPLATE });
    setVersion((v) => v + 1);
    trace.action('library:code-override-create', { path });
    openCode(path);
  }, [openCode, setVersion]);

  const remove = useCallback(() => {
    const path = confirmDelete;
    setConfirmDelete(null);
    if (!path) return;
    if ((usage.get(path)?.length ?? 0) > 0) {
      toast.error(`"${fileLabel(path)}" is still applied to elements. Remove it from them first.`);
      return;
    }
    queueMutation({ type: 'deleteFile', filePath: path });
    setVersion((v) => v + 1);
    trace.action('library:code-override-delete', { path });
  }, [confirmDelete, usage, setVersion]);

  const plusItems: DropdownMenuEntry[] = [{ id: 'new-override-file', label: 'New override file', onClick: () => setNewOpen(true) }];

  return (
    <div>
      <LibrarySectionHeader title="Code Overrides" addTitle="Create code override file" items={plusItems} />

      {files.length === 0 ? (
        <LibraryEmptyState icon={<OverrideIcon />} message="No code overrides yet" />
      ) : (
        <div className="px-2 pb-2">
          {files.map(({ path }) => {
            const fileUsages = usage.get(path) ?? [];
            const menuItems: DropdownMenuEntry[] = [
              { id: 'edit-code', label: 'Edit Code', onClick: () => openCode(path) },
              { id: 'delete', label: 'Delete', onClick: () => setConfirmDelete(path), danger: true },
            ];
            return (
              <SidebarRow
                key={path}
                icon={<OverrideIcon />}
                label={fileLabel(path)}
                menuItems={isViewer ? undefined : menuItems}
                right={<UsageBadge count={fileUsages.length} usages={fileUsages} />}
                onClick={() => openCode(path)}
              />
            );
          })}
        </div>
      )}

      <NameInputModal
        isOpen={newOpen}
        onClose={() => setNewOpen(false)}
        onSubmit={create}
        title="New Override File"
        placeholder="File name (e.g. Effects)"
        submitLabel="Create"
      />
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title="Delete override file?"
        message={`"${confirmDelete ? fileLabel(confirmDelete) : ''}" will be removed from the project.`}
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
