import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SelfHostedRoot from './SelfHostedRoot';
import { ControlPlaneError, selfHostedClient } from '@/backend/self-hosted-client';

vi.mock('@/ProjectLoader', () => ({ default: () => <div>Loaded editor boundary</div> }));
vi.mock('@/backend/self-hosted-client', async importOriginal => ({
  ...await importOriginal<typeof import('@/backend/self-hosted-client')>(),
  selfHostedClient: { getSession: vi.fn(), startDevelopmentSession: vi.fn(), startGitHubLogin: vi.fn(), pollGitHubLogin: vi.fn(), logout: vi.fn(), listProjects: vi.fn(), createProject: vi.fn(), createWorkspace: vi.fn(), selectWorkspace: vi.fn() },
}));

const id = '00000000-0000-4000-8000-000000000001';
const session = { user: { id: 'user', name: 'Developer', email: 'dev@example.test' }, workspace: { id: 'workspace', name: 'Agency', role: 'owner' as const }, workspaces: [{ id: 'workspace', name: 'Agency', role: 'owner' as const }] };

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  vi.mocked(selfHostedClient.getSession).mockResolvedValue(session);
  vi.mocked(selfHostedClient.listProjects).mockResolvedValue([{ projectId: id, name: 'Photography', workspaceId: 'workspace', revision: 3, updatedAt: '2026-09-09T00:00:00Z' }]);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); window.history.replaceState({}, '', '/'); });

