import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ProjectLoader from '@/ProjectLoader';
import { ControlPlaneError, selfHostedClient, type ControlPlaneSession, type DeviceLoginStart, type ProjectSummary } from '@/backend/self-hosted-client';
import { getSelfHostedProjectId, isSelfHostedDashboardPath, SELF_HOSTED_DASHBOARD_PATH, selfHostedProjectPath } from './routes';

const buttonClass = 'rounded border border-[var(--border-light)] bg-[var(--bg-surface)] px-3 py-2 text-sm disabled:opacity-50';

/** A small project entry point; the editor and its file-loading path stay intact. */
export default function SelfHostedRoot() {
  const [session, setSession] = useState<ControlPlaneSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSession, setNeedsSession] = useState(false);
  const [login, setLogin] = useState<DeviceLoginStart | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!login) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const result = await selfHostedClient.pollGitHubLogin(login.flowId);
        if (cancelled) return;
        if (result.status === 'authenticated') { setSession(result.session); setNeedsSession(false); setLogin(null); return; }
        timer = setTimeout(() => void poll(), Math.max(1000, result.retryAfter * 1000));
      } catch (failure) {
        if (!cancelled) { setLoginError(failure instanceof Error ? failure.message : 'GitHub login failed.'); setLogin(null); }
      }
    };
    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [login]);

  const startGitHubLogin = async () => {
    setLoginError(null);
    try { setLogin(await selfHostedClient.startGitHubLogin()); }
    catch (failure) { setLoginError(failure instanceof Error ? failure.message : 'GitHub login could not start.'); }
  };

  if (loading) return <EntryShell><p role="status">Connecting to your projects…</p></EntryShell>;
  if (!session) {
    return (
      <EntryShell>
        <h1 className="mb-4 text-2xl">Revyme projects</h1>
        {error && <p role="alert" className="mb-4">{error}</p>}
        {loginError && <p role="alert" className="mb-4">{loginError}</p>}
        {login ? <>
          <p className="mb-4">Approve this login in GitHub, then leave this page open while it checks the approval.</p>
          <p className="mb-2"><a className="underline" href={login.verificationUri} target="_blank" rel="noreferrer">Open GitHub verification</a></p>
          <p className="mb-4 font-mono text-lg" aria-label="GitHub device code">{login.userCode}</p>
        </> : <>
          {needsSession && import.meta.env.DEV && <button className={`${buttonClass} mr-2`} onClick={() => void loadSession(true)}>Start development session</button>}
          <button className={buttonClass} onClick={() => void startGitHubLogin()}>Sign in with GitHub</button>
          {!needsSession && <button className={`${buttonClass} ml-2`} onClick={() => void loadSession()}>Retry connection</button>}
        </>}
      </EntryShell>
    );
  }

  const projectId = getSelfHostedProjectId(window.location.pathname);
  if (projectId) return <ProjectLoader />;
  return <ProjectList session={session} onLogout={() => { setSession(null); setNeedsSession(false); }} />;
}

function EntryShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[var(--bg-canvas)] p-8 text-[var(--text-primary)]"><div className="mx-auto max-w-3xl">{children}</div></main>;
}

function ProjectList({ session, onLogout }: { session: ControlPlaneSession; onLogout: () => void }) {
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

  const logout = async () => {
    try { await selfHostedClient.logout(); onLogout(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Sign out failed.'); }
  };

  const dashboardPath = SELF_HOSTED_DASHBOARD_PATH;
  // `/` remains a compatible entry point for existing local development and
  // old bookmarks; `/dashboard` is the explicit self-hosted route.
  const isCanonicalRoute = isSelfHostedDashboardPath(window.location.pathname);

  return (
    <EntryShell>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl">Revyme projects</h1>
        {!isCanonicalRoute && <a className="text-sm underline" href={dashboardPath}>Open dashboard</a>}
      </div>
      <p className="my-3 text-sm text-[var(--text-secondary)] flex items-center gap-3">
        <span>Workspace: <strong>{session.workspace.name}</strong> · {session.user.name}</span>
        <button className="text-xs underline" onClick={() => void logout()}>Sign out</button>
      </p>
      <p className="mb-5 text-sm text-[var(--text-secondary)]">This self-hosted installation uses its configured workspace.</p>
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
