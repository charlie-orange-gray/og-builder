import { isKnownProjectFormat, type ProjectData, type RevymeUser } from './types';

export interface ControlPlaneSession {
  user: RevymeUser;
  workspace: { id: string; name: string };
}

export interface ProjectSummary {
  projectId: string;
  workspaceId: string;
  name: string;
  revision: number;
  updatedAt: string;
}

export interface ServerProject extends ProjectSummary {
  snapshot: ProjectData;
  contentHash: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface SaveRequest {
  baseRevision: number;
  idempotencyKey: string;
  snapshot: ProjectData;
}

export interface SavedRevision {
  projectId: string;
  revision: number;
  contentHash: string;
  savedAt: string;
}
export interface StagingRelease {
  deploymentId: string;
  siteId: string;
  projectId: string;
  environment: 'staging';
  status: 'queued' | 'freezing' | 'frozen' | 'materialising' | 'ready-for-git' | 'ready-for-build' | 'failed';
  projectRevision: number;
  frozenRevisionId: string | null;
  materializationHash: string | null;
  git: { repository: string; branch: string; sha: string } | null;
  createdAt: string;
}
export interface RegisteredAsset {
  assetId: string;
  projectId: string;
  contentHash: string;
  logicalPath: string;
  mimeType: string;
  byteSize: number;
}

export class ControlPlaneError extends Error {
  constructor(message: string, readonly status: number, readonly code: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'ControlPlaneError';
  }
}

export class RevisionConflictError extends ControlPlaneError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'REVISION_CONFLICT', details);
    this.name = 'RevisionConflictError';
  }
}

export function isRetryablePersistenceError(error: unknown): boolean {
  return !(error instanceof ControlPlaneError) || error.status >= 500 || error.status === 429;
}

function projectPath(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ControlPlaneError('Select a server project before editing.', 400, 'INVALID_PROJECT_ID');
  }
  return `/projects/${id}`;
}

export class SelfHostedClient {
  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args)) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.transport(`/api${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    // Proxies may return an HTML/plain-text rejection. Its HTTP status still
    // distinguishes a definite rejected write from an uncertain acknowledgement.
    const body = response.ok ? await response.json() : await response.json().catch(() => null);
    if (!response.ok) {
      const error = body?.error;
      const message = typeof error?.message === 'string' ? error.message : `Request failed (${response.status}).`;
      if (response.status === 409 && error?.code === 'REVISION_CONFLICT') {
        throw new RevisionConflictError(message, error.details);
      }
      throw new ControlPlaneError(message, response.status, error?.code ?? 'REQUEST_FAILED', error?.details);
    }
    return body as T;
  }

  getSession(): Promise<ControlPlaneSession> {
    return this.request('/session');
  }

  startDevelopmentSession(): Promise<ControlPlaneSession> {
    return this.request('/dev/session', { method: 'POST', body: '{}' });
  }

  async listProjects(workspaceId: string): Promise<ProjectSummary[]> {
    const result = await this.request<{ projects: ProjectSummary[] }>(`/projects?workspaceId=${encodeURIComponent(workspaceId)}`);
    return result.projects;
  }

  createProject(name: string, workspaceId?: string): Promise<ProjectSummary> {
    return this.request('/projects', { method: 'POST', body: JSON.stringify({ name, workspaceId }) });
  }

  async loadProject(id: string): Promise<ServerProject> {
    const project = await this.request<ServerProject>(projectPath(id));
    if (project.projectId !== id || !Number.isSafeInteger(project.revision) || project.revision < 0 ||
      !project.snapshot || !isKnownProjectFormat(project.snapshot.format) ||
      !project.snapshot.files || typeof project.snapshot.files !== 'object' || Array.isArray(project.snapshot.files) ||
      Object.values(project.snapshot.files).some(value => typeof value !== 'string') ||
      !['owner', 'editor', 'viewer'].includes(project.role) || typeof project.contentHash !== 'string') {
      throw new ControlPlaneError('The server returned an invalid project snapshot. Editing is blocked to protect the saved project.', 502, 'INVALID_SNAPSHOT');
    }
    return project;
  }

  async saveProject(id: string, request: SaveRequest): Promise<SavedRevision> {
    const result = await this.request<SavedRevision>(projectPath(id), {
      method: 'PUT',
      headers: { 'If-Match': `"${request.baseRevision}"` },
      body: JSON.stringify(request),
    });
    if (result.projectId !== id || !Number.isSafeInteger(result.revision) || result.revision < request.baseRevision || typeof result.contentHash !== 'string') {
      throw new Error('The server returned an invalid save acknowledgement. Retry to verify the saved revision.');
    }
    return result;
  }

  prepareStagingRelease(id: string, expectedRevision: number, idempotencyKey: string = crypto.randomUUID()): Promise<StagingRelease> {
    return this.request<StagingRelease>(`${projectPath(id)}/publish`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ expectedRevision, environment: 'staging' }),
    });
  }

  renameProject(id: string, name: string): Promise<ProjectSummary> {
    return this.request(projectPath(id), { method: 'PATCH', body: JSON.stringify({ name }) });
  }

  async registerAsset(id: string, file: File): Promise<RegisteredAsset> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    const filename = file.name.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '') || 'asset';
    return this.request<RegisteredAsset>(`${projectPath(id)}/assets`, { method: 'POST', body: JSON.stringify({
      originalFilename: filename,
      mimeType: file.type || 'application/octet-stream',
      logicalPath: `public/uploads/${filename}`,
      contentBase64: btoa(binary),
    }) });
  }
}

/** Project management stays separate from ProjectBackend's load/save interface. */
export const selfHostedClient = new SelfHostedClient();