describe('self-hosted project entry', () => {
  it('lists server projects and provides a named create control', async () => {
    render(<SelfHostedRoot />);
    const link = await screen.findByRole('link', { name: 'Open Photography' });
    expect(link.getAttribute('href')).toBe(`/builder/${id}`);
    expect(screen.getByRole('textbox', { name: 'Website name' })).toBeTruthy();
    expect(selfHostedClient.listProjects).toHaveBeenCalledWith('workspace');
    expect(screen.queryByText('Loaded editor boundary')).toBeNull();
  });

  it('uses an explicit development-session action when unauthenticated', async () => {
    vi.mocked(selfHostedClient.getSession).mockRejectedValue(new ControlPlaneError('Unauthenticated', 401, 'UNAUTHENTICATED'));
    vi.mocked(selfHostedClient.startDevelopmentSession).mockResolvedValue(session);
    render(<SelfHostedRoot />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start development session' }));
    await screen.findByRole('link', { name: 'Open Photography' });
    expect(selfHostedClient.startDevelopmentSession).toHaveBeenCalledTimes(1);
  });

  it('offers the production GitHub Device Flow and enters the dashboard after approval', async () => {
    vi.mocked(selfHostedClient.getSession).mockRejectedValue(new ControlPlaneError('Unauthenticated', 401, 'UNAUTHENTICATED'));
    vi.mocked(selfHostedClient.startGitHubLogin).mockResolvedValue({ flowId: 'flow-id', verificationUri: 'https://github.test/login/device', userCode: 'ABCD-EFGH', expiresIn: 600, interval: 1 });
    vi.mocked(selfHostedClient.pollGitHubLogin).mockResolvedValue({ status: 'authenticated', session });
    render(<SelfHostedRoot />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with GitHub' }));
    expect((await screen.findByRole('link', { name: 'Open GitHub verification' })).getAttribute('href')).toBe('https://github.test/login/device');
    expect(await screen.findByRole('link', { name: 'Open Photography' })).toBeTruthy();
    expect(selfHostedClient.pollGitHubLogin).toHaveBeenCalledWith('flow-id');
  });

  it('does not mount the editor or create a fallback project when session lookup fails', async () => {
    vi.mocked(selfHostedClient.getSession).mockRejectedValue(new Error('Control plane offline'));
    render(<SelfHostedRoot />);
    expect((await screen.findByRole('alert')).textContent).toContain('Control plane offline');
    expect(screen.queryByText('Loaded editor boundary')).toBeNull();
    expect(selfHostedClient.createProject).not.toHaveBeenCalled();
  });

  it('passes a valid server project route through the existing loader', async () => {
    window.history.replaceState({}, '', `/builder/${id}`);
    render(<SelfHostedRoot />);
    await screen.findByText('Loaded editor boundary');
    expect(selfHostedClient.listProjects).not.toHaveBeenCalled();
  });

  it('serves the explicit dashboard route from the same server-backed project list', async () => {
    window.history.replaceState({}, '', '/dashboard');
    render(<SelfHostedRoot />);
    expect((await screen.findByRole('link', { name: 'Open Photography' })).getAttribute('href')).toBe(`/builder/${id}`);
    expect(screen.getByRole('heading', { name: 'Agency' })).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
    expect(selfHostedClient.listProjects).toHaveBeenCalledWith('workspace');
  });

  it('reports failed creation and retains the entered project name', async () => {
    vi.mocked(selfHostedClient.createProject).mockRejectedValue(new Error('Project limit reached'));
    render(<SelfHostedRoot />);
    await screen.findByRole('textbox', { name: 'Website name' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Website name' }), { target: { value: 'Music site' } });
    fireEvent.click(screen.getByRole('button', { name: '+ New Website' }));
    await waitFor(() => expect(selfHostedClient.createProject).toHaveBeenCalledWith('Music site', 'workspace'));
    expect((await screen.findByRole('alert')).textContent).toContain('Project limit reached');
    expect((screen.getByRole('textbox', { name: 'Website name' }) as HTMLInputElement).value).toBe('Music site');
  });

  it('switches between server-provided workspaces', async () => {
    const multiWorkspaceSession = { ...session, workspaces: [...session.workspaces, { id: 'client', name: 'Client', role: 'editor' as const }] };
    vi.mocked(selfHostedClient.getSession).mockResolvedValue(multiWorkspaceSession);
    vi.mocked(selfHostedClient.selectWorkspace).mockResolvedValue({ ...multiWorkspaceSession, workspace: { id: 'client', name: 'Client', role: 'editor' } });
    render(<SelfHostedRoot />);
    await screen.findByRole('link', { name: 'Open Photography' });
    fireEvent.click(screen.getByRole('button', { name: /Agency/ }));
    fireEvent.click(screen.getByRole('button', { name: /Client/ }));
    await waitFor(() => expect(selfHostedClient.selectWorkspace).toHaveBeenCalledWith('client'));
    expect(await screen.findByRole('heading', { name: 'Client' })).toBeTruthy();
  });

  it('offers first-workspace provisioning without inventing a default workspace', async () => {
    const empty = { ...session, workspace: null, workspaces: [] };
    vi.mocked(selfHostedClient.getSession).mockResolvedValue(empty);
    vi.mocked(selfHostedClient.createWorkspace).mockResolvedValue(session);
    render(<SelfHostedRoot />);
    expect(await screen.findByRole('heading', { name: 'Create your first workspace' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Workspace name' }), { target: { value: 'Personal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    await waitFor(() => expect(selfHostedClient.createWorkspace).toHaveBeenCalledWith('Personal'));
  });

  it('filters websites in the selected workspace and exposes real settings sections', async () => {
    vi.mocked(selfHostedClient.listProjects).mockResolvedValue([
      { projectId: id, name: 'Photography', workspaceId: 'workspace', revision: 3, updatedAt: '2026-09-09T00:00:00Z' },
      { projectId: `${id.slice(0, -1)}2`, name: 'Music', workspaceId: 'workspace', revision: 1, updatedAt: '2026-09-09T00:00:00Z' },
    ]);
    render(<SelfHostedRoot />);
    await screen.findByRole('link', { name: 'Open Photography' });
    fireEvent.change(screen.getByPlaceholderText('Search websites'), { target: { value: 'music' } });
    expect(screen.queryByRole('link', { name: 'Open Photography' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Music' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Agency/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Account' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    expect(await screen.findByRole('heading', { name: 'Security' })).toBeTruthy();
  });
});
