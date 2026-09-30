import { describe, expect, it } from 'vitest';
import { SelfHostedClient } from './self-hosted-client';

describe('SelfHostedClient assets', () => {
  it('uses workspace-scoped folder and website lifecycle endpoints', async () => {
    const requests: Array<{ url: string; method: string; body?: unknown }> = [];
    const client = new SelfHostedClient(async (input, init) => {
      requests.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const url = String(input);
      if (url.endsWith('/folders') && (init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ folders: [] }), { status: 200 });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (url.includes('/duplicate')) return new Response(JSON.stringify({ projectId: '22222222-2222-4222-8222-222222222222', name: 'Copy', workspaceId: 'workspace', revision: 0, folderId: null, archivedAt: null, updatedAt: 'now' }), { status: 201 });
      return new Response(JSON.stringify({ id: 'folder-id', workspaceId: 'workspace', name: 'Sites', createdAt: 'now', projectId: 'project-id', folderId: null, archivedAt: null }), { status: 200 });
    });
    await client.listFolders('workspace');
    await client.createFolder('workspace', 'Sites');
    await client.renameFolder('folder-id', 'Client sites');
    await client.deleteFolder('folder-id');
    await client.duplicateProject('11111111-1111-4111-8111-111111111111', 'Copy');
    await client.archiveProject('11111111-1111-4111-8111-111111111111', true);
    await client.moveProject('11111111-1111-4111-8111-111111111111', null);
    expect(requests.map(request => `${request.method} ${request.url}`)).toEqual([
      'GET /api/workspaces/workspace/folders', 'POST /api/workspaces/workspace/folders', 'PATCH /api/folders/folder-id',
      'DELETE /api/folders/folder-id', 'POST /api/projects/11111111-1111-4111-8111-111111111111/duplicate',
      'POST /api/projects/11111111-1111-4111-8111-111111111111/archive', 'POST /api/projects/11111111-1111-4111-8111-111111111111/folder',
    ]);
    expect(requests[1].body).toEqual({ name: 'Sites' });
    expect(requests[6].body).toEqual({ folderId: null });
  });

  it('starts and polls production login without accepting credentials in JSON', async () => {
    const requests: string[] = [];
    const client = new SelfHostedClient(async (input, init) => {
      requests.push(`${String(input)}:${init?.method}`);
      if (String(input).endsWith('/auth/github/device')) return new Response(JSON.stringify({ flowId: 'flow-id', verificationUri: 'https://github.com/login/device', userCode: 'ABCD-EFGH', expiresIn: 600, interval: 5 }), { status: 201 });
      return new Response(JSON.stringify({ status: 'authenticated', session: { user: { id: 'u', name: 'Maintainer', email: 'maintainer@example.test' }, workspace: { id: 'w', name: 'Agency' } } }), { status: 200 });
    });
    const start = await client.startGitHubLogin();
    expect(start.userCode).toBe('ABCD-EFGH');
    expect(JSON.stringify(start)).not.toContain('token');
    expect(await client.pollGitHubLogin(start.flowId)).toMatchObject({ status: 'authenticated' });
    expect(requests).toEqual(['/api/auth/github/device:POST', '/api/auth/github/device/flow-id:POST']);
  });

  it('handles the empty response from logout', async () => {
    let method = '';
    const client = new SelfHostedClient(async (_input, init) => { method = init?.method ?? ''; return new Response(null, { status: 204 }); });
    await expect(client.logout()).resolves.toBeUndefined();
    expect(method).toBe('POST');
  });

  it('registers browser files as project-scoped immutable asset URLs', async () => {
    let requestBody: Record<string, unknown> | undefined;
    const client = new SelfHostedClient(async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ assetId: 'asset-id', projectId: '11111111-1111-4111-8111-111111111111', contentHash: 'sha256:' + 'a'.repeat(64), logicalPath: 'public/uploads/hero.svg', mimeType: 'image/svg+xml', byteSize: 5 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const asset = await client.registerAsset('11111111-1111-4111-8111-111111111111', new File(['hello'], '../hero image.svg', { type: 'image/svg+xml' }));
    expect(asset.logicalPath).toBe('public/uploads/hero.svg');
    expect(requestBody).toMatchObject({ originalFilename: '_hero_image.svg', mimeType: 'image/svg+xml', logicalPath: 'public/uploads/_hero_image.svg' });
    expect(requestBody?.contentBase64).toBe('aGVsbG8=');
  });

  it('prepares staging from the exact loaded revision and sends an idempotency key', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const client = new SelfHostedClient(async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify({
        deploymentId: 'deployment-id', siteId: 'site-id', projectId: '11111111-1111-4111-8111-111111111111',
        environment: 'staging', status: 'ready-for-build', projectRevision: 7,
        frozenRevisionId: 'frozen-id', materializationHash: 'sha256:' + 'b'.repeat(64), createdAt: '2026-09-10T00:00:00.000Z',
        git: { repository: 'test-owner/test-project', branch: 'staging', sha: 'c'.repeat(40) },
        image: null, slot: null, containerId: null, stagingUrl: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const release = await client.prepareStagingRelease('11111111-1111-4111-8111-111111111111', 7, 'publish-key-1');
    expect(release.status).toBe('ready-for-build');
    expect(requestUrl).toContain('/api/projects/11111111-1111-4111-8111-111111111111/publish');
    expect(requestInit?.headers).toMatchObject({ 'Idempotency-Key': 'publish-key-1' });
    expect(JSON.parse(String(requestInit?.body))).toEqual({ expectedRevision: 7, environment: 'staging' });
  });

  it('requests staging deployment by immutable deployment ID', async () => {
    let requestUrl = ''; let requestMethod = '';
    const client = new SelfHostedClient(async (input, init) => {
      requestUrl = String(input); requestMethod = init?.method ?? 'GET';
      return new Response(JSON.stringify({
        deploymentId: 'deployment-id', siteId: 'site-id', projectId: '11111111-1111-4111-8111-111111111111', environment: 'staging', status: 'active', projectRevision: 7,
        frozenRevisionId: 'frozen-id', materializationHash: 'sha256:' + 'b'.repeat(64), git: { repository: 'test-owner/test-project', branch: 'staging', sha: 'c'.repeat(40) },
        image: { tag: 'og/test-project:' + 'c'.repeat(40), digest: 'sha256:' + 'd'.repeat(64), id: 'sha256:' + 'e'.repeat(64) }, slot: 'green', containerId: 'container-id', stagingUrl: 'http://127.0.0.1:18080', createdAt: '2026-09-10T00:00:00.000Z',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const release = await client.deployStaging('deployment-id');
    expect(requestUrl).toBe('/api/deployments/deployment-id/staging'); expect(requestMethod).toBe('POST'); expect(release.status).toBe('active'); expect(release.stagingUrl).toContain('127.0.0.1');
  });

  it('promotes and rolls back only by server-selected deployment IDs', async () => {
    const requests: string[] = [];
    const client = new SelfHostedClient(async (input, init) => {
      requests.push(`${String(input)}:${init?.method}:${String((init?.headers as Record<string, string>)?.['Idempotency-Key'])}`);
      return new Response(JSON.stringify({ deploymentId: 'production-id', siteId: 'site-id', projectId: 'project-id', environment: 'production', action: 'promote', status: 'active', projectRevision: 7, frozenRevisionId: 'frozen-id', materializationHash: null, git: null, image: null, slot: 'blue', containerId: 'container', productionUrl: 'http://production.example.test', sourceDeploymentId: 'staging-id', createdAt: '2026-09-10T00:00:00.000Z' }), { status: 202, headers: { 'Content-Type': 'application/json' } });
    });
    await client.promoteProduction('staging-id', 'promote-key');
    await client.rollbackProduction('production-id', 'rollback-key');
    expect(requests).toEqual(['/api/deployments/staging-id/promote:POST:promote-key', '/api/deployments/production-id/rollback:POST:rollback-key']);
  });
});
