// save-store.ts — Jotai atom for the current save status.

import { atom } from 'jotai';
import type { VersionedSaveState } from './versioned-autosave';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export const saveStatusAtom = atom<SaveStatus>('saved');

/** Detailed state is shown only by the self-hosted persistence UI. */
export const versionedSaveStateAtom = atom<VersionedSaveState>({ status: 'saved', error: null });
