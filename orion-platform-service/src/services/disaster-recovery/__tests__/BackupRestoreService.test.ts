/**
 * BackupRestoreService - Backup and Restore Unit Tests
 *
 * Coverage: createBackup, restoreBackup, listBackups, deleteBackup, getBackupById
 */

import { BackupRestoreService, BackupRestoreServiceError } from '../BackupRestoreService';

describe('BackupRestoreService', () => {
  let service: BackupRestoreService;

  beforeEach(() => {
    service = new BackupRestoreService();
  });

  // ==================== createBackup ====================

  describe('createBackup', () => {
    it('should create a backup', async () => {
      const result = await service.createBackup('t-1', 'full', {
        description: 'Full backup',
      });

      expect(result.tenantId).toBe('t-1');
      expect(result.scope).toBe('full');
      // Backup executes asynchronously (completes nearly instantly in test)
      expect(['pending', 'completed']).toContain(result.status);
      expect(result.description).toBe('Full backup');
      expect(result.retentionDays).toBe(30);
      expect(result.expiresAt).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should use custom retention days', async () => {
      const result = await service.createBackup('t-1', 'incremental', {
        retentionDays: 7,
      });

      expect(result.retentionDays).toBe(7);
    });

    it('should include services config', async () => {
      const result = await service.createBackup('t-1', 'config-only', {
        includeServices: ['svc-a', 'svc-b'],
        excludeServices: ['svc-c'],
      });

      expect(result.includeServices).toEqual(['svc-a', 'svc-b']);
      expect(result.excludeServices).toEqual(['svc-c']);
    });

    it('should eventually have completed status', async () => {
      const result = await service.createBackup('t-1', 'full', {});

      // Backup executes async but completes nearly instantly in tests
      await new Promise(r => setTimeout(r, 50));

      const backup = await service.getBackupById(result.id);
      expect(backup!.status).toBe('completed');
      expect(backup!.filePath).toBeDefined();
      expect(backup!.sizeBytes).toBeGreaterThan(0);
    });
  });

  // ==================== listBackups ====================

  describe('listBackups', () => {
    it('should list backups for tenant', async () => {
      await service.createBackup('t-1', 'full', { description: 'backup-1' });
      await service.createBackup('t-1', 'incremental', { description: 'backup-2' });
      await service.createBackup('t-2', 'full', { description: 'backup-3' });

      const result = await service.listBackups('t-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty for tenant with no backups', async () => {
      const result = await service.listBackups('empty-tenant');
      expect(result).toEqual([]);
    });

    it('should sort by createdAt descending', async () => {
      const b1 = await service.createBackup('t-1', 'full', {});
      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));
      const b2 = await service.createBackup('t-1', 'incremental', {});

      const result = await service.listBackups('t-1');

      expect(result[0].id).toBe(b2.id);
      expect(result[1].id).toBe(b1.id);
    });
  });

  // ==================== getBackupById ====================

  describe('getBackupById', () => {
    it('should return backup by id', async () => {
      const created = await service.createBackup('t-1', 'full', {});

      const result = await service.getBackupById(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      const result = await service.getBackupById('non-existent');
      expect(result).toBeNull();
    });
  });

  // ==================== deleteBackup ====================

  describe('deleteBackup', () => {
    it('should delete backup', async () => {
      const created = await service.createBackup('t-1', 'full', {});

      const result = await service.deleteBackup(created.id);
      expect(result).toBe(true);

      const found = await service.getBackupById(created.id);
      expect(found).toBeNull();
    });

    it('should throw when backup not found', async () => {
      await expect(service.deleteBackup('non-existent')).rejects.toThrow('Backup not found');
    });

    it('should remove from tenant index', async () => {
      const created = await service.createBackup('t-1', 'full', {});
      await service.deleteBackup(created.id);

      const list = await service.listBackups('t-1');
      expect(list).toHaveLength(0);
    });
  });

  // ==================== restoreBackup ====================

  describe('restoreBackup', () => {
    it('should restore completed backup', async () => {
      const backup = await service.createBackup('t-1', 'full', {
        includeServices: ['svc-a', 'svc-b'],
      });

      // Wait for backup to complete
      await new Promise(r => setTimeout(r, 100));

      const result = await service.restoreBackup(backup.id);

      expect(result.success).toBe(true);
      expect(result.backupId).toBe(backup.id);
      expect(result.targetTenantId).toBe('t-1');
      expect(result.restoredServices).toEqual(['svc-a', 'svc-b']);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should restore to different tenant', async () => {
      const backup = await service.createBackup('t-1', 'full', {});
      await new Promise(r => setTimeout(r, 100));

      const result = await service.restoreBackup(backup.id, { tenantId: 't-2' });

      expect(result.success).toBe(true);
      expect(result.targetTenantId).toBe('t-2');
    });

    it('should throw when backup not found', async () => {
      await expect(service.restoreBackup('non-existent')).rejects.toThrow('Backup not found');
    });

    it('should throw when backup is not completed', async () => {
      // Create a backup and manually set status to pending to test the guard
      const backup = await service.createBackup('t-1', 'full', {});
      // Backup completes async; get it and set status back to pending
      const record = await service.getBackupById(backup.id);
      if (record) {
        (record as any).status = 'pending';
      }

      await expect(service.restoreBackup(backup.id)).rejects.toThrow('not in completed state');
    });
  });

  // ==================== Error class ====================

  describe('BackupRestoreServiceError', () => {
    it('should have code property', () => {
      const error = new BackupRestoreServiceError('test message', 'TEST_CODE');

      expect(error.message).toBe('test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('BackupRestoreServiceError');
    });
  });
});
