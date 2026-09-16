import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VersionedAutosave } from './versioned-autosave';
import { ControlPlaneError, RevisionConflictError } from './self-hosted-client';
import type { ProjectData } from './types';

function setup() {
  let text = 'initial';
  const snapshot = (): ProjectData => ({ format: 'revyme-v1', files: { 'app/page.tsx': text } });
  const save = vi.fn<(data: ProjectData) => Promise<void>>().mockResolvedValue(undefined);
  const state = vi.fn();
  const coordinator = new VersionedAutosave({ snapshot, save, state });
  return { coordinator, save, state, edit: (value: string) => { text = value; coordinator.trigger(); }, directEdit: (value: string) => { text = value; } };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('versioned autosave', () => {
  it('blocks saving before a successful server load', async () => {
    const { coordinator, save } = setup();
    coordinator.trigger();
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(coordinator.flush()).rejects.toThrow('not loaded');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not autosave boot changes or manual flushes for viewers', async () => {
    const { coordinator, save, state } = setup();
    coordinator.markLoaded(true);
    coordinator.trigger();
    await coordinator.flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).not.toHaveBeenCalled();
    expect(state).toHaveBeenLastCalledWith({ status: 'read-only', error: null });
  });

  it('debounces edits and clears dirty only after an accepted save', async () => {
    const { coordinator, edit, save, state } = setup();
    coordinator.markLoaded();
    edit('one');
    edit('two');
    expect(coordinator.hasUnsavedWork()).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].files['app/page.tsx']).toBe('two');
    expect(coordinator.hasUnsavedWork()).toBe(false);
    expect(state).toHaveBeenLastCalledWith({ status: 'saved', error: null });
  });

  it('serializes saves and persists edits made during the first request', async () => {
    const { coordinator, edit, save, state } = setup();
    let accept: () => void = () => {};
    save.mockImplementationOnce(() => new Promise(resolve => { accept = resolve; }));
    coordinator.markLoaded();
    edit('first');
    const first = coordinator.flush();
    edit('second');
    const second = coordinator.flush();
    await vi.advanceTimersByTimeAsync(3000);
    expect(save).toHaveBeenCalledTimes(1);
    accept();
    await Promise.all([first, second]);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].files['app/page.tsx']).toBe('second');
    expect(state).toHaveBeenLastCalledWith({ status: 'saved', error: null });
  });

  it('explicit flush saves direct file writes without an autosave trigger', async () => {
    const { coordinator, directEdit, save } = setup();
    coordinator.markLoaded();
    await coordinator.flush();
    directEdit('manual plugin write');
    await coordinator.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].files['app/page.tsx']).toBe('manual plugin write');
  });

  it('pauses on conflict, preserves pending work, and rejects explicit flush', async () => {
    const { coordinator, edit, save, state } = setup();
    const conflict = new RevisionConflictError('Another browser saved.');
    save.mockRejectedValue(conflict);
    coordinator.markLoaded();
    edit('stale');
    await expect(coordinator.flush()).rejects.toBe(conflict);
    edit('new local edits');
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(coordinator.flush()).rejects.toBe(conflict);
    expect(save).toHaveBeenCalledTimes(1);
    expect(coordinator.hasUnsavedWork()).toBe(true);
    expect(state).toHaveBeenLastCalledWith({ status: 'conflict', error: conflict.message });
  });

  it('retries transient failure with a bounded budget but does not retry validation failures', async () => {
    const { coordinator, edit, save } = setup();
    save.mockRejectedValue(new Error('offline'));
    coordinator.markLoaded();
    edit('pending');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(4);
    save.mockRejectedValue(new ControlPlaneError('Too large', 413, 'SNAPSHOT_TOO_LARGE'));
    edit('large');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(5);
  });

  it('prompts on unload while dirty/in-flight and makes no beacon request', async () => {
    const { coordinator, edit, save } = setup();
    let accept: () => void = () => {};
    save.mockImplementationOnce(() => new Promise(resolve => { accept = resolve; }));
    coordinator.markLoaded();
    edit('pending');
    const request = coordinator.flush();
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    coordinator.beforeUnload(event);
    expect(event.defaultPrevented).toBe(true);
    accept();
    await request;
    const clean = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    coordinator.beforeUnload(clean);
    expect(clean.defaultPrevented).toBe(false);
    coordinator.dispose();
  });

  it.each(['dispose', 'cancel', 'hold'] as const)('does not send a waiting save after %s', async action => {
    const { coordinator, edit, save } = setup();
    let accept: () => void = () => {};
    save.mockImplementationOnce(() => new Promise(resolve => { accept = resolve; }));
    coordinator.markLoaded();
    edit('first');
    const first = coordinator.flush();
    edit('second');
    const second = coordinator.flush();
    if (action === 'hold') coordinator.setHeld(true);
    else coordinator[action]();
    accept();
    await Promise.all([first, second]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
    coordinator.dispose();
  });
});
