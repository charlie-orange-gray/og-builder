/**
 * Shared management-domain vocabulary used by hosted and self-hosted modes.
 *
 * This is deliberately smaller than either backend's wire contract.  The
 * editor/dashboard can depend on these concepts without forcing the hosted
 * API's route names or the control plane's persistence details into UI code.
 */

export type DomainRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface DomainUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  isAdmin?: boolean;
}

export interface DomainWorkspace {
  id: string;
  name: string;
  role: DomainRole;
  logo?: string | null;
  isPersonal?: boolean;
  selected?: boolean;
}

export interface DomainSession {
  user: DomainUser;
  workspace: DomainWorkspace | null;
  workspaces: DomainWorkspace[];
}

export interface WebsiteSummary {
  id: string;
  name: string;
  workspaceId: string;
  updatedAt: string;
  effectiveRole: DomainRole;
  revision?: number;
  createdAt?: string;
  previewUrl?: string | null;
}

export function normalizeDomainUser(value: Omit<Partial<DomainUser>, 'name' | 'email'> & { id: string; name?: string | null; email?: string | null }): DomainUser {
  return {
    id: value.id,
    name: value.name?.trim() || value.email?.trim() || 'Revyme user',
    email: value.email?.trim() || '',
    ...(value.image ? { image: value.image } : {}),
    ...(typeof value.isAdmin === 'boolean' ? { isAdmin: value.isAdmin } : {}),
  };
}

export function normalizeDomainRole(role: string | null | undefined): DomainRole {
  return role === 'admin' || role === 'editor' || role === 'viewer' ? role : 'owner';
}

export function normalizeDomainWorkspace(workspace: (Partial<DomainWorkspace> & { id: string; name: string; role?: string }) | null | undefined): DomainWorkspace | null {
  if (!workspace) return null;
  return {
    id: workspace.id,
    name: workspace.name,
    role: normalizeDomainRole(workspace.role),
    ...(workspace.logo !== undefined ? { logo: workspace.logo } : {}),
    ...(typeof workspace.isPersonal === 'boolean' ? { isPersonal: workspace.isPersonal } : {}),
  };
}

export function normalizeDomainSession(value: {
  user: Partial<DomainUser> & { id: string; name?: string | null; email?: string | null };
  workspace?: (Partial<DomainWorkspace> & { id: string; name: string; role?: string }) | null;
  workspaces?: Array<Partial<DomainWorkspace> & { id: string; name: string; role?: string }>;
}): DomainSession {
  const workspaces = (value.workspaces ?? []).map(item => normalizeDomainWorkspace(item)).filter((item): item is DomainWorkspace => item !== null);
  const selected = normalizeDomainWorkspace(value.workspace);
  return {
    user: normalizeDomainUser(value.user),
    workspace: selected,
    workspaces: workspaces.map(item => ({ ...item, selected: item.id === selected?.id })),
  };
}

export function normalizeWebsiteSummary(value: {
  id?: string;
  projectId?: string;
  name: string;
  workspaceId: string;
  updatedAt: string;
  role?: string;
  effectiveRole?: string;
  revision?: number;
  createdAt?: string;
}): WebsiteSummary {
  const id = value.id ?? value.projectId;
  if (!id) throw new Error('A website summary requires an id.');
  return {
    id,
    name: value.name,
    workspaceId: value.workspaceId,
    updatedAt: value.updatedAt,
    effectiveRole: normalizeDomainRole(value.effectiveRole ?? value.role),
    ...(value.revision === undefined ? {} : { revision: value.revision }),
    ...(value.createdAt === undefined ? {} : { createdAt: value.createdAt }),
  };
}
