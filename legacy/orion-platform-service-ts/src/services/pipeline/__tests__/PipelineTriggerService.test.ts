/**
 * PipelineTriggerService 单元测试
 */

import {
  PipelineTriggerService,
  PipelineTriggerServiceError,
  type CreateTriggerInput,
  type TriggerEvent,
} from '../PipelineTriggerService';

describe('PipelineTriggerService', () => {
  let service: PipelineTriggerService;

  beforeEach(() => {
    service = new PipelineTriggerService();
  });

  // ==================== registerTrigger ====================

  describe('registerTrigger', () => {
    it('should register a new git trigger', async () => {
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: { branch: 'main', pathPatterns: ['src/**'] },
      };

      const trigger = await service.registerTrigger(input);

      expect(trigger.id).toMatch(/^trigger-/);
      expect(trigger.pipelineId).toBe('pipe-1');
      expect(trigger.tenantId).toBe('tenant-1');
      expect(trigger.type).toBe('git');
      expect(trigger.status).toBe('active');
      expect(trigger.config.branch).toBe('main');
    });

    it('should throw error for missing required fields', async () => {
      await expect(
        service.registerTrigger({ pipelineId: '', tenantId: '', type: 'git' as any, config: {} })
      ).rejects.toThrow(PipelineTriggerServiceError);
    });

    it('should register a webhook trigger', async () => {
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-2',
        tenantId: 'tenant-1',
        type: 'webhook',
        config: { webhookUrl: 'https://example.com/hook', secret: 'abc123' },
      };

      const trigger = await service.registerTrigger(input);
      expect(trigger.type).toBe('webhook');
      expect(trigger.config.webhookUrl).toBe('https://example.com/hook');
    });
  });

  // ==================== getTrigger ====================

  describe('getTrigger', () => {
    it('should return trigger by ID', async () => {
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: { branch: 'main' },
      };
      const created = await service.registerTrigger(input);

      const found = await service.getTrigger(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent trigger', async () => {
      const found = await service.getTrigger('non-existent');
      expect(found).toBeNull();
    });
  });

  // ==================== updateTrigger ====================

  describe('updateTrigger', () => {
    it('should update trigger type', async () => {
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: { branch: 'main' },
      };
      const created = await service.registerTrigger(input);

      const updated = await service.updateTrigger(created.id, { type: 'webhook' });
      expect(updated.type).toBe('webhook');
    });

    it('should update trigger config partially', async () => {
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: { branch: 'main', pathPatterns: ['src/**'] },
      };
      const created = await service.registerTrigger(input);

      const updated = await service.updateTrigger(created.id, {
        config: { branch: 'develop' },
      });
      expect(updated.config.branch).toBe('develop');
      // Original config should be merged
      expect(updated.config.pathPatterns).toEqual(['src/**']);
    });

    it('should update trigger status', async () => {
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      };
      const created = await service.registerTrigger(input);

      const updated = await service.updateTrigger(created.id, { status: 'inactive' });
      expect(updated.status).toBe('inactive');
    });

    it('should throw error for non-existent trigger', async () => {
      await expect(
        service.updateTrigger('non-existent', { type: 'git' })
      ).rejects.toThrow(PipelineTriggerServiceError);
    });

    it('should update updatedAt timestamp', async () => {
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      };
      const created = await service.registerTrigger(input);
      const beforeUpdate = created.updatedAt.getTime();

      // Small delay to ensure timestamp changes
      await new Promise((r) => setTimeout(r, 10));
      const updated = await service.updateTrigger(created.id, { status: 'inactive' });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(beforeUpdate);
    });
  });

  // ==================== deleteTrigger ====================

  describe('deleteTrigger', () => {
    it('should delete a trigger', async () => {
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      };
      const created = await service.registerTrigger(input);

      await service.deleteTrigger(created.id);

      const found = await service.getTrigger(created.id);
      expect(found).toBeNull();
    });

    it('should not throw for non-existent trigger', async () => {
      await expect(service.deleteTrigger('non-existent')).resolves.toBeUndefined();
    });
  });

  // ==================== listTriggers ====================

  describe('listTriggers', () => {
    it('should list triggers by pipeline', async () => {
      await service.registerTrigger({
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'git', config: {},
      });
      await service.registerTrigger({
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'webhook', config: {},
      });
      await service.registerTrigger({
        pipelineId: 'pipe-2', tenantId: 'tenant-1', type: 'schedule', config: {},
      });

      const triggers = await service.listTriggersByPipeline('tenant-1', 'pipe-1');
      expect(triggers).toHaveLength(2);
      expect(triggers.every((t) => t.pipelineId === 'pipe-1')).toBe(true);
    });

    it('should list triggers by tenant', async () => {
      await service.registerTrigger({
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'git', config: {},
      });
      await service.registerTrigger({
        pipelineId: 'pipe-2', tenantId: 'tenant-2', type: 'git', config: {},
      });

      const triggers = await service.listTriggersByTenant('tenant-1');
      expect(triggers).toHaveLength(1);
      expect(triggers[0].tenantId).toBe('tenant-1');
    });
  });

  // ==================== evaluateTrigger ====================

  describe('evaluateTrigger', () => {
    it('should match git trigger on branch', async () => {
      await service.registerTrigger({
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'git',
        config: { branch: 'main' },
      });

      const event: TriggerEvent = {
        type: 'git',
        payload: { branch: 'main' },
        timestamp: new Date(),
      };

      const matched = await service.evaluateTrigger(event);
      expect(matched).toHaveLength(1);
    });

    it('should not match inactive triggers', async () => {
      const created = await service.registerTrigger({
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'git',
        config: { branch: 'main' },
      });
      await service.updateTriggerStatus(created.id, 'inactive');

      const event: TriggerEvent = {
        type: 'git',
        payload: { branch: 'main' },
        timestamp: new Date(),
      };

      const matched = await service.evaluateTrigger(event);
      expect(matched).toHaveLength(0);
    });

    it('should not match different trigger types', async () => {
      await service.registerTrigger({
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'git',
        config: { branch: 'main' },
      });

      const event: TriggerEvent = {
        type: 'webhook',
        payload: {},
        timestamp: new Date(),
      };

      const matched = await service.evaluateTrigger(event);
      expect(matched).toHaveLength(0);
    });
  });

  // ==================== executeTrigger ====================

  describe('executeTrigger', () => {
    it('should execute a trigger and return record', async () => {
      const created = await service.registerTrigger({
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'git', config: {},
      });

      const record = await service.executeTrigger(created.id);
      expect(record.triggerId).toBe(created.id);
      expect(record.pipelineId).toBe('pipe-1');
      expect(record.status).toBe('success');
    });

    it('should throw for non-existent trigger', async () => {
      await expect(service.executeTrigger('non-existent')).rejects.toThrow(
        PipelineTriggerServiceError
      );
    });
  });

  // ==================== getTriggerHistory ====================

  describe('getTriggerHistory', () => {
    it('should return execution history', async () => {
      const created = await service.registerTrigger({
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'git', config: {},
      });
      await service.executeTrigger(created.id);
      await service.executeTrigger(created.id);

      const history = await service.getTriggerHistory('pipe-1', 'tenant-1');
      expect(history).toHaveLength(2);
    });

    it('should return empty history for no executions', async () => {
      const history = await service.getTriggerHistory('pipe-non-existent');
      expect(history).toHaveLength(0);
    });
  });

  // ==================== recordFailure ====================

  describe('recordFailure', () => {
    it('should record a failure', async () => {
      const created = await service.registerTrigger({
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'git', config: {},
      });

      const record = await service.recordFailure(created.id, 'timeout');
      expect(record.status).toBe('failed');
      expect(record.message).toBe('timeout');
    });

    it('should mark trigger as failed after 5 consecutive failures', async () => {
      const created = await service.registerTrigger({
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'git', config: {},
      });

      for (let i = 0; i < 5; i++) {
        await service.recordFailure(created.id, `error-${i}`);
      }

      const trigger = await service.getTrigger(created.id);
      expect(trigger!.status).toBe('failed');
    });
  });
});
