import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SelfHostedRoot from './SelfHostedRoot';
import { ControlPlaneError, selfHostedClient } from '@/backend/self-hosted-client';

vi.mock('@/ProjectLoader', () => ({ default: () => <div>Loaded editor boundary</div> }));
vi.mock('@/backend/self-hosted-client', async importOriginal => ({
  ...await importOriginal<typeof import('@/backend/self-hosted-client')>(),
  selfHostedClient: { getSession: vi.fn(), startDevelopmentSession: vi.fn(), listProjects: vi.fn(), createProject: vi.fn() },
}));

const id = '00000000-0000-4000-8000-000000000001';
const session = { user: { id: 'user', name: 'Developer', email: 'dev@example.test' }, workspace: { id: 'workspace', name: 'Agency' } };

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
    expect(screen.getByRole('textbox', { name: 'Project name' })).toBeTruthy();
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

  it('reports failed creation and retains the entered project name', async () => {
    vi.mocked(selfHostedClient.createProject).mockRejectedValue(new Error('Project limit reached'));
    render(<SelfHostedRoot />);
    await screen.findByRole('textbox', { name: 'Project name' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), { target: { value: 'Music site' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(selfHostedClient.createProject).toHaveBeenCalledWith('Music site', 'workspace'));
    expect((await screen.findByRole('alert')).textContent).toContain('Project limit reached');
    expect((screen.getByRole('textbox', { name: 'Project name' }) as HTMLInputElement).value).toBe('Music site');
  });
});
