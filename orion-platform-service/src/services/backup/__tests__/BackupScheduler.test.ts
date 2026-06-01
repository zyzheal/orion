/**
 * TASK-704: BackupScheduler Unit Tests
 */

import { BackupScheduler, getNextCronTime } from '../BackupScheduler';
import { BackupPlan, BackupRecord } from '../../types';

describe('getNextCronTime', () => {
  it('should parse a simple cron expression for next minute', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const next = getNextCronTime('* * * * *', now);

    // Next minute should be after the input time
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.getMinutes() % 1 === 0).toBe(true); // Valid minute
  });

  it('should parse specific hour and minute', () => {
    const now = new Date('2024-01-01T01:00:00Z');
    const next = getNextCronTime('30 14 * * *', now);

    // Should find 14:30 (in local time)
    expect(next).toBeDefined();
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it('should throw on invalid cron expression', () => {
    expect(() => getNextCronTime('invalid')).toThrow();
  });

  it('should handle step values', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const next = getNextCronTime('*/15 * * * *', now);

    expect(next.getMinutes() % 15).toBe(0);
  });
});

describe('BackupScheduler', () => {
  let scheduler: BackupScheduler;

  beforeEach(() => {
    scheduler = new BackupScheduler(100); // 100ms check interval for fast tests
  });

  afterEach(() => {
    scheduler.stop();
  });

  // ==================== Plan Management ====================

  describe('createPlan', () => {
    it('should create a backup plan', async () => {
      const plan = await scheduler.createPlan({
        id: 'plan-1',
        name: 'Daily Full Backup',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *', timezone: 'UTC' },
        retention: { maxBackups: 30 },
        sources: ['database'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      expect(plan.id).toBe('plan-1');
      expect(plan.name).toBe('Daily Full Backup');
      expect(plan.type).toBe('full');
      expect(plan.enabled).toBe(true);
    });

    it('should emit plan:created event', () => {
      let created = false;
      scheduler.on('plan:created', () => { created = true; });

      scheduler.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      expect(created).toBe(true);
    });
  });

  describe('getPlan', () => {
    it('should return a plan by ID', () => {
      scheduler.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const plan = scheduler.getPlan('plan-1');
      expect(plan).not.toBeNull();
      expect(plan!.name).toBe('Test');
    });

    it('should return null for non-existent plan', () => {
      const plan = scheduler.getPlan('non-existent');
      expect(plan).toBeNull();
    });
  });

  describe('getAllPlans', () => {
    it('should return all plans', () => {
      scheduler.createPlan({
        id: 'plan-1',
        name: 'Plan 1',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['database'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      scheduler.createPlan({
        id: 'plan-2',
        name: 'Plan 2',
        type: 'incremental',
        schedule: { cronExpression: '0 */4 * * *' },
        retention: { maxBackups: 60 },
        sources: ['database'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const plans = scheduler.getAllPlans();
      expect(plans.length).toBe(2);
    });
  });

  describe('updatePlan', () => {
    it('should update a plan', async () => {
      await scheduler.createPlan({
        id: 'plan-1',
        name: 'Original',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['database'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const updated = await scheduler.updatePlan('plan-1', { name: 'Updated' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated');
    });

    it('should return null for non-existent plan', async () => {
      const updated = await scheduler.updatePlan('non-existent', { name: 'Updated' });
      expect(updated).toBeNull();
    });
  });

  describe('deletePlan', () => {
    it('should delete a plan', async () => {
      await scheduler.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const deleted = await scheduler.deletePlan('plan-1');
      expect(deleted).toBe(true);
      expect(scheduler.getPlan('plan-1')).toBeNull();
    });

    it('should return false for non-existent plan', async () => {
      const deleted = await scheduler.deletePlan('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('togglePlan', () => {
    it('should toggle a plan to disabled', async () => {
      await scheduler.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const toggled = await scheduler.togglePlan('plan-1', false);
      expect(toggled).not.toBeNull();
      expect(toggled!.enabled).toBe(false);
    });
  });

  // ==================== Scheduling ====================

  describe('start/stop', () => {
    it('should start the scheduler', () => {
      scheduler.start();
      expect(scheduler.getIsRunning()).toBe(true);
    });

    it('should stop the scheduler', async () => {
      scheduler.start();
      scheduler.stop();
      expect(scheduler.getIsRunning()).toBe(false);
    });

    it('should be idempotent for start', () => {
      scheduler.start();
      scheduler.start(); // Should not error
      expect(scheduler.getIsRunning()).toBe(true);
    });

    it('should be idempotent for stop', () => {
      scheduler.stop(); // Should not error when not started
      expect(scheduler.getIsRunning()).toBe(false);
    });

    it('should emit started event', () => {
      let started = false;
      scheduler.on('started', () => { started = true; });
      scheduler.start();
      expect(started).toBe(true);
    });

    it('should emit stopped event', () => {
      let stopped = false;
      scheduler.on('stopped', () => { stopped = true; });
      scheduler.start();
      scheduler.stop();
      expect(stopped).toBe(true);
    });
  });

  describe('getNextBackupTime', () => {
    it('should return next backup time for a plan', () => {
      scheduler.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const nextTime = scheduler.getNextBackupTime('plan-1');
      expect(nextTime).not.toBeNull();
      expect(nextTime!.getHours()).toBe(2);
      expect(nextTime!.getMinutes()).toBe(0);
    });

    it('should return null for disabled plan', () => {
      scheduler.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['all'],
        enabled: false,
        compress: true,
        encrypt: false,
      });

      const nextTime = scheduler.getNextBackupTime('plan-1');
      expect(nextTime).toBeNull();
    });
  });

  // ==================== Backup Triggering ====================

  describe('triggerBackup', () => {
    it('should trigger a backup when executor is configured', async () => {
      scheduler.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      scheduler.onExecuteBackup = async (plan) => {
        return {
          id: 'backup-1',
          planId: plan.id,
          type: plan.type,
          status: 'completed',
          size: 1024,
          startedAt: new Date(),
          completedAt: new Date(),
          storageLocation: '/test/backup-1.bak',
          checksum: 'abc123',
          sources: plan.sources,
        } as BackupRecord;
      };

      const result = await scheduler.triggerBackup('plan-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('backup-1');
    });

    it('should return null for non-existent plan', async () => {
      const result = await scheduler.triggerBackup('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for disabled plan', async () => {
      scheduler.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['all'],
        enabled: false,
        compress: true,
        encrypt: false,
      });

      const result = await scheduler.triggerBackup('plan-1');
      expect(result).toBeNull();
    });
  });

  // ==================== Retention Policy ====================

  describe('enforceRetention', () => {
    it('should enforce maxBackups retention', () => {
      scheduler.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 2, minBackups: 1 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const plan = scheduler.getPlan('plan-1')!;

      const backups: BackupRecord[] = [
        {
          id: 'backup-1', planId: 'plan-1', type: 'full', status: 'completed',
          size: 1000, startedAt: new Date('2024-01-01'), completedAt: new Date('2024-01-01'),
          storageLocation: '/test/1.bak', sources: ['all'],
        },
        {
          id: 'backup-2', planId: 'plan-1', type: 'full', status: 'completed',
          size: 1000, startedAt: new Date('2024-01-02'), completedAt: new Date('2024-01-02'),
          storageLocation: '/test/2.bak', sources: ['all'],
        },
        {
          id: 'backup-3', planId: 'plan-1', type: 'full', status: 'completed',
          size: 1000, startedAt: new Date('2024-01-03'), completedAt: new Date('2024-01-03'),
          storageLocation: '/test/3.bak', sources: ['all'],
        },
        {
          id: 'backup-4', planId: 'plan-1', type: 'full', status: 'completed',
          size: 1000, startedAt: new Date('2024-01-04'), completedAt: new Date('2024-01-04'),
          storageLocation: '/test/4.bak', sources: ['all'],
        },
      ];

      const toDelete = scheduler.enforceRetention(plan, backups);
      expect(toDelete.length).toBeGreaterThan(0);
    });

    it('should not delete if under maxBackups', () => {
      scheduler.createPlan({
        id: 'plan-1',
        name: 'Test',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const plan = scheduler.getPlan('plan-1')!;

      const backups: BackupRecord[] = [
        {
          id: 'backup-1', planId: 'plan-1', type: 'full', status: 'completed',
          size: 1000, startedAt: new Date(), completedAt: new Date(),
          storageLocation: '/test/1.bak', sources: ['all'],
        },
      ];

      const toDelete = scheduler.enforceRetention(plan, backups);
      expect(toDelete.length).toBe(0);
    });
  });

  // ==================== Schedule Info ====================

  describe('getScheduleInfo', () => {
    it('should return schedule info for a plan', () => {
      scheduler.createPlan({
        id: 'plan-1',
        name: 'Test Plan',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *', description: 'Daily at 2am' },
        retention: { maxBackups: 10 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      const info = scheduler.getScheduleInfo('plan-1');
      expect(info).not.toBeNull();
      expect(info!.planName).toBe('Test Plan');
      expect(info!.enabled).toBe(true);
    });

    it('should return null for non-existent plan', () => {
      const info = scheduler.getScheduleInfo('non-existent');
      expect(info).toBeNull();
    });
  });

  describe('getAllScheduleInfo', () => {
    it('should return all schedule info', () => {
      scheduler.createPlan({
        id: 'plan-1',
        name: 'Plan 1',
        type: 'full',
        schedule: { cronExpression: '0 2 * * *' },
        retention: { maxBackups: 10 },
        sources: ['all'],
        enabled: true,
        compress: true,
        encrypt: false,
      });

      scheduler.createPlan({
        id: 'plan-2',
        name: 'Plan 2',
        type: 'incremental',
        schedule: { cronExpression: '0 */4 * * *' },
        retention: { maxBackups: 60 },
        sources: ['database'],
        enabled: false,
        compress: true,
        encrypt: false,
      });

      const infos = scheduler.getAllScheduleInfo();
      expect(infos.length).toBe(2);
    });
  });
});
