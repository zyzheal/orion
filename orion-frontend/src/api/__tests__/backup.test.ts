/**
 * Backup API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBackupStats,
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  executeBackup,
  listBackupRecords,
  getBackupRecord,
  deleteBackupRecord,
  verifyBackup,
  createRecovery,
  listRecoveries,
  getRecovery,
  executeRecovery,
  rollbackRecovery,
} from '../backup';
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

const okRes = (data: unknown) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
} as any);

describe('Backup API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get backup stats', async () => {
    vi.mocked(api.get).mockResolvedValue(
      okRes({ total_backups: 42, completed_backups: 38, failed_backups: 2 }),
    );
    const result = await getBackupStats();
    expect(api.get).toHaveBeenCalledWith('/backup/status');
    expect(result.data.total_backups).toBe(42);
  });

  it('should list plans', async () => {
    vi.mocked(api.get).mockResolvedValue(okRes([]));
    const result = await listPlans();
    expect(api.get).toHaveBeenCalledWith('/backup/plans', { params: { offset: 0, limit: 20 } });
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should get a plan', async () => {
    vi.mocked(api.get).mockResolvedValue(okRes({ id: '1', name: 'test' }));
    await getPlan('1');
    expect(api.get).toHaveBeenCalledWith('/backup/plans/1');
  });

  it('should create a plan', async () => {
    vi.mocked(api.post).mockResolvedValue(okRes({ id: '1', name: 'test' }));
    await createPlan({ name: 'test', type: 'full', retention_days: 7, enabled: true });
    expect(api.post).toHaveBeenCalledWith('/backup/plans', {
      name: 'test',
      type: 'full',
      retention_days: 7,
      enabled: true,
    });
  });

  it('should update a plan', async () => {
    vi.mocked(api.put).mockResolvedValue(okRes({ id: '1', name: 'updated' }));
    await updatePlan('1', { name: 'updated' });
    expect(api.put).toHaveBeenCalledWith('/backup/plans/1', { name: 'updated' });
  });

  it('should delete a plan', async () => {
    vi.mocked(api.delete).mockResolvedValue(okRes(undefined));
    await deletePlan('1');
    expect(api.delete).toHaveBeenCalledWith('/backup/plans/1');
  });

  it('should execute a backup', async () => {
    vi.mocked(api.post).mockResolvedValue(okRes({ id: 'r1' }));
    await executeBackup('plan1');
    expect(api.post).toHaveBeenCalledWith('/backup/plans/plan1/execute', {});
  });

  it('should list backup records', async () => {
    vi.mocked(api.get).mockResolvedValue(okRes([]));
    await listBackupRecords('plan1');
    expect(api.get).toHaveBeenCalledWith('/backup/plans/plan1/records', { params: { offset: 0, limit: 20 } });
  });

  it('should get a backup record', async () => {
    vi.mocked(api.get).mockResolvedValue(okRes({ id: 'r1' }));
    await getBackupRecord('plan1', 'r1');
    expect(api.get).toHaveBeenCalledWith('/backup/plans/plan1/records/r1');
  });

  it('should delete a backup record', async () => {
    vi.mocked(api.delete).mockResolvedValue(okRes(undefined));
    await deleteBackupRecord('plan1', 'r1');
    expect(api.delete).toHaveBeenCalledWith('/backup/plans/plan1/records/r1');
  });

  it('should verify a backup', async () => {
    vi.mocked(api.post).mockResolvedValue(okRes({ backup_id: 'r1', status: 'passed' }));
    await verifyBackup('r1');
    expect(api.post).toHaveBeenCalledWith('/backup/verify/r1');
  });

  it('should create a recovery', async () => {
    vi.mocked(api.post).mockResolvedValue(okRes({ id: 'rec1' }));
    await createRecovery({ backup_id: 'r1' });
    expect(api.post).toHaveBeenCalledWith('/backup/recovery', { backup_id: 'r1' });
  });

  it('should list recoveries', async () => {
    vi.mocked(api.get).mockResolvedValue(okRes([]));
    await listRecoveries();
    expect(api.get).toHaveBeenCalledWith('/backup/recovery', { params: { offset: 0, limit: 20 } });
  });

  it('should get a recovery', async () => {
    vi.mocked(api.get).mockResolvedValue(okRes({ id: 'rec1' }));
    await getRecovery('rec1');
    expect(api.get).toHaveBeenCalledWith('/backup/recovery/rec1');
  });

  it('should execute a recovery', async () => {
    vi.mocked(api.post).mockResolvedValue(okRes({ id: 'rec1', status: 'in_progress' }));
    await executeRecovery('rec1');
    expect(api.post).toHaveBeenCalledWith('/backup/recovery/rec1/execute');
  });

  it('should rollback a recovery', async () => {
    vi.mocked(api.delete).mockResolvedValue(okRes({ id: 'rec1', status: 'rolled_back' }));
    await rollbackRecovery('rec1');
    expect(api.delete).toHaveBeenCalledWith('/backup/recovery/rec1');
  });
});
