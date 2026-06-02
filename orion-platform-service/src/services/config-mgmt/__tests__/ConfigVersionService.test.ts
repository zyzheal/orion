/**
 * ConfigVersionService - Configuration Version History Unit Tests
 *
 * Coverage: recordVersion, getVersionHistory, getVersionById, rollbackToVersion, diffVersions
 */

import { ConfigVersionService } from '../ConfigVersionService';

describe('ConfigVersionService', () => {
  let service: ConfigVersionService;

  beforeEach(() => {
    // In-memory fallback (no database)
    service = new ConfigVersionService();
  });

  // ==================== recordVersion ====================

  describe('recordVersion', () => {
    it('should record a new version', async () => {
      const result = await service.recordVersion(
        't-1', 'app.config', 'production',
        { key: 'value' }, 'create', 'user-1'
      );

      expect(result.tenantId).toBe('t-1');
      expect(result.configKey).toBe('app.config');
      expect(result.environment).toBe('production');
      expect(result.value).toEqual({ key: 'value' });
      expect(result.changeType).toBe('create');
      expect(result.changedBy).toBe('user-1');
      expect(result.versionNumber).toBe(1);
      expect(result.id).toBeDefined();
    });

    it('should increment version number', async () => {
      await service.recordVersion('t-1', 'app.config', 'prod', { v: 1 }, 'create', 'user-1');
      const v2 = await service.recordVersion('t-1', 'app.config', 'prod', { v: 2 }, 'update', 'user-2');

      expect(v2.versionNumber).toBe(2);
    });

    it('should set previousVersionId', async () => {
      const v1 = await service.recordVersion('t-1', 'app.config', 'prod', { v: 1 }, 'create', 'user-1');
      const v2 = await service.recordVersion('t-1', 'app.config', 'prod', { v: 2 }, 'update', 'user-2');

      expect(v2.previousVersionId).toBe(v1.id);
    });

    it('should accept explicit previousVersionId', async () => {
      const result = await service.recordVersion(
        't-1', 'app.config', 'prod', { v: 1 },
        'create', 'user-1', 'group-1', 'reason', 'prev-id'
      );

      expect(result.previousVersionId).toBe('prev-id');
      expect(result.configGroup).toBe('group-1');
      expect(result.changeReason).toBe('reason');
    });
  });

  // ==================== getVersionHistory ====================

  describe('getVersionHistory', () => {
    it('should return version history', async () => {
      await service.recordVersion('t-1', 'app.config', 'prod', { v: 1 }, 'create', 'user-1');
      await service.recordVersion('t-1', 'app.config', 'prod', { v: 2 }, 'update', 'user-2');

      const history = await service.getVersionHistory('t-1', 'app.config', 'prod');

      expect(history).toHaveLength(2);
      // Sorted by version number descending
      expect(history[0].versionNumber).toBe(2);
      expect(history[1].versionNumber).toBe(1);
    });

    it('should return empty for no versions', async () => {
      const history = await service.getVersionHistory('t-1', 'nonexistent', 'prod');
      expect(history).toEqual([]);
    });

    it('should respect limit', async () => {
      for (let i = 1; i <= 5; i++) {
        await service.recordVersion('t-1', 'app.config', 'prod', { v: i }, 'update', 'user-1');
      }

      const history = await service.getVersionHistory('t-1', 'app.config', 'prod', 3);
      expect(history).toHaveLength(3);
    });
  });

  // ==================== getVersionById ====================

  describe('getVersionById', () => {
    it('should return version by id', async () => {
      const created = await service.recordVersion('t-1', 'app.config', 'prod', { v: 1 }, 'create', 'user-1');

      const result = await service.getVersionById(created.id);

      expect(result).toBeDefined();
      expect(result!.configKey).toBe('app.config');
    });

    it('should return null for non-existent id', async () => {
      const result = await service.getVersionById('non-existent');
      expect(result).toBeNull();
    });
  });

  // ==================== rollbackToVersion ====================

  describe('rollbackToVersion', () => {
    it('should rollback to target version', async () => {
      await service.recordVersion('t-1', 'app.config', 'prod', { v: 1 }, 'create', 'user-1');
      await service.recordVersion('t-1', 'app.config', 'prod', { v: 2 }, 'update', 'user-2');
      await service.recordVersion('t-1', 'app.config', 'prod', { v: 3 }, 'update', 'user-3');

      const result = await service.rollbackToVersion('t-1', 'app.config', 'prod', 1, 'admin');

      expect(result.success).toBe(true);
      expect(result.rolledBackTo).toBe(1);
      expect(result.rolledBackBy).toBe('admin');
      expect(result.newVersionNumber).toBe(4);
    });

    it('should throw when target version not found', async () => {
      await expect(
        service.rollbackToVersion('t-1', 'app.config', 'prod', 99, 'admin')
      ).rejects.toThrow('Version 99 not found');
    });
  });

  // ==================== diffVersions ====================

  describe('diffVersions', () => {
    it('should detect added keys', async () => {
      await service.recordVersion('t-1', 'app.config', 'prod', { a: 1 }, 'create', 'user-1');
      await service.recordVersion('t-1', 'app.config', 'prod', { a: 1, b: 2 }, 'update', 'user-2');

      const diff = await service.diffVersions('t-1', 'app.config', 'prod', 1, 2);

      expect(diff.added).toEqual({ b: 2 });
      expect(diff.removed).toEqual({});
      expect(diff.modified).toEqual({});
    });

    it('should detect removed keys', async () => {
      await service.recordVersion('t-1', 'app.config', 'prod', { a: 1, b: 2 }, 'create', 'user-1');
      await service.recordVersion('t-1', 'app.config', 'prod', { a: 1 }, 'update', 'user-2');

      const diff = await service.diffVersions('t-1', 'app.config', 'prod', 1, 2);

      expect(diff.removed).toEqual({ b: 2 });
    });

    it('should detect modified keys', async () => {
      await service.recordVersion('t-1', 'app.config', 'prod', { a: 1 }, 'create', 'user-1');
      await service.recordVersion('t-1', 'app.config', 'prod', { a: 2 }, 'update', 'user-2');

      const diff = await service.diffVersions('t-1', 'app.config', 'prod', 1, 2);

      expect(diff.modified).toEqual({ a: { old: 1, new: 2 } });
    });

    it('should throw when from version not found', async () => {
      await service.recordVersion('t-1', 'app.config', 'prod', { a: 1 }, 'create', 'user-1');

      await expect(
        service.diffVersions('t-1', 'app.config', 'prod', 99, 1)
      ).rejects.toThrow('Version 99 not found');
    });

    it('should throw when to version not found', async () => {
      await service.recordVersion('t-1', 'app.config', 'prod', { a: 1 }, 'create', 'user-1');

      await expect(
        service.diffVersions('t-1', 'app.config', 'prod', 1, 99)
      ).rejects.toThrow('Version 99 not found');
    });
  });
});
