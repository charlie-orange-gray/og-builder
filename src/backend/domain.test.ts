import { describe, expect, it } from 'vitest';
import { normalizeDomainRole, normalizeDomainSession, normalizeDomainUser, normalizeWebsiteSummary } from './domain';

describe('shared management-domain normalization', () => {
  it('normalizes user identity without inventing an email', () => {
    expect(normalizeDomainUser({ id: 'u1', name: '  Ada  ', email: null })).toEqual({ id: 'u1', name: 'Ada', email: '' });
    expect(normalizeDomainUser({ id: 'u2', name: '', email: 'ada@example.test' }).name).toBe('ada@example.test');
  });

  it('normalizes workspace roles and selected workspace state', () => {
    const session = normalizeDomainSession({
      user: { id: 'u1', name: 'Ada', email: 'ada@example.test' },
      workspace: { id: 'w2', name: 'Client', role: 'editor' },
      workspaces: [{ id: 'w1', name: 'Personal', role: 'owner' }, { id: 'w2', name: 'Client', role: 'editor' }],
    });
    expect(session.workspace?.role).toBe('editor');
    expect(session.workspaces.map(item => [item.id, item.selected])).toEqual([['w1', false], ['w2', true]]);
  });

  it('keeps unknown roles safe and accepts project wire aliases', () => {
    expect(normalizeDomainRole('administrator')).toBe('owner');
    expect(normalizeWebsiteSummary({ projectId: 'p1', name: 'Site', workspaceId: 'w1', updatedAt: 'now', role: 'viewer' })).toMatchObject({ id: 'p1', effectiveRole: 'viewer' });
  });
});
