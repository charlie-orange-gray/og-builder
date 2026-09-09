import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadFlags(cloud: string | undefined, selfHosted: string | undefined) {
  vi.stubEnv('VITE_REVYME_CLOUD', cloud ?? '');
  vi.stubEnv('VITE_SELF_HOSTED_PUBLISH', selfHosted ?? '');
  vi.resetModules();
  return import('./publish-flag');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('publishing capability flags', () => {
  it('is disabled in standalone mode by default', async () => {
    const flags = await loadFlags(undefined, undefined);

    expect(flags.PUBLISH_ENABLED).toBe(false);
  });

  it('keeps Revyme Cloud publishing enabled', async () => {
    const flags = await loadFlags('true', undefined);

    expect(flags.PUBLISH_ENABLED).toBe(true);
  });

  it('enables publishing without enabling Revyme Cloud', async () => {
    const flags = await loadFlags(undefined, 'true');

    expect(flags.PUBLISH_ENABLED).toBe(true);
  });

  it('requires the exact string "true"', async () => {
    const flags = await loadFlags('false', 'TRUE');

    expect(flags.PUBLISH_ENABLED).toBe(false);
  });
});
