import { CLOUD_ENABLED } from '@/shared/cloud-flag';

export type PersistenceProvider = 'local' | 'cloud' | 'self-hosted';
export type DashboardProvider = 'local' | 'cloud' | 'self-hosted';

export function resolvePersistenceProvider(cloud: boolean, selfHosted: string | undefined): PersistenceProvider {
  if (cloud) return 'cloud';
  return selfHosted === 'true' ? 'self-hosted' : 'local';
}

/**
 * Dashboard ownership is a separate capability from persistence. Keeping the
 * decision here gives the shell one stable contract instead of making every
 * navigation item inspect environment variables independently.
 */
export function resolveDashboardProvider(
  cloud: boolean,
  persistence: PersistenceProvider,
): DashboardProvider {
  if (cloud || persistence === 'cloud') return 'cloud';
  if (persistence === 'self-hosted') return 'self-hosted';
  return 'local';
}

const persistence = resolvePersistenceProvider(CLOUD_ENABLED, import.meta.env.VITE_SELF_HOSTED_PERSISTENCE);
const dashboard = resolveDashboardProvider(CLOUD_ENABLED, persistence);

/** Persistence and publishing are separate capabilities. Cloud retains precedence. */
export const backendCapabilities = {
  persistence,
  dashboard,
  selfHostedDashboard: dashboard === 'self-hosted',
  versionedPersistence: persistence === 'self-hosted',
  projectManagement: dashboard === 'self-hosted',
  stagingDeployment: persistence === 'self-hosted' && import.meta.env.VITE_SELF_HOSTED_DOCKER === 'true',
  productionPromotion: persistence === 'self-hosted' && import.meta.env.VITE_SELF_HOSTED_PRODUCTION === 'true',
} as const;

if (CLOUD_ENABLED && import.meta.env.VITE_SELF_HOSTED_PERSISTENCE === 'true') {
  console.warn('[Revyme] Cloud and self-hosted persistence are both configured; using Revyme Cloud.');
}
