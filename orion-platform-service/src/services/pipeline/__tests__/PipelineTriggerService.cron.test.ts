/**
 * PipelineTriggerService Cron Scheduler 单元测试
 */

import { PipelineTriggerService, CronScheduleEntry } from '../PipelineTriggerService';

describe('PipelineTriggerService - Cron Scheduler', () => {
  let service: PipelineTriggerService;
  let tickEvents: Array<{ triggerId: string; pipelineId: string }>;

  beforeEach(() => {
    tickEvents = [];
    service = new PipelineTriggerService(async (triggerId, pipelineId) => {
      tickEvents.push({ triggerId, pipelineId });
    });
  });

  describe('scheduleTrigger', () => {
    it('should schedule a cron trigger with valid expression', async () => {
      const trigger = await service.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '* * * * *' }, // every minute
      });

      const schedule = service.getCronSchedule(trigger.id);
      expect(schedule).toBeDefined();
      expect(schedule!.cronExpression).toBe('* * * * *');
      expect(schedule!.nextRunAt).toBeDefined();
    });

    it('should reject invalid cron expression', async () => {
      const trigger = await service.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'manual',
        config: {},
      });

      await expect(
        service.scheduleTrigger(trigger.id, 'invalid expression')
      ).rejects.toThrow('Invalid cron expression');
    });

    it('should auto-schedule when registering a schedule-type trigger', async () => {
      const trigger = await service.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '* * * * *' },
      });

      const schedule = service.getCronSchedule(trigger.id);
      expect(schedule).toBeDefined();
    });

    it('should replace existing schedule when rescheduling', async () => {
      const trigger = await service.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'manual',
        config: {},
      });

      await service.scheduleTrigger(trigger.id, '* * * * *');
      await service.scheduleTrigger(trigger.id, '*/5 * * * *');

      const schedule = service.getCronSchedule(trigger.id);
      expect(schedule).toBeDefined();
      expect(schedule!.cronExpression).toBe('*/5 * * * *');
    });
  });

  describe('unscheduleTrigger', () => {
    it('should remove a scheduled cron trigger', async () => {
      const trigger = await service.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'manual',
        config: {},
      });

      await service.scheduleTrigger(trigger.id, '* * * * *');
      expect(service.getCronSchedule(trigger.id)).toBeDefined();

      await service.unscheduleTrigger(trigger.id);
      expect(service.getCronSchedule(trigger.id)).toBeUndefined();
    });

    it('should be idempotent for non-existent schedules', async () => {
      await expect(service.unscheduleTrigger('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('getCronSchedules', () => {
    it('should list all active cron schedules', async () => {
      const t1 = await service.registerTrigger({
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'manual', config: {},
      });
      const t2 = await service.registerTrigger({
        pipelineId: 'pipe-2', tenantId: 'tenant-1', type: 'manual', config: {},
      });

      await service.scheduleTrigger(t1.id, '* * * * *');
      await service.scheduleTrigger(t2.id, '*/5 * * * *');

      const schedules = service.getCronSchedules();
      expect(schedules.length).toBe(2);
    });

    it('should return empty array when no schedules', () => {
      expect(service.getCronSchedules()).toEqual([]);
    });
  });

  describe('getNextRunTime', () => {
    it('should return next run time for valid expression', () => {
      const next = service.getNextRunTime('* * * * *');
      expect(next).toBeInstanceOf(Date);
      expect(next!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid expression', () => {
      expect(service.getNextRunTime('invalid')).toBeNull();
    });
  });

  describe('deleteTrigger', () => {
    it('should unschedule cron when deleting trigger', async () => {
      const trigger = await service.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '* * * * *' },
      });

      expect(service.getCronSchedule(trigger.id)).toBeDefined();

      await service.deleteTrigger(trigger.id);
      expect(service.getCronSchedule(trigger.id)).toBeUndefined();
      expect(await service.getTrigger(trigger.id)).toBeNull();
    });
  });

  describe('updateTrigger - status changes', () => {
    it('should unschedule cron when trigger is set to inactive', async () => {
      const trigger = await service.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '* * * * *' },
      });

      expect(service.getCronSchedule(trigger.id)).toBeDefined();

      await service.updateTrigger(trigger.id, { status: 'inactive' });
      expect(service.getCronSchedule(trigger.id)).toBeUndefined();
    });

    it('should reschedule cron when trigger is reactivated', async () => {
      const trigger = await service.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '* * * * *' },
      });

      await service.updateTrigger(trigger.id, { status: 'inactive' });
      expect(service.getCronSchedule(trigger.id)).toBeUndefined();

      await service.updateTrigger(trigger.id, { status: 'active' });
      expect(service.getCronSchedule(trigger.id)).toBeDefined();
    });
  });

  describe('trigger history with cron execution', () => {
    it('should record execution history after cron fires', async () => {
      const trigger = await service.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'manual',
        config: {},
      });

      await service.executeTrigger(trigger.id);

      const history = await service.getTriggerHistoryById(trigger.id);
      expect(history.length).toBe(1);
      expect(history[0].status).toBe('success');
    });
  });
});
