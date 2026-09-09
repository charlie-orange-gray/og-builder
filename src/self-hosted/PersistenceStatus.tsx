import { useAtomValue } from 'jotai';
import { versionedSaveStateAtom } from '@/backend/save-store';
import { cancelPendingAutosave, flushSaveNow, getCurrentProjectSnapshot, triggerAutosave } from '@/backend/autosave';
import { leaveBuilderTo } from '@/backend/leave-builder';
import { getProjectId } from '@/backend/project-id';
import { flushNow } from '@/code/mutation/mutation-queue';

const labels = { saved: 'Saved', saving: 'Saving', unsaved: 'Unsaved', error: 'Save failed', conflict: 'Save conflict', 'read-only': 'Read only' };
const buttonClass = 'rounded border border-[var(--border-light)] px-2 py-1 disabled:opacity-50';

export function PersistenceStatus() {
  const state = useAtomValue(versionedSaveStateAtom);
  const save = async () => {
    flushNow();
    triggerAutosave({ force: true });
    try { await flushSaveNow(); } catch { /* Recovery state is rendered below. */ }
  };
  const download = () => {
    flushNow();
    const snapshot = getCurrentProjectSnapshot();
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getProjectId()}-unsaved-copy.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const reload = () => {
    if (window.confirm('Reload the server version? Unsaved changes in this tab will be discarded. Download your copy first if you need to keep them.')) {
      cancelPendingAutosave();
      window.location.reload();
    }
  };

  return (
    <aside aria-label="Server persistence" className="fixed bottom-2 left-2 z-[11000] max-w-xl rounded border border-[var(--border-light)] bg-[var(--bg-surface)] p-3 text-xs text-[var(--text-primary)] shadow-lg">
      <div className="flex flex-wrap items-center gap-3">
        <span role="status" aria-label="Project save status" aria-live="polite">{labels[state.status]}</span>
        <button className={buttonClass} onClick={() => void save()} disabled={state.status === 'saving' || state.status === 'conflict' || state.status === 'read-only'}>Save now</button>
        <button className={buttonClass} onClick={() => void leaveBuilderTo('/', 'self-hosted-projects')}>Projects</button>
      </div>
      {state.error && <p role="alert" className="mt-2">{state.error}</p>}
      {state.status === 'conflict' && <>
        <p className="my-2">Another browser saved a newer revision. Autosave is paused and your edits remain in this tab.</p>
        <div className="flex gap-2">
          <button className={buttonClass} onClick={download}>Download unsaved copy</button>
          <button className={buttonClass} onClick={reload}>Reload server version</button>
        </div>
      </>}
    </aside>
  );
}
