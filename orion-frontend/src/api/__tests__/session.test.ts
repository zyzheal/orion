/**
 * Session API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSessions, getSession, deleteSession, getSessionStats } from '../session';
import { api } from '../client';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Session API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get sessions', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { sessions: [] } } } as any);

    await getSessions();
    expect(api.get).toHaveBeenCalledWith('/v1/sessions');
  });

  it('should get sessions with tenant filter', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { sessions: [] } } } as any);

    await getSessions('tenant-1');
    expect(api.get).toHaveBeenCalledWith('/v1/sessions?tenantId=tenant-1');
  });

  it('should get a single session', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { session: { id: '1' } } } } as any);

    const result = await getSession('1');
    expect(api.get).toHaveBeenCalledWith('/v1/sessions/1');
    expect(result.data.data.session.id).toBe('1');
  });

  it('should delete a session', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { data: undefined } } as any);

    await deleteSession('1');
    expect(api.delete).toHaveBeenCalledWith('/v1/sessions/1');
  });

  it('should get session stats', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { stats: { total: 50, active: 30, expired: 20 } } } } as any);

    const result = await getSessionStats();
    expect(result.data.data.stats.active).toBe(30);
  });
});
