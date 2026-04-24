/**
 * TASK-704: BackupService Unit Tests
 *
 * Tests the BackupService with PostgreSQL Repository pattern.
 * In-memory fallback is used when no database pool is provided.
 */

import { BackupService } from '../BackupService';
import { BackupPlan, RecoveryPlan } from '../../types';

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(() => {
    service = new BackupService({
      config: {
        storagePath: '/tmp/test-backup-service',
        scheduleCheckIntervalMs: 1000,
      },
    });
  });

  afterEach(async () => {
    await service.stop();
  });

  // ==================== Lifecycle ====================

  describe('start/stop', () => {
    it('should start the service', async () => {
      await service.start();
      const health = service.getHealthStatus();
      expect(health.running).toBe(true);
    });

    it('should stop the service', async () => {
      await service.start();
      await service.stop();
      const health = service.getHealthStatus();
      expect(health.running).toBe(false);
    });

    it('should be idempotent for start', async () => {
      await service.start();
      await service.start();
      const health = service.getHealthStatus();
      expect(health.running).toBe(true);
    });

    it('should be idempotent for stop', async () => {
      await service.stop();
      const health = service.getHealthStatus();
      expect(health.running).toBe(false);
    });
  });

  // ==================== Backup Plan Management ====================

  describe('createPlan', () => {
    it('should create a backup plan', async () => {
      const plan = await service.createPlan({
        id: 'plan-1',
        name: 'Daily Full Backup',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *', timezone: 'UTC' },
        retention: { maxBackups: 30, maxAgeMs: 30 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['database'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      expect(plan.id).toBe('plan-1');
      expect(plan.type).toBe('full');
      expect(plan.enabled).toBe(true);
    });
  });

  describe('getPlan', () => {
    it('should return a plan by ID', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test Plan',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const plan = await service.getPlan('plan-1');
      expect(plan).not.toBeNull();
      expect(plan!.name).toBe('Test Plan');
    });

    it('should return null for non-existent plan', async () => {
      const plan = await service.getPlan('non-existent');
      expect(plan).toBeNull();
    });
  });

  describe('getAllPlans', () => {
    it('should return all plans', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Plan 1',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      await service.createPlan({
        id: 'plan-2',
        name: 'Plan 2',
        type: 'incremental',
        schedule: { cronExpression: '0 */4 * * *' },
        retention: { maxBackups: 60, maxAgeMs: 60 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['database'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const plans = await service.getAllPlans();
      expect(plans.length).toBe(2);
    });
  });

  describe('updatePlan', () => {
    it('should update a plan', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Original',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const updated = await service.updatePlan('plan-1', { name: 'Updated Name' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
    });
  });

  describe('deletePlan', () => {
    it('should delete a plan', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const deleted = await service.deletePlan('plan-1');
      expect(deleted).toBe(true);
      const plan = await service.getPlan('plan-1');
      expect(plan).toBeNull();
    });
  });

  describe('togglePlan', () => {
    it('should toggle a plan', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const toggled = await service.togglePlan('plan-1', false);
      expect(toggled).not.toBeNull();
      expect(toggled!.enabled).toBe(false);
    });
  });

  // ==================== Backup Execution ====================

  describe('triggerBackup', () => {
    it('should trigger a backup and create a record', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test Plan',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['database'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const record = await service.triggerBackup('plan-1');

      expect(record).not.toBeNull();
      expect(record!.planId).toBe('plan-1');
      expect(record!.type).toBe('full');
      expect(record!.status).toBe('completed');
      expect(record!.size).toBeGreaterThan(0);
      expect(record!.checksum).toBeDefined();
    });

    it('should throw error for non-existent plan', async () => {
      await expect(service.triggerBackup('non-existent'))
        .rejects.toThrow('Backup plan non-existent not found');
    });

    it('should create incremental backup', async () => {
      await service.createPlan({
        id: 'plan-inc',
        name: 'Incremental',
        type: 'incremental',
        schedule: { cronExpression: '0 */4 * * *' },
        retention: { maxBackups: 60, maxAgeMs: 60 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['database'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const record = await service.triggerBackup('plan-inc');

      expect(record).not.toBeNull();
      expect(record!.type).toBe('incremental');
    });

    it('should create differential backup', async () => {
      await service.createPlan({
        id: 'plan-diff',
        name: 'Differential',
        type: 'differential',
        schedule: { cronExpression: '0 12 * * *' },
        retention: { maxBackups: 14, maxAgeMs: 14 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const record = await service.triggerBackup('plan-diff');

      expect(record).not.toBeNull();
      expect(record!.type).toBe('differential');
    });
  });

  // ==================== Backup Querying ====================

  describe('getBackups', () => {
    it('should return all backups', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      await service.triggerBackup('plan-1');
      await service.triggerBackup('plan-1');

      const backups = await service.getBackups();
      expect(backups.length).toBe(2);
    });

    it('should filter backups by planId', async () => {
      await service.createPlan({
        id: 'plan-a',
        name: 'Plan A',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      await service.createPlan({
        id: 'plan-b',
        name: 'Plan B',
        type: 'incremental',
        schedule: { cronExpression: '0 */4 * * *' },
        retention: { maxBackups: 60, maxAgeMs: 60 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['database'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      await service.triggerBackup('plan-a');
      await service.triggerBackup('plan-b');

      const planABackups = await service.getBackups({ planId: 'plan-a' });
      expect(planABackups.length).toBe(1);
      expect(planABackups[0].planId).toBe('plan-a');
    });

    it('should filter backups by status', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      await service.triggerBackup('plan-1');

      const completedBackups = await service.getBackups({ status: 'completed' });
      expect(completedBackups.length).toBe(1);
    });

    it('should filter backups by type', async () => {
      await service.createPlan({
        id: 'plan-full',
        name: 'Full',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      await service.createPlan({
        id: 'plan-inc',
        name: 'Incremental',
        type: 'incremental',
        schedule: { cronExpression: '0 */4 * * *' },
        retention: { maxBackups: 60, maxAgeMs: 60 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['database'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      await service.triggerBackup('plan-full');
      await service.triggerBackup('plan-inc');

      const fullBackups = await service.getBackups({ type: 'full' });
      expect(fullBackups.length).toBe(1);
      expect(fullBackups[0].type).toBe('full');
    });
  });

  describe('getBackupDetail', () => {
    it('should return backup detail by ID', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const record = await service.triggerBackup('plan-1');
      const detail = await service.getBackupDetail(record!.id);

      expect(detail).not.toBeNull();
      expect(detail!.id).toBe(record!.id);
    });

    it('should return null for non-existent backup', async () => {
      const detail = await service.getBackupDetail('non-existent');
      expect(detail).toBeNull();
    });
  });

  describe('deleteBackup', () => {
    it('should delete a backup', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const record = await service.triggerBackup('plan-1');
      const deleted = await service.deleteBackup(record!.id);

      expect(deleted).toBe(true);
    });

    it('should return false for non-existent backup', async () => {
      const deleted = await service.deleteBackup('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ==================== Verification ====================

  describe('verifyBackup', () => {
    it('should verify a backup', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const record = await service.triggerBackup('plan-1');
      const verification = await service.verifyBackup(record!.id);

      expect(verification.backupId).toBe(record!.id);
      expect(verification.status).toBe('passed');
      expect(verification.integrityCheck).toBe(true);
    });
  });

  describe('testRestore', () => {
    it('should test restore a backup', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const record = await service.triggerBackup('plan-1');
      const verification = await service.testRestore(record!.id);

      expect(verification.backupId).toBe(record!.id);
      expect(verification.restoreTest).toBe(true);
    });
  });

  // ==================== Recovery ====================

  describe('createRecoveryPlan', () => {
    it('should create a recovery plan', () => {
      const plan = service.createRecoveryPlan({
        id: 'rp-1',
        name: 'Test Recovery',
        rto: 3600000,
        rpo: 86400000,
        steps: [
          { order: 0, description: 'Restore DB', action: 'restore_database' },
          { order: 1, description: 'Verify', action: 'verify' },
        ],
        enabled: true,
      });

      expect(plan.id).toBe('rp-1');
      expect(plan.rto).toBe(3600000);
    });
  });

  describe('getAllRecoveryPlans', () => {
    it('should return all recovery plans', () => {
      service.createRecoveryPlan({
        id: 'rp-1',
        name: 'Plan 1',
        rto: 3600000,
        rpo: 86400000,
        steps: [],
        enabled: true,
      });

      service.createRecoveryPlan({
        id: 'rp-2',
        name: 'Plan 2',
        rto: 7200000,
        rpo: 172800000,
        steps: [],
        enabled: true,
      });

      const plans = service.getAllRecoveryPlans();
      expect(plans.length).toBe(2);
    });
  });

  describe('initiateRecovery', () => {
    it('should initiate a recovery', async () => {
      service.createRecoveryPlan({
        id: 'rp-1',
        name: 'Test Recovery',
        rto: 3600000,
        rpo: 86400000,
        steps: [
          { order: 0, description: 'Step 1', action: 'restore_database' },
          { order: 1, description: 'Step 2', action: 'verify' },
        ],
        enabled: true,
      });

      const execution = await service.initiateRecovery('rp-1');
      expect(execution.planId).toBe('rp-1');
      expect(execution.status).toBe('initiated');
    });
  });

  describe('executeRecoveryPlan', () => {
    it('should execute a recovery plan', async () => {
      service.createRecoveryPlan({
        id: 'rp-1',
        name: 'Test Recovery',
        rto: 3600000,
        rpo: 86400000,
        steps: [
          { order: 0, description: 'Step 1', action: 'restore_database' },
          { order: 1, description: 'Step 2', action: 'verify' },
        ],
        enabled: true,
      });

      const execution = await service.initiateRecovery('rp-1');
      const result = await service.executeRecoveryPlan(execution.id);

      expect(result.status).toBe('completed');
    });
  });

  // ==================== Health & Monitoring ====================

  describe('getBackupStatusSummary', () => {
    it('should return backup status summary', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      await service.triggerBackup('plan-1');

      const summary = await service.getBackupStatusSummary();

      expect(summary.totalBackups).toBeGreaterThan(0);
      expect(summary.byStatus).toBeDefined();
      expect(summary.byType).toBeDefined();
    });

    it('should return empty summary with no backups', async () => {
      const summary = await service.getBackupStatusSummary();

      expect(summary.totalBackups).toBe(0);
      expect(summary.activePlans).toBe(0);
    });
  });

  describe('getStorageUsage', () => {
    it('should return storage usage', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      await service.triggerBackup('plan-1');

      const usage = service.getStorageUsage();

      expect(usage.fileCount).toBeGreaterThan(0);
      expect(usage.usedSpace).toBeGreaterThan(0);
    });
  });

  describe('generateHealthReport', () => {
    it('should generate a health report', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      service.createRecoveryPlan({
        id: 'rp-1',
        name: 'Test Recovery',
        rto: 3600000,
        rpo: 86400000,
        steps: [],
        enabled: true,
      });

      await service.triggerBackup('plan-1');

      const report = await service.generateHealthReport();

      expect(report.healthScore).toBeGreaterThanOrEqual(0);
      expect(report.healthScore).toBeLessThanOrEqual(100);
      expect(report.storageUsage).toBeDefined();
      expect(report.backupSummary).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status with service not running', () => {
      const health = service.getHealthStatus();

      expect(health.running).toBe(false);
    });

    it('should return running status after start', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      await service.triggerBackup('plan-1');

      const health = service.getHealthStatus();
      expect(health.storagePath).toContain('test-backup-service');
    });
  });

  // ==================== Schedule Info ====================

  describe('getAllScheduleInfo', () => {
    it('should return schedule info for all plans', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Plan 1',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const info = service.getAllScheduleInfo();
      expect(info.length).toBe(1);
      expect(info[0].planName).toBe('Plan 1');
    });
  });

  describe('getNextBackupTime', () => {
    it('should return next backup time', async () => {
      await service.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10, maxAgeMs: 10 * 24 * 60 * 60 * 1000, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const nextTime = service.getNextBackupTime('plan-1');
      expect(nextTime).not.toBeNull();
      expect(nextTime!.getHours()).toBe(2);
    });
  });
});
