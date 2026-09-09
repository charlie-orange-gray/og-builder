import type { ProjectData } from './types';
import { isRetryablePersistenceError, RevisionConflictError } from './self-hosted-client';

export interface VersionedSaveState {
  status: 'saved' | 'saving' | 'unsaved' | 'error' | 'conflict' | 'read-only';
  error: string | null;
}

interface Dependencies {
  snapshot: () => ProjectData;
  save: (data: ProjectData) => Promise<void>;
  state: (state: VersionedSaveState) => void;
}

/** A single writer for versioned persistence. Cloud/local keep their own coordinator. */
export class VersionedAutosave {
  private generation = 0;
  private acknowledged = 0;
  private loaded = false;
  private readOnly = false;
  private held = false;
  private disposed = false;
  private discarded = false;
  private failures = 0;
  private conflict: RevisionConflictError | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private acknowledgedSnapshot: string | null = null;

  constructor(private readonly dependencies: Dependencies) {}

  markLoaded(readOnly = false): void {
    this.loaded = true;
    this.readOnly = readOnly;
    this.dependencies.state({ status: readOnly ? 'read-only' : 'saved', error: null });
  }

  trigger(): void {
    if (!this.loaded || this.readOnly || this.disposed || this.discarded) return;
    this.generation++;
    this.failures = 0;
    if (this.conflict) return; // Keep the local edits and conflict recovery visible.
    this.dependencies.state({ status: 'unsaved', error: null });
    this.schedule(2000);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(delay: number): void {
    this.clearTimer();
    if (this.held || this.disposed || this.discarded || this.conflict) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch(() => undefined); // State and retry are handled by saveOne.
    }, delay);
  }

  private async saveOne(): Promise<void> {
    const capturedGeneration = this.generation;
    const data = this.dependencies.snapshot();
    this.dependencies.state({ status: 'saving', error: null });
    try {
      await this.dependencies.save(data);
      this.acknowledged = capturedGeneration;
      this.acknowledgedSnapshot = JSON.stringify(data);
      this.failures = 0;
      if (!this.disposed && !this.discarded) {
        this.dependencies.state({ status: this.generation === capturedGeneration ? 'saved' : 'unsaved', error: null });
      }
    } catch (error) {
      if (this.disposed || this.discarded) throw error;
      if (error instanceof RevisionConflictError) this.conflict = error;
      this.dependencies.state({
        status: this.conflict ? 'conflict' : 'error',
        error: error instanceof Error ? error.message : 'The project could not be saved.',
      });
      this.failures++;
      if (isRetryablePersistenceError(error) && this.failures <= 3) this.schedule(5000);
      throw error;
    }
  }

  async flush(): Promise<void> {
    this.clearTimer();
    if (this.readOnly || this.disposed || this.discarded) return;
    if (!this.loaded) throw new Error('The server project has not loaded successfully.');
    if (this.conflict) throw this.conflict;
    if (this.held) return;
    if (this.inFlight) await this.inFlight;
    if (this.disposed || this.discarded || this.held) return;
    // Recheck after waiting: another caller may already have sent the latest generation.
    if (this.inFlight) return this.flush();
    if (this.conflict) throw this.conflict;
    if (this.generation === this.acknowledged) {
      // Explicit flush also covers direct ProjectFS writes without an autosave trigger.
      if (JSON.stringify(this.dependencies.snapshot()) === this.acknowledgedSnapshot) return;
      this.generation++;
    }
    const request = this.saveOne();
    this.inFlight = request;
    try { await request; }
    finally { if (this.inFlight === request) this.inFlight = null; }
    // An edit during the request must be acknowledged before explicit flush resolves.
    if (this.generation !== this.acknowledged) await this.flush();
  }

  setHeld(held: boolean): void {
    this.held = held;
    if (held) this.clearTimer();
    else if (this.hasUnsavedWork()) this.schedule(2000);
  }

  hasUnsavedWork(): boolean {
    return this.loaded && !this.disposed && !this.discarded &&
      (this.generation !== this.acknowledged || this.inFlight !== null);
  }

  beforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedWork()) return;
    // A versioned write needs an acknowledgement; beacon cannot supply If-Match
    // or confirm success. Keep the native leave prompt until a normal save succeeds.
    event.preventDefault();
    event.returnValue = '';
    if (!this.conflict) this.schedule(0);
  }

  cancel(): void {
    this.clearTimer();
    this.discarded = true;
  }

  dispose(): void {
    this.clearTimer();
    this.disposed = true;
  }
}
