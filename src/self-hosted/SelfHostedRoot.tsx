import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ProjectLoader from '@/ProjectLoader';
import { ControlPlaneError, selfHostedClient, type ControlPlaneSession, type ProjectSummary } from '@/backend/self-hosted-client';
import { getSelfHostedProjectId, isSelfHostedDashboardPath, SELF_HOSTED_DASHBOARD_PATH, selfHostedProjectPath } from './routes';

const buttonClass = 'rounded border border-[var(--border-light)] bg-[var(--bg-surface)] px-3 py-2 text-sm disabled:opacity-50';

/** A small project entry point; the editor and its file-loading path stay intact. */
export default function SelfHostedRoot() {
  const [session, setSession] = useState<ControlPlaneSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSession, setNeedsSession] = useState(false);

  const loadSession = useCallback(async (startDevelopment = false) => {
    setLoading(true);
    setError(null);
    try {
      setSession(await (startDevelopment ? selfHostedClient.startDevelopmentSession() : selfHostedClient.getSession()));
      setNeedsSession(false);
    } catch (failure) {
      setNeedsSession(failure instanceof ControlPlaneError && failure.status === 401);
      if (!(failure instanceof ControlPlaneError && failure.status === 401)) {
        setError(failure instanceof Error ? failure.message : 'The control plane could not be reached.');
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadSession(); }, [loadSession]);

  if (loading) return <EntryShell><p role="status">Connecting to your projects…</p></EntryShell>;
  if (!session) {
    return (
      <EntryShell>
        <h1 className="mb-4 text-2xl">Orange &amp; Gray projects</h1>
        {error && <p role="alert" className="mb-4">{error}</p>}
        {needsSession ? <>
          <p className="mb-4">This persistence proof uses a development session on your control plane.</p>
          <button className={buttonClass} onClick={() => void loadSession(true)}>Start development session</button>
        </> : <button className={buttonClass} onClick={() => void loadSession()}>Retry connection</button>}
      </EntryShell>
    );
  }

  const projectId = getSelfHostedProjectId(window.location.pathname);
  if (projectId) return <ProjectLoader />;
  return <ProjectList session={session} />;
}

function EntryShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[var(--bg-canvas)] p-8 text-[var(--text-primary)]"><div className="mx-auto max-w-3xl">{children}</div></main>;
}

function ProjectList({ session }: { session: ControlPlaneSession }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setProjects(await selfHostedClient.listProjects(session.workspace.id)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Projects could not be loaded.'); }
    finally { setLoading(false); }
  }, [session.workspace.id]);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (creating || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const project = await selfHostedClient.createProject(name.trim(), session.workspace.id);
      window.location.assign(`/builder/${project.projectId}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The project could not be created.');
      setCreating(false);
    }
  };

  const dashboardPath = SELF_HOSTED_DASHBOARD_PATH;
  // `/` remains a compatible entry point for existing local development and
  // old bookmarks; `/dashboard` is the explicit self-hosted route.
  const isCanonicalRoute = isSelfHostedDashboardPath(window.location.pathname);

  return (
    <EntryShell>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl">Orange &amp; Gray projects</h1>
        {!isCanonicalRoute && <a className="text-sm underline" href={dashboardPath}>Open dashboard</a>}
      </div>
      <p className="my-3 text-sm text-[var(--text-secondary)]">
        Workspace: <strong>{session.workspace.name}</strong> · {session.user.name}
      </p>
      <p className="mb-5 text-sm text-[var(--text-secondary)]">This self-hosted installation currently uses one development workspace.</p>
      <form onSubmit={create} className="my-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-2">Project name
          <input className="rounded border border-[var(--border-light)] bg-[var(--bg-surface)] px-3 py-2" value={name} onChange={event => setName(event.target.value)} required maxLength={200} />
        </label>
        <button className={buttonClass} type="submit" disabled={creating || !name.trim()}>{creating ? 'Creating project…' : 'Create project'}</button>
      </form>
      {error && <p role="alert" className="my-4">{error} <button className={buttonClass} onClick={() => void load()}>Retry list</button></p>}
      {loading ? <p role="status">Loading projects…</p> : projects.length === 0 ? <p>No projects yet.</p> : (
        <ul className="space-y-3" aria-label="Server projects">
          {projects.map(project => <li key={project.projectId} className="rounded border border-[var(--border-light)] p-4">
            <a href={selfHostedProjectPath(project.projectId)} aria-label={`Open ${project.name}`} className="underline">{project.name}</a>
            <span className="ml-3 text-sm text-[var(--text-secondary)]">Revision {project.revision}</span>
            {project.updatedAt && <time className="ml-3 text-sm text-[var(--text-secondary)]" dateTime={project.updatedAt}>Updated {formatDate(project.updatedAt)}</time>}
          </li>)}
        </ul>
      )}
    </EntryShell>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
