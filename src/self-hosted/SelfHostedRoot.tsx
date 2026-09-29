import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ProjectLoader from '@/ProjectLoader';
import { ControlPlaneError, selfHostedClient, type ControlPlaneSession, type DeviceLoginStart, type ProjectSummary } from '@/backend/self-hosted-client';
import Button from '@/design-system/Button';
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
  return <ProjectList session={session} onSessionChange={setSession} onLogout={() => { setSession(null); setNeedsSession(false); }} />;
}

function EntryShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[var(--bg-canvas)] p-8 text-[var(--text-primary)]"><div className="mx-auto max-w-3xl">{children}</div></main>;
}

function ProjectList({ session, onSessionChange, onLogout }: { session: ControlPlaneSession; onSessionChange: (session: ControlPlaneSession) => void; onLogout: () => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const workspaceId = session.workspace?.id;

  const load = useCallback(async () => {
    if (!workspaceId) { setProjects([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try { setProjects(await selfHostedClient.listProjects(workspaceId)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Projects could not be loaded.'); }
    finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (creating || !name.trim() || !session.workspace) return;
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

  const createWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    if (creatingWorkspace || !workspaceName.trim()) return;
    setCreatingWorkspace(true); setError(null);
    try {
      const next = await selfHostedClient.createWorkspace(workspaceName.trim());
      onSessionChange(next); setWorkspaceName('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The workspace could not be created.'); }
    finally { setCreatingWorkspace(false); }
  };

  const selectWorkspace = async (workspaceId: string) => {
    if (workspaceId === session.workspace?.id) return;
    setError(null);
    try { onSessionChange(await selfHostedClient.selectWorkspace(workspaceId)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The workspace could not be selected.'); }
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
      <div className="flex min-h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] shadow-sm">
        <aside className="hidden w-52 shrink-0 border-r border-[var(--border-light)] p-4 md:block">
          <div className="mb-8 text-lg font-semibold tracking-tight">Revyme</div>
          <nav aria-label="Dashboard navigation" className="space-y-1 text-sm">
            <a className="block rounded px-3 py-2 font-medium text-[var(--text-primary)]" href={dashboardPath}>Projects</a>
            <span className="block px-3 py-2 text-[var(--text-secondary)]">Workspace</span>
          </nav>
        </aside>
        <section className="min-w-0 flex-1 p-6 md:p-8">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-light)] pb-5">
            <div><p className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Projects</p><h1 className="mt-1 text-2xl font-semibold">{session.workspace?.name ?? 'Your workspace'}</h1></div>
            <div className="flex items-center gap-3">
              {session.workspaces.length > 0 && <label className="sr-only" htmlFor="workspace-selector">Current workspace</label>}
              {session.workspaces.length > 0 && <select id="workspace-selector" aria-label="Current workspace" className="rounded border border-[var(--border-light)] bg-[var(--bg-surface)] px-3 py-2 text-sm" value={session.workspace?.id ?? ''} onChange={event => { const value = event.currentTarget.value; if (value) void selectWorkspace(value); }}>
                {session.workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
              </select>}
              <span className="text-sm text-[var(--text-secondary)]">{session.user.name}</span>
              <Button variant="ghost" size="sm" onClick={() => void logout()}>Sign out</Button>
            </div>
          </header>
          {!isCanonicalRoute && <a className="mt-4 inline-block text-sm underline" href={dashboardPath}>Open dashboard</a>}
          {error && <p role="alert" className="my-4 text-sm">{error} <Button variant="secondary" size="sm" onClick={() => void load()}>Retry</Button></p>}
          {session.workspaces.length === 0 ? <div className="mt-10 max-w-md">
            <h2 className="text-lg font-medium">Create your first workspace</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Workspaces keep projects and publishing access separate. You can add collaborators later.</p>
            <form onSubmit={createWorkspace} className="mt-5 flex flex-wrap items-end gap-3">
              <label className="flex min-w-48 flex-1 flex-col gap-2 text-sm">Workspace name<input className="rounded border border-[var(--border-light)] bg-[var(--bg-canvas)] px-3 py-2" value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} required maxLength={200} /></label>
              <Button type="submit" variant="primary" loading={creatingWorkspace} disabled={!workspaceName.trim()}>Create workspace</Button>
            </form>
          </div> : <>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
              <div><h2 className="text-lg font-medium">Projects</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Projects in this workspace are saved on the control plane.</p></div>
              <form onSubmit={create} className="flex flex-wrap items-end gap-2">
                <label className="sr-only" htmlFor="project-name">Project name</label><input id="project-name" className="rounded border border-[var(--border-light)] bg-[var(--bg-canvas)] px-3 py-2 text-sm" placeholder="Project name" value={name} onChange={event => setName(event.target.value)} required maxLength={200} />
                <Button type="submit" variant="primary" loading={creating} disabled={creating || !name.trim()}>New project</Button>
              </form>
            </div>
            <div className="mt-6">{loading ? <p role="status">Loading projects…</p> : projects.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">No projects yet. Create one to get started.</p> : (
              <ul className="grid gap-3 sm:grid-cols-2" aria-label="Server projects">
                {projects.map(project => <li key={project.projectId} className="rounded-lg border border-[var(--border-light)] p-4 transition-colors hover:bg-[var(--bg-hover)]">
                  <a href={selfHostedProjectPath(project.projectId)} aria-label={`Open ${project.name}`} className="font-medium hover:underline">{project.name}</a>
                  <div className="mt-3 text-xs text-[var(--text-secondary)]"><span>Revision {project.revision}</span>{project.updatedAt && <time className="ml-3" dateTime={project.updatedAt}>Updated {formatDate(project.updatedAt)}</time>}</div>
                </li>)}
              </ul>
            )}</div>
          </>}
        </section>
      </div>
    </EntryShell>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
