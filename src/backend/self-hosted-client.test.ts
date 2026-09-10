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
});
