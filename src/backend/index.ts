// index.ts — Backend adapter factory.
// Resolve the Cloud, self-hosted, or standalone provider once at the boundary.

import { LocalBackend } from './local-backend';
import { backendCapabilities } from './capabilities';
import { RevymeBackend } from './revyme-backend';
import { SelfHostedBackend } from './self-hosted-backend';
import type { ProjectBackend } from './types';
export type { ProjectBackend, ProjectData, RevymeUser } from './types';

export const backend: ProjectBackend = backendCapabilities.persistence === 'cloud'
  ? new RevymeBackend()
  : backendCapabilities.persistence === 'self-hosted'
    ? new SelfHostedBackend()
    : new LocalBackend();
