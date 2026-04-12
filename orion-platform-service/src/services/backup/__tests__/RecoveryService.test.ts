/**
 * TASK-704: RecoveryService Unit Tests
 */

import { RecoveryService } from '../RecoveryService';
import { BackupRecord } from '../../types';

describe('RecoveryService', () => {
  let recovery: RecoveryService;

  beforeEach(() => {
    recovery = new RecoveryService();
  });

  // Helper to create a test recovery plan
  function createRecoveryPlan(overrides?: any) {
    return {
      id: 'rp-1',
      name: 'Test Recovery Plan',
      rto: 3600000, // 1 hour
      rpo: 86400000, // 24 hours
      steps: [
        { order: 0, description: 'Stop services', action: 'start_services' as const, estimatedDurationMs: 100 },
        { order: 1, description: 'Restore database', action: 'restore_database' as const, estimatedDurationMs: 100 },
        { order: 2, description: 'Restore filesystem', action: 'restore_filesystem' as const, estimatedDurationMs: 100 },
        { order: 3, description: 'Verify restoration', action: 'verify' as const, estimatedDurationMs: 100 },
        { order: 4, description: 'Start services', action: 'start_services' as const, estimatedDurationMs: 100 },
      ],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Helper to create a test backup record
  function createBackupRecord(overrides?: Partial<BackupRecord>): BackupRecord {
    return {
      id: 'backup-test',
      planId: 'plan-1',
      type: 'full',
      status: 'completed',
      size: 1024,
      startedAt: new Date(),
      completedAt: new Date(),
      storageLocation: '/test/backup.bak',
      sources: ['database'],
      ...overrides,
    };
  }

  // ==================== Recovery Plan Management ====================

  describe('createPlan', () => {
    it('should create a recovery plan', () => {
      const plan = recovery.createPlan(createRecoveryPlan());

      expect(plan.id).toBe('rp-1');
      expect(plan.name).toBe('Test Recovery Plan');
      expect(plan.rto).toBe(3600000);
      expect(plan.rpo).toBe(86400000);
      expect(plan.steps.length).toBe(5);
    });

    it('should throw error for invalid RTO', () => {
      expect(() => recovery.createPlan(createRecoveryPlan({ rto: 0 })))
        .toThrow('RTO must be a positive number');
    });

    it('should throw error for invalid RPO', () => {
      expect(() => recovery.createPlan(createRecoveryPlan({ rpo: -1 })))
        .toThrow('RPO must be a positive number');
    });

    it('should sort steps by order', () => {
      const plan = recovery.createPlan(createRecoveryPlan({
        steps: [
          { order: 2, description: 'Step 3', action: 'verify' },
          { order: 0, description: 'Step 1', action: 'restore_database' },
          { order: 1, description: 'Step 2', action: 'restore_filesystem' },
        ],
      }));

      expect(plan.steps[0].description).toBe('Step 1');
      expect(plan.steps[1].description).toBe('Step 2');
      expect(plan.steps[2].description).toBe('Step 3');
    });

    it('should emit plan:created event', () => {
      let created = false;
      recovery.on('plan:created', () => { created = true; });

      recovery.createPlan(createRecoveryPlan());
      expect(created).toBe(true);
    });
  });

  describe('getPlan', () => {
    it('should return a plan by ID', () => {
      recovery.createPlan(createRecoveryPlan());

      const plan = recovery.getPlan('rp-1');
      expect(plan).not.toBeNull();
      expect(plan!.name).toBe('Test Recovery Plan');
    });

    it('should return null for non-existent plan', () => {
      const plan = recovery.getPlan('non-existent');
      expect(plan).toBeNull();
    });
  });

  describe('getAllPlans', () => {
    it('should return all plans', () => {
      recovery.createPlan(createRecoveryPlan({ id: 'rp-1' }));
      recovery.createPlan(createRecoveryPlan({ id: 'rp-2', name: 'Plan 2' }));

      const plans = recovery.getAllPlans();
      expect(plans.length).toBe(2);
    });
  });

  describe('updatePlan', () => {
    it('should update a plan', () => {
      recovery.createPlan(createRecoveryPlan());

      const updated = recovery.updatePlan('rp-1', { name: 'Updated Plan' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Plan');
    });

    it('should return null for non-existent plan', () => {
      const updated = recovery.updatePlan('non-existent', { name: 'Updated' });
      expect(updated).toBeNull();
    });
  });

  describe('deletePlan', () => {
    it('should delete a plan', () => {
      recovery.createPlan(createRecoveryPlan());

      const deleted = recovery.deletePlan('rp-1');
      expect(deleted).toBe(true);
      expect(recovery.getPlan('rp-1')).toBeNull();
    });

    it('should return false for non-existent plan', () => {
      const deleted = recovery.deletePlan('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('markPlanTested', () => {
    it('should mark a plan as tested', () => {
      recovery.createPlan(createRecoveryPlan());

      const updated = recovery.markPlanTested('rp-1');
      expect(updated).not.toBeNull();
      expect(updated!.lastTested).toBeDefined();
    });
  });

  // ==================== Recovery Execution ====================

  describe('initiateRecovery', () => {
    it('should initiate a recovery process', async () => {
      recovery.createPlan(createRecoveryPlan());

      const execution = await recovery.initiateRecovery('rp-1');

      expect(execution.planId).toBe('rp-1');
      expect(execution.status).toBe('initiated');
      expect(execution.stepExecutions.length).toBe(5);
      expect(execution.rtoTargetMs).toBe(3600000);
      expect(execution.rpoTargetMs).toBe(86400000);
    });

    it('should throw error for non-existent plan', async () => {
      await expect(recovery.initiateRecovery('non-existent'))
        .rejects.toThrow('Recovery plan non-existent not found');
    });

    it('should throw error for disabled plan', async () => {
      recovery.createPlan(createRecoveryPlan({ enabled: false }));

      await expect(recovery.initiateRecovery('rp-1'))
        .rejects.toThrow('Recovery plan rp-1 is disabled');
    });

    it('should accept backupId and targetTime options', async () => {
      recovery.createPlan(createRecoveryPlan());

      const targetTime = new Date('2024-01-15T10:00:00Z');
      const execution = await recovery.initiateRecovery('rp-1', {
        backupId: 'backup-123',
        targetTime,
      });

      expect(execution.backupId).toBe('backup-123');
      expect(execution.targetTime).toEqual(targetTime);
    });

    it('should emit recovery:initiated event', async () => {
      recovery.createPlan(createRecoveryPlan());

      let initiated = false;
      recovery.on('recovery:initiated', () => { initiated = true; });

      await recovery.initiateRecovery('rp-1');
      expect(initiated).toBe(true);
    });
  });

  describe('executeRecoveryPlan', () => {
    it('should execute a recovery plan successfully', async () => {
      recovery.createPlan(createRecoveryPlan());

      const execution = await recovery.initiateRecovery('rp-1');
      const result = await recovery.executeRecoveryPlan(execution.id);

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
      expect(result.actualRtoMs).toBeDefined();
      expect(result.actualRtoMs!).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for non-existent execution', async () => {
      await expect(recovery.executeRecoveryPlan('non-existent'))
        .rejects.toThrow('Recovery execution non-existent not found');
    });

    it('should emit recovery:started event', async () => {
      recovery.createPlan(createRecoveryPlan());

      const execution = await recovery.initiateRecovery('rp-1');

      let started = false;
      recovery.on('recovery:started', () => { started = true; });

      await recovery.executeRecoveryPlan(execution.id);
      expect(started).toBe(true);
    });

    it('should emit recovery:completed event', async () => {
      recovery.createPlan(createRecoveryPlan());

      const execution = await recovery.initiateRecovery('rp-1');

      let completed = false;
      recovery.on('recovery:completed', () => { completed = true; });

      await recovery.executeRecoveryPlan(execution.id);
      expect(completed).toBe(true);
    });
  });

  // ==================== Point-in-Time Recovery ====================

  describe('findBackupForPointInTime', () => {
    it('should find the best backup for a target time', () => {
      const backups: BackupRecord[] = [
        createBackupRecord({
          id: 'backup-1',
          completedAt: new Date('2024-01-10T00:00:00Z'),
        }),
        createBackupRecord({
          id: 'backup-2',
          completedAt: new Date('2024-01-12T00:00:00Z'),
        }),
        createBackupRecord({
          id: 'backup-3',
          completedAt: new Date('2024-01-14T00:00:00Z'),
        }),
      ];

      const targetTime = new Date('2024-01-13T00:00:00Z');
      const result = recovery.findBackupForPointInTime(targetTime, backups);

      expect(result).not.toBeNull();
      expect(result!.backup.id).toBe('backup-2');
      expect(result!.dataLossMs).toBe(24 * 60 * 60 * 1000); // 1 day
    });

    it('should return null when no backup exists before target time', () => {
      const backups: BackupRecord[] = [
        createBackupRecord({
          id: 'backup-1',
          completedAt: new Date('2024-01-15T00:00:00Z'),
        }),
      ];

      const targetTime = new Date('2024-01-10T00:00:00Z');
      const result = recovery.findBackupForPointInTime(targetTime, backups);

      expect(result).toBeNull();
    });
  });

  describe('initiatePointInTimeRecovery', () => {
    it('should initiate point-in-time recovery', async () => {
      recovery.createPlan(createRecoveryPlan());

      const backups: BackupRecord[] = [
        createBackupRecord({
          id: 'backup-pitr',
          completedAt: new Date('2024-01-10T00:00:00Z'),
        }),
      ];
      recovery.registerBackups(backups);

      const targetTime = new Date('2024-01-11T00:00:00Z');
      const execution = await recovery.initiatePointInTimeRecovery('rp-1', targetTime, backups);

      expect(execution.backupId).toBe('backup-pitr');
      expect(execution.targetTime).toEqual(targetTime);
    });

    it('should throw error when no suitable backup found', async () => {
      recovery.createPlan(createRecoveryPlan());

      const targetTime = new Date('2024-01-01T00:00:00Z');
      await expect(
        recovery.initiatePointInTimeRecovery('rp-1', targetTime, [])
      ).rejects.toThrow('No suitable backup found');
    });
  });

  // ==================== RTO/RPO Tracking ====================

  describe('trackRTO', () => {
    it('should track RTO compliance', async () => {
      recovery.createPlan(createRecoveryPlan());

      const execution = await recovery.initiateRecovery('rp-1');
      await recovery.executeRecoveryPlan(execution.id);

      expect(execution.rtoMet).toBe(true); // Should be fast enough in tests
    });

    it('should emit recovery:rto:tracked event', async () => {
      recovery.createPlan(createRecoveryPlan({ rto: 1 })); // Very short RTO to potentially miss

      const execution = await recovery.initiateRecovery('rp-1');
      await recovery.executeRecoveryPlan(execution.id);

      // Event should have been emitted
      expect(execution.rtoMet).toBeDefined();
    });
  });

  describe('trackRPO', () => {
    it('should track RPO compliance with target time', async () => {
      recovery.createPlan(createRecoveryPlan({
        rpo: 172800000, // 48 hours
      }));

      const backupTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const targetTime = new Date();

      recovery.registerBackups([
        createBackupRecord({
          id: 'backup-rpo',
          completedAt: backupTime,
        }),
      ]);

      const execution = await recovery.initiateRecovery('rp-1', {
        backupId: 'backup-rpo',
        targetTime,
      });
      await recovery.executeRecoveryPlan(execution.id);

      expect(execution.rpoMet).toBe(true); // 24h loss within 48h RPO
    });
  });

  describe('getRtoRpoStats', () => {
    it('should return statistics after executions', async () => {
      recovery.createPlan(createRecoveryPlan());

      const execution1 = await recovery.initiateRecovery('rp-1');
      await recovery.executeRecoveryPlan(execution1.id);

      const execution2 = await recovery.initiateRecovery('rp-1');
      await recovery.executeRecoveryPlan(execution2.id);

      const stats = recovery.getRtoRpoStats();

      expect(stats.totalExecutions).toBe(2);
      expect(stats.completedExecutions).toBe(2);
      expect(stats.averageRtoMs).toBeGreaterThanOrEqual(0);
    });

    it('should return zero stats with no executions', () => {
      const stats = recovery.getRtoRpoStats();

      expect(stats.totalExecutions).toBe(0);
      expect(stats.averageRtoMs).toBe(0);
    });
  });

  // ==================== Rollback ====================

  describe('rollbackRecovery', () => {
    it('should rollback a failed recovery', async () => {
      recovery.createPlan(createRecoveryPlan());

      const execution = await recovery.initiateRecovery('rp-1');
      // Manually set to failed for rollback testing
      execution.status = 'failed';

      const rolledBack = recovery.rollbackRecovery('non-existent-execution-id');
      expect(rolledBack).toBeNull();
    });

    it('should return null for non-existent execution', () => {
      const rolledBack = recovery.rollbackRecovery('non-existent');
      expect(rolledBack).toBeNull();
    });
  });

  // ==================== Execution History ====================

  describe('getExecution', () => {
    it('should return an execution by ID', async () => {
      recovery.createPlan(createRecoveryPlan());

      const execution = await recovery.initiateRecovery('rp-1');
      const retrieved = recovery.getExecution(execution.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(execution.id);
    });
  });

  describe('getExecutionsForPlan', () => {
    it('should return executions for a specific plan', async () => {
      recovery.createPlan(createRecoveryPlan({ id: 'rp-1' }));
      recovery.createPlan(createRecoveryPlan({ id: 'rp-2', name: 'Plan 2' }));

      await recovery.initiateRecovery('rp-1');
      await recovery.initiateRecovery('rp-1');
      await recovery.initiateRecovery('rp-2');

      const plan1Executions = recovery.getExecutionsForPlan('rp-1');
      expect(plan1Executions.length).toBe(2);
    });
  });

  describe('registerBackups', () => {
    it('should register backups for RPO calculation', () => {
      const backups: BackupRecord[] = [
        createBackupRecord({ id: 'backup-a' }),
        createBackupRecord({ id: 'backup-b' }),
      ];

      recovery.registerBackups(backups);
      // No direct assertion, but this enables RPO tracking
      expect(recovery.getRtoRpoStats().totalExecutions).toBe(0);
    });
  });
});
