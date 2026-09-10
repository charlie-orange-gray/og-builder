import { CLOUD_ENABLED } from '@/shared/cloud-flag';

export type PersistenceProvider = 'local' | 'cloud' | 'self-hosted';

export function resolvePersistenceProvider(cloud: boolean, selfHosted: string | undefined): PersistenceProvider {
  if (cloud) return 'cloud';
  return selfHosted === 'true' ? 'self-hosted' : 'local';
}

const persistence = resolvePersistenceProvider(CLOUD_ENABLED, import.meta.env.VITE_SELF_HOSTED_PERSISTENCE);

/** Persistence and publishing are separate capabilities. Cloud retains precedence. */
export const backendCapabilities = {
  persistence,
  versionedPersistence: persistence === 'self-hosted',
  projectManagement: persistence === 'self-hosted',
  stagingDeployment: persistence === 'self-hosted' && import.meta.env.VITE_SELF_HOSTED_DOCKER === 'true',
} as const;

if (CLOUD_ENABLED && import.meta.env.VITE_SELF_HOSTED_PERSISTENCE === 'true') {
  console.warn('[Revyme] Cloud and self-hosted persistence are both configured; using Revyme Cloud.');
}
