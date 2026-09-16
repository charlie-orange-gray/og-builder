import { describe, expect, it, vi } from 'vitest';
import { SelfHostedBackend } from './self-hosted-backend';
import { ControlPlaneError, RevisionConflictError, SelfHostedClient } from './self-hosted-client';
import type { ProjectData } from './types';

const id = '00000000-0000-4000-8000-000000000001';
const data = (text = 'original'): ProjectData => ({ format: 'revyme-v1', files: { 'app/page.tsx': text } });
const loaded = (revision = 1) => ({ projectId: id, workspaceId: 'workspace', name: 'Photography', revision, contentHash: 'hash', snapshot: data(), role: 'owner', updatedAt: '2026-09-09T00:00:00Z' });
const saved = (revision: number) => ({ projectId: id, revision, contentHash: `hash-${revision}`, savedAt: '2026-09-09T00:00:01Z' });
const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (code: string, status: number) => json({ error: { code, message: code, details: { revision: 8, contentHash: 'newer' } } }, status);

function setup() {
  const transport = vi.fn<typeof fetch>();
  return { transport, backend: new SelfHostedBackend(new SelfHostedClient(transport)) };
}

describe('SelfHostedBackend', () => {
  it('shares initial metadata load and sends the loaded revision with a full snapshot', async () => {
    const { transport, backend } = setup();
    transport.mockResolvedValueOnce(json(loaded())).mockResolvedValueOnce(json(saved(2)));
    const [snapshot, name, role, workspace] = await Promise.all([
      backend.loadProject(id), backend.getWebsiteName(id), backend.getWebsiteRole(id), backend.getWebsiteWorkspaceId(id),
    ]);
    expect(transport).toHaveBeenCalledTimes(1);
    expect({ snapshot, name, role, workspace }).toEqual({ snapshot: data(), name: 'Photography', role: 'owner', workspace: 'workspace' });
    await backend.saveProject(id, data('edit'));
    const request = transport.mock.calls[1][1]!;
    expect(request.headers).toMatchObject({ 'If-Match': '"1"' });
    expect(JSON.parse(String(request.body))).toMatchObject({ baseRevision: 1, snapshot: data('edit') });
    expect(JSON.parse(String(request.body)).idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
    expect(request.credentials).toBe('same-origin');
  });

  it('never saves an unresolved project or one whose load failed', async () => {
    const { transport, backend } = setup();
    await expect(backend.saveProject(id, data())).rejects.toMatchObject({ code: 'PROJECT_NOT_LOADED' });
    expect(transport).not.toHaveBeenCalled();
    transport.mockResolvedValueOnce(fail('NOT_FOUND', 404));
    await expect(backend.loadProject(id)).rejects.toMatchObject({ status: 404 });
    await expect(backend.saveProject(id, data())).rejects.toMatchObject({ code: 'PROJECT_NOT_LOADED' });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid snapshot instead of returning null and seeding a blank editor', async () => {
    const { transport, backend } = setup();
    transport.mockResolvedValueOnce(json({ ...loaded(), snapshot: { format: 'unknown', files: {} } }));
    await expect(backend.loadProject(id)).rejects.toMatchObject({ code: 'INVALID_SNAPSHOT' });
  });

  it('preserves loaded settings on file-only autosave and recovery export, with explicit settings taking precedence', async () => {
    const { transport, backend } = setup();
    const settings = { websiteName: 'Photography', fonts: ['Inter'] };
    transport.mockResolvedValueOnce(json({ ...loaded(), snapshot: { ...data(), settings } }))
      .mockResolvedValueOnce(json(saved(2)))
      .mockResolvedValueOnce(json(saved(3)));
    await backend.loadProject(id);
    expect(backend.completeSnapshot(id, data('local copy')).settings).toEqual(settings);
    await backend.saveProject(id, data('files changed'));
    expect(JSON.parse(String(transport.mock.calls[1][1]?.body)).snapshot.settings).toEqual(settings);
    await backend.saveProject(id, { ...data('new settings'), settings: { websiteName: 'Music' } });
    expect(JSON.parse(String(transport.mock.calls[2][1]?.body)).snapshot.settings).toEqual({ websiteName: 'Music' });
  });

  it('never adopts a conflicting revision or silently retries newer edits after a conflict', async () => {
    const { transport, backend } = setup();
    transport.mockResolvedValueOnce(json(loaded())).mockResolvedValueOnce(fail('REVISION_CONFLICT', 409));
    await backend.loadProject(id);
    await expect(backend.saveProject(id, data('stale'))).rejects.toBeInstanceOf(RevisionConflictError);
    await expect(backend.saveProject(id, data('more stale'))).rejects.toBeInstanceOf(RevisionConflictError);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('replays an uncertain save with exactly the same key and payload before newer edits', async () => {
    const { transport, backend } = setup();
    transport.mockResolvedValueOnce(json(loaded()))
      .mockRejectedValueOnce(new TypeError('connection lost after commit'))
      .mockResolvedValueOnce(json(saved(2)))
      .mockResolvedValueOnce(json(saved(3)));
    await backend.loadProject(id);
    await expect(backend.saveProject(id, data('first'))).rejects.toThrow('connection lost');
    await backend.saveProject(id, data('second'));
    expect(transport.mock.calls[1][1]?.body).toEqual(transport.mock.calls[2][1]?.body);
    const newer = JSON.parse(String(transport.mock.calls[3][1]?.body));
    expect(newer).toMatchObject({ baseRevision: 2, snapshot: data('second') });
    expect(newer.idempotencyKey).not.toBe(JSON.parse(String(transport.mock.calls[1][1]?.body)).idempotencyKey);
  });

  it('allows a corrected snapshot after a definite oversized rejection', async () => {
    const { transport, backend } = setup();
    transport.mockResolvedValueOnce(json(loaded()))
      .mockResolvedValueOnce(fail('SNAPSHOT_TOO_LARGE', 413))
      .mockResolvedValueOnce(json(saved(2)));
    await backend.loadProject(id);
    await expect(backend.saveProject(id, data('oversized'))).rejects.toMatchObject({ status: 413 });
    await backend.saveProject(id, data('corrected'));
    const rejected = JSON.parse(String(transport.mock.calls[1][1]?.body));
    const corrected = JSON.parse(String(transport.mock.calls[2][1]?.body));
    expect(corrected).toMatchObject({ baseRevision: 1, snapshot: data('corrected') });
    expect(corrected.idempotencyKey).not.toBe(rejected.idempotencyKey);
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it('honors a non-JSON proxy rejection and permits the next corrected save', async () => {
    const { transport, backend } = setup();
    transport.mockResolvedValueOnce(json(loaded()))
      .mockResolvedValueOnce(new Response('Request too large', { status: 413 }))
      .mockResolvedValueOnce(json(saved(2)));
    await backend.loadProject(id);
    await expect(backend.saveProject(id, data('large'))).rejects.toMatchObject({ status: 413, code: 'REQUEST_FAILED' });
    await backend.saveProject(id, data('smaller'));
    expect(JSON.parse(String(transport.mock.calls[2][1]?.body)).snapshot).toEqual(data('smaller'));
  });

  it('serializes callers outside autosave so they use successive accepted revisions', async () => {
    const { transport, backend } = setup();
    let accept: (value: Response) => void = () => {};
    transport.mockResolvedValueOnce(json(loaded()))
      .mockImplementationOnce(() => new Promise(resolve => { accept = resolve; }))
      .mockResolvedValueOnce(json(saved(3)));
    await backend.loadProject(id);
    const first = backend.saveProject(id, data('first'));
    const second = backend.saveProject(id, data('second'));
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    accept(json(saved(2)));
    await Promise.all([first, second]);
    expect(JSON.parse(String(transport.mock.calls[2][1]?.body)).baseRevision).toBe(2);
  });

  it('does not grant write access to viewers', async () => {
    const { transport, backend } = setup();
    transport.mockResolvedValueOnce(json({ ...loaded(), role: 'viewer' }));
    await backend.loadProject(id);
    await expect(backend.saveProject(id, data())).rejects.toBeInstanceOf(ControlPlaneError);
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
