/**
 * EnvironmentLockService Tests - Lock/unlock deployment environments
 */

import { EnvironmentLockService } from '../EnvironmentLockService';
import { OrionError } from '../../../errors';

describe('EnvironmentLockService', () => {
  let service: EnvironmentLockService;
  let mockPool: { query: jest.Mock };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    service = new EnvironmentLockService(mockPool as any);
  });

  describe('lockEnvironment', () => {
    it('should lock an environment and return lock info', async () => {
      const lockedAt = new Date();
      mockPool.query.mockResolvedValue({
        rows: [{
          locked: true,
          locked_by: 'admin',
          locked_at: lockedAt,
          locked_reason: 'Production freeze',
        }],
        rowCount: 1,
      });

      const result = await service.lockEnvironment('env-1', 'admin', 'Production freeze');

      expect(result.locked).toBe(true);
      expect(result.lockedBy).toBe('admin');
      expect(result.lockedAt).toBe(lockedAt);
      expect(result.reason).toBe('Production freeze');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE environments'),
        ['env-1', 'admin', 'Production freeze'],
      );
    });

    it('should throw NOT_FOUND when environment does not exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(service.lockEnvironment('non-existent', 'admin', 'reason')).rejects.toThrow(OrionError);
      await expect(service.lockEnvironment('non-existent', 'admin', 'reason')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should include RETURNING clause in SQL', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ locked: true, locked_by: 'u', locked_at: new Date(), locked_reason: 'r' }],
        rowCount: 1,
      });

      await service.lockEnvironment('env-1', 'u', 'r');

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain('RETURNING');
      expect(sql).toContain('locked');
      expect(sql).toContain('locked_by');
      expect(sql).toContain('locked_at');
      expect(sql).toContain('locked_reason');
    });
  });

  describe('unlockEnvironment', () => {
    it('should unlock an environment', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'env-1' }], rowCount: 1 });

      await service.unlockEnvironment('env-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SET locked = FALSE'),
        ['env-1'],
      );
    });

    it('should set locked_by, locked_at, locked_reason to NULL', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'env-1' }], rowCount: 1 });

      await service.unlockEnvironment('env-1');

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain('locked_by = NULL');
      expect(sql).toContain('locked_at = NULL');
      expect(sql).toContain('locked_reason = NULL');
    });

    it('should throw NOT_FOUND when environment does not exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(service.unlockEnvironment('non-existent')).rejects.toThrow(OrionError);
      await expect(service.unlockEnvironment('non-existent')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('isEnvironmentLocked', () => {
    it('should return true when environment is locked', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ locked: true }], rowCount: 1 });

      const result = await service.isEnvironmentLocked('env-1');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT locked FROM environments WHERE id = $1',
        ['env-1'],
      );
    });

    it('should return false when environment is unlocked', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ locked: false }], rowCount: 1 });

      const result = await service.isEnvironmentLocked('env-1');

      expect(result).toBe(false);
    });

    it('should throw NOT_FOUND when environment does not exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(service.isEnvironmentLocked('non-existent')).rejects.toThrow(OrionError);
      await expect(service.isEnvironmentLocked('non-existent')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('getLockInfo', () => {
    it('should return full lock info when environment is locked', async () => {
      const lockedAt = new Date();
      mockPool.query.mockResolvedValue({
        rows: [{
          locked: true,
          locked_by: 'ops-team',
          locked_at: lockedAt,
          locked_reason: 'Scheduled maintenance',
        }],
        rowCount: 1,
      });

      const result = await service.getLockInfo('env-1');

      expect(result).not.toBeNull();
      expect(result!.locked).toBe(true);
      expect(result!.lockedBy).toBe('ops-team');
      expect(result!.lockedAt).toBe(lockedAt);
      expect(result!.reason).toBe('Scheduled maintenance');
    });

    it('should return { locked: false } when environment is unlocked', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          locked: false,
          locked_by: null,
          locked_at: null,
          locked_reason: null,
        }],
        rowCount: 1,
      });

      const result = await service.getLockInfo('env-1');

      expect(result).not.toBeNull();
      expect(result!.locked).toBe(false);
      expect(result!.lockedBy).toBeUndefined();
    });

    it('should throw NOT_FOUND when environment does not exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(service.getLockInfo('non-existent')).rejects.toThrow(OrionError);
      await expect(service.getLockInfo('non-existent')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should query all lock-related columns', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ locked: false, locked_by: null, locked_at: null, locked_reason: null }],
        rowCount: 1,
      });

      await service.getLockInfo('env-1');

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain('locked');
      expect(sql).toContain('locked_by');
      expect(sql).toContain('locked_at');
      expect(sql).toContain('locked_reason');
    });
  });

  describe('checkDeploymentAllowed', () => {
    it('should return allowed: true when environment is unlocked', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ locked: false, locked_by: null, locked_at: null, locked_reason: null }],
        rowCount: 1,
      });

      const result = await service.checkDeploymentAllowed('env-1');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return allowed: false with reason when environment is locked', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          locked: true,
          locked_by: 'ops-admin',
          locked_at: new Date(),
          locked_reason: 'No deploy on Friday',
        }],
        rowCount: 1,
      });

      const result = await service.checkDeploymentAllowed('env-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('ops-admin');
      expect(result.reason).toContain('No deploy on Friday');
      expect(result.lockInfo).toBeDefined();
      expect(result.lockInfo!.locked).toBe(true);
    });

    it('should throw NOT_FOUND when environment does not exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(service.checkDeploymentAllowed('non-existent')).rejects.toThrow(OrionError);
    });
  });
});
