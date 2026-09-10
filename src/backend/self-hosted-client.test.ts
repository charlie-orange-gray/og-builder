import { describe, expect, it } from 'vitest';
import { SelfHostedClient } from './self-hosted-client';

describe('SelfHostedClient assets', () => {
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
});
