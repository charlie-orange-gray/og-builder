import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDashboardProvider, resolvePersistenceProvider } from './capabilities';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('persistence capabilities', () => {
  it.each([
    [false, undefined, 'local'], [false, 'false', 'local'], [false, 'TRUE', 'local'],
    [false, 'true', 'self-hosted'], [true, undefined, 'cloud'], [true, 'true', 'cloud'],
  ] as const)('cloud=%s selfHosted=%s selects %s', (cloud, selfHosted, expected) => {
    expect(resolvePersistenceProvider(cloud, selfHosted)).toBe(expected);
  });

  it('publishing alone does not opt into server persistence', async () => {
    vi.stubEnv('VITE_REVYME_CLOUD', '');
    vi.stubEnv('VITE_SELF_HOSTED_PERSISTENCE', '');
    vi.stubEnv('VITE_SELF_HOSTED_PUBLISH', 'true');
    vi.resetModules();
    expect((await import('./capabilities')).backendCapabilities.persistence).toBe('local');
  });

  it.each([
    [false, 'local', 'local'],
    [false, 'self-hosted', 'self-hosted'],
    [true, 'self-hosted', 'cloud'],
    [true, 'cloud', 'cloud'],
  ] as const)('cloud=%s persistence=%s selects dashboard %s', (cloud, persistence, expected) => {
    expect(resolveDashboardProvider(cloud, persistence)).toBe(expected);
  });
});
