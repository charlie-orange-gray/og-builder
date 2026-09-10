import type { ProjectBackend, ProjectData, RevymeUser, WorkspaceFont } from './types';
import { ControlPlaneError, isRetryablePersistenceError, RevisionConflictError, SelfHostedClient, selfHostedClient, type SaveRequest, type ServerProject, type StagingRelease } from './self-hosted-client';

/** Revision state is private to this adapter; a failed load never enables saving. */
export class SelfHostedBackend implements ProjectBackend {
  private readonly projects = new Map<string, ServerProject>();
  private readonly loads = new Map<string, Promise<ServerProject>>();
  private readonly queues = new Map<string, Promise<void>>();
  private readonly pending = new Map<string, SaveRequest>();
  private readonly conflicts = new Map<string, RevisionConflictError>();

  constructor(private readonly client: SelfHostedClient = selfHostedClient) {}

  async getUser(): Promise<RevymeUser | null> {
    try { return (await this.client.getSession()).user; }
    catch (error) {
      if (error instanceof ControlPlaneError && error.status === 401) return null;
      throw error;
    }
  }

  private read(id: string): Promise<ServerProject> {
    const cached = this.projects.get(id);
    if (cached) return Promise.resolve(cached);
    const loading = this.loads.get(id);
    if (loading) return loading;
    const request = this.client.loadProject(id).then(project => {
      this.projects.set(id, project);
      return project;
    }).finally(() => this.loads.delete(id));
    this.loads.set(id, request);
    return request;
  }

  async loadProject(id: string): Promise<ProjectData> {
    return (await this.read(id)).snapshot;
  }

  completeSnapshot(id: string, data: ProjectData): ProjectData {
    const settings = data.settings ?? this.projects.get(id)?.snapshot.settings;
    return structuredClone(settings === undefined ? data : { ...data, settings });
  }

  saveProject(id: string, data: ProjectData): Promise<void> {
    // Callers may bypass autosave (manual flush, plugins). Serialize those too.
    const snapshot = structuredClone(data);
    const previous = this.queues.get(id) ?? Promise.resolve();
    const save = previous.catch(() => undefined).then(() => this.saveSerial(id, snapshot));
    this.queues.set(id, save);
    void save.finally(() => { if (this.queues.get(id) === save) this.queues.delete(id); }).catch(() => undefined);
    return save;
  }

  private async saveSerial(id: string, data: ProjectData): Promise<void> {
    const conflict = this.conflicts.get(id);
    if (conflict) throw conflict;
    const project = this.projects.get(id);
    if (!project) throw new ControlPlaneError('The project must load successfully before it can be saved.', 400, 'PROJECT_NOT_LOADED');
    if (project.role === 'viewer') throw new ControlPlaneError('You have read-only access to this project.', 403, 'READ_ONLY');
    const uncertain = this.pending.get(id);
    if (uncertain) {
      // A response can be lost AFTER commit. Recover that exact request first.
      await this.accept(id, uncertain);
      if (JSON.stringify(uncertain.snapshot) === JSON.stringify(this.completeSnapshot(id, data))) return;
    }
    const current = this.projects.get(id)!;
    const request: SaveRequest = { baseRevision: current.revision, idempotencyKey: crypto.randomUUID(), snapshot: this.completeSnapshot(id, data) };
    this.pending.set(id, request);
    await this.accept(id, request);
  }

  private async accept(id: string, request: SaveRequest): Promise<void> {
    try {
      const saved = await this.client.saveProject(id, request);
      const project = this.projects.get(id)!;
      this.projects.set(id, { ...project, snapshot: request.snapshot, revision: saved.revision, contentHash: saved.contentHash, updatedAt: saved.savedAt });
      this.pending.delete(id);
    } catch (error) {
      if (error instanceof RevisionConflictError) this.conflicts.set(id, error);
      if (!isRetryablePersistenceError(error)) this.pending.delete(id);
      // Retain uncertain requests for idempotent retry; never adopt a conflict's revision.
      throw error;
    }
  }

  async renameWebsite(id: string, name: string): Promise<void> {
    const result = await this.client.renameProject(id, name);
    const project = this.projects.get(id);
    if (project) this.projects.set(id, { ...project, name: result.name });
  }

  async prepareStagingRelease(id: string): Promise<StagingRelease> {
    const project = this.projects.get(id);
    if (!project) throw new ControlPlaneError('The project must load successfully before it can be published.', 400, 'PROJECT_NOT_LOADED');
    return this.client.prepareStagingRelease(id, project.revision);
  }

  async getWebsiteName(id: string): Promise<string> { return (await this.read(id)).name; }
  async getWebsiteRole(id: string): Promise<'owner' | 'editor' | 'viewer'> { return (await this.read(id)).role; }
  async getWebsiteWorkspaceId(id: string): Promise<string> { return (await this.read(id)).workspaceId; }
  async getWebsiteClosedSource(id: string): Promise<boolean> { await this.read(id); return false; }
  async getCredits(_workspaceId: string): Promise<number | null> { return null; }
  async listWorkspaceFonts(_workspaceId: string): Promise<WorkspaceFont[]> { return []; }

  async uploadAsset(_id: string, file: File): Promise<string> {
    const asset = await this.client.registerAsset(_id, file);
    return `/api/projects/${asset.projectId}/assets/${asset.assetId}/bytes`;
  }

  async deleteAssets(_id: string, _keys: string[]): Promise<void> {
    // Embedded data URLs have no separate server object to delete.
  }

  async fetchMediaBytes(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Media request failed (${response.status}).`);
    return response.blob();
  }
}
