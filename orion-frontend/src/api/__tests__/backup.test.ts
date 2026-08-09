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
      data: { total: 42, successful: 38, failed: 2 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    const result = await getBackupStats();
    expect(api.get).toHaveBeenCalledWith('/api/v1/backup/stats');
    expect(result.data.total).toBe(42);
  });

  it('should get backups', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    const result = await getBackups();
    expect(api.get).toHaveBeenCalledWith('/api/v1/backup');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should create a backup', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: '1', name: 'db-backup' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    await createBackup({ name: 'db-backup', type: 'database' });
    expect(api.post).toHaveBeenCalledWith('/api/v1/backup', { name: 'db-backup', type: 'database' });
  });

  it('should restore a backup', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    await restoreBackup('1');
    expect(api.post).toHaveBeenCalledWith('/api/v1/backup/1/restore');
  });

  it('should delete a backup', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    await deleteBackup('1');
    expect(api.delete).toHaveBeenCalledWith('/api/v1/backup/1');
  });
});
