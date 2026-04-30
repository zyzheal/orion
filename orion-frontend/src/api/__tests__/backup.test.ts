/**
 * Backup API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBackupStats, getBackups, createBackup, restoreBackup, deleteBackup } from '../backup';
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

describe('Backup API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get backup stats', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { stats: { total: 42, successful: 38, failed: 2 } } },
    } as any);
    const result = await getBackupStats();
    expect(api.get).toHaveBeenCalledWith('/v1/backup/stats');
    expect(result.data.data.stats.total).toBe(42);
  });

  it('should get backups', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { backups: [] } } } as any);
    const result = await getBackups();
    expect(api.get).toHaveBeenCalledWith('/v1/backup');
    expect(Array.isArray(result.data.data.backups)).toBe(true);
  });

  it('should create a backup', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { data: { backup: { id: '1', name: 'db-backup' } } },
    } as any);
    await createBackup({ name: 'db-backup', type: 'database' });
    expect(api.post).toHaveBeenCalledWith('/v1/backup', { name: 'db-backup', type: 'database' });
  });

  it('should restore a backup', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: undefined } } as any);
    await restoreBackup('1');
    expect(api.post).toHaveBeenCalledWith('/v1/backup/1/restore');
  });

  it('should delete a backup', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { data: undefined } } as any);
    await deleteBackup('1');
    expect(api.delete).toHaveBeenCalledWith('/v1/backup/1');
  });
});
