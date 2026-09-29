/** Canonical paths owned by the self-hosted editor shell. */
export const SELF_HOSTED_DASHBOARD_PATH = '/dashboard';

const PROJECT_PATH = /^\/builder\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

export function isSelfHostedDashboardPath(pathname: string): boolean {
  return pathname === SELF_HOSTED_DASHBOARD_PATH || pathname === `${SELF_HOSTED_DASHBOARD_PATH}/`;
}

export function getSelfHostedProjectId(pathname: string): string | null {
  return pathname.match(PROJECT_PATH)?.[1] ?? null;
}

export function selfHostedProjectPath(projectId: string): string {
  return `/builder/${encodeURIComponent(projectId)}`;
}
