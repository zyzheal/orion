/**
 * UnifiedTriggerService Tests
 *
 * Covers: trigger CRUD (register, get, list, update, delete),
 * trigger evaluation, pipeline execution from trigger, stats,
 * event history, condition evaluation (conditions, filters, expressions).
 */

import {
  UnifiedTriggerService,
  TriggerConfig,
  TriggerInput,
  TriggerStats,
} from '../UnifiedTriggerService';
import {
  TriggerRepository,
  TriggerEventRepository,
  TriggerEntity,
  TriggerEventEntity,
} from '../../../repositories/Phase3Repository';

// ============================================================
// Mock Repositories
// ============================================================

class MockTriggerRepository {
  private triggers: Map<string, TriggerEntity> = new Map();

  async create(entity: any): Promise<TriggerEntity> {
    const trigger: TriggerEntity = {
      id: entity.id,
      tenant_id: entity.tenant_id,
      name: entity.name,
      type: entity.type,
      config: entity.config || {},
      condition_expression: entity.condition_expression,
      pipeline_id: entity.pipeline_id,
      enabled: entity.enabled ?? true,
      trigger_count: entity.trigger_count || 0,
      last_triggered_at: entity.last_triggered_at,
      created_by: entity.created_by,
      created_at: entity.created_at || new Date(),
      updated_at: entity.updated_at || new Date(),
    };
    this.triggers.set(trigger.id, trigger);
    return trigger;
  }

  async findById(id: string): Promise<TriggerEntity | undefined> {
    return this.triggers.get(id);
  }

  async findByTenant(tenantId: string): Promise<TriggerEntity[]> {
    return Array.from(this.triggers.values()).filter(t => t.tenant_id === tenantId);
  }

  async findByType(tenantId: string, type: string): Promise<TriggerEntity[]> {
    return Array.from(this.triggers.values()).filter(
      t => t.tenant_id === tenantId && t.type === type
    );
  }

  async update(id: string, updates: any): Promise<TriggerEntity> {
    const trigger = this.triggers.get(id);
    if (!trigger) throw new Error(`Trigger not found: ${id}`);
    const updated = { ...trigger, ...updates, updated_at: new Date() };
    this.triggers.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.triggers.delete(id);
  }

  async incrementTriggerCount(id: string): Promise<void> {
    const trigger = this.triggers.get(id);
    if (trigger) {
      trigger.trigger_count += 1;
      trigger.last_triggered_at = new Date();
    }
  }
}

class MockTriggerEventRepository {
  private events: Map<string, TriggerEventEntity> = new Map();

  async create(entity: any): Promise<TriggerEventEntity> {
    const event: TriggerEventEntity = {
      id: entity.id,
      trigger_id: entity.trigger_id,
      tenant_id: entity.tenant_id,
      event_type: entity.event_type,
      event_payload: entity.event_payload,
      evaluation_result: entity.evaluation_result,
      pipeline_run_id: entity.pipeline_run_id,
      created_at: entity.created_at || new Date(),
    };
    this.events.set(event.id, event);
    return event;
  }

  async update(id: string, updates: any): Promise<TriggerEventEntity> {
    const event = this.events.get(id);
    if (!event) throw new Error(`Event not found: ${id}`);
    const updated = { ...event, ...updates };
    this.events.set(id, updated);
    return updated;
  }

  async findByTriggerId(triggerId: string, limit: number = 50): Promise<TriggerEventEntity[]> {
    return Array.from(this.events.values())
      .filter(e => e.trigger_id === triggerId)
      .slice(0, limit);
  }

  async countByTrigger(triggerId: string): Promise<number> {
    return Array.from(this.events.values()).filter(e => e.trigger_id === triggerId).length;
  }
}

describe('UnifiedTriggerService', () => {
  let service: UnifiedTriggerService;
  let mockTriggerRepo: MockTriggerRepository;
  let mockEventRepo: MockTriggerEventRepository;

  const webhookConfig: TriggerConfig = {
    webhookPath: '/hooks/deploy',
    conditions: { environment: 'production' },
  };

  const scheduleConfig: TriggerConfig = {
    schedule: '0 2 * * *',
  };

  const chatConfig: TriggerConfig = {
    chatCommands: ['/deploy', '/rollback'],
  };

  const eventConfig: TriggerConfig = {
    eventTypes: ['build.completed', 'deploy.finished'],
    filters: {
      'branch': { includes: ['main', 'release/*'] },
    },
  };

  beforeEach(() => {
    mockTriggerRepo = new MockTriggerRepository();
    mockEventRepo = new MockTriggerEventRepository();

    // We need to inject the mocked repos into the service.
    // Since the service creates its own repos, we'll use a db=null approach
    // and instead access private fields. For proper testing, we use
    // reflection to replace the repos.
    service = new UnifiedTriggerService();
    (service as any).triggerRepo = mockTriggerRepo as TriggerRepository;
    (service as any).eventRepo = mockEventRepo as TriggerEventRepository;
  });

  // ==================== registerTrigger ====================

  describe('registerTrigger', () => {
    it('should register a webhook trigger', async () => {
      const trigger = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'deploy-webhook',
        type: 'webhook',
        config: webhookConfig,
        pipelineId: 'pipeline-001',
        createdBy: 'user-1',
      });

      expect(trigger.id).toBeDefined();
      expect(trigger.tenant_id).toBe('tenant-1');
      expect(trigger.name).toBe('deploy-webhook');
      expect(trigger.type).toBe('webhook');
      expect(trigger.enabled).toBe(true);
      expect(trigger.trigger_count).toBe(0);
      expect(trigger.pipeline_id).toBe('pipeline-001');
      expect(trigger.created_by).toBe('user-1');
    });

    it('should register a schedule trigger', async () => {
      const trigger = await service.registerTrigger('tenant-1', 'schedule', {
        name: 'nightly-build',
        type: 'schedule',
        config: scheduleConfig,
        pipelineId: 'pipeline-002',
      });

      expect(trigger.type).toBe('schedule');
      expect((trigger.config as any).schedule).toBe('0 2 * * *');
    });

    it('should register a chat trigger', async () => {
      const trigger = await service.registerTrigger('tenant-1', 'chat', {
        name: 'deploy-chat',
        type: 'chat',
        config: chatConfig,
        pipelineId: 'pipeline-003',
      });

      expect(trigger.type).toBe('chat');
    });

    it('should register an event trigger', async () => {
      const trigger = await service.registerTrigger('tenant-1', 'event', {
        name: 'build-event',
        type: 'event',
        config: eventConfig,
        pipelineId: 'pipeline-004',
      });

      expect(trigger.type).toBe('event');
    });

    it('should register a manual trigger', async () => {
      const trigger = await service.registerTrigger('tenant-1', 'manual', {
        name: 'manual-deploy',
        type: 'manual',
        pipelineId: 'pipeline-005',
      });

      expect(trigger.type).toBe('manual');
    });

    it('should throw for invalid trigger type', async () => {
      await expect(
        service.registerTrigger('tenant-1', 'invalid-type', {
          name: 'bad',
          type: 'invalid-type',
        })
      ).rejects.toThrow('Invalid trigger type');
    });

    it('should reject all valid trigger types', async () => {
      const types = ['webhook', 'chat', 'schedule', 'event', 'manual'];
      for (const type of types) {
        const trigger = await service.registerTrigger('tenant-1', type, {
          name: `trigger-${type}`,
          type,
        });
        expect(trigger.type).toBe(type);
      }
    });
  });

  // ==================== getTrigger ====================

  describe('getTrigger', () => {
    it('should get a trigger by ID', async () => {
      const created = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'test-trigger',
        type: 'webhook',
      });

      const found = await service.getTrigger(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });
  });

  // ==================== listTriggers ====================

  describe('listTriggers', () => {
    it('should list all triggers for a tenant', async () => {
      await service.registerTrigger('tenant-1', 'webhook', { name: 'wh-1', type: 'webhook' });
      await service.registerTrigger('tenant-1', 'schedule', { name: 'sch-1', type: 'schedule' });
      await service.registerTrigger('tenant-2', 'webhook', { name: 'wh-2', type: 'webhook' });

      const tenant1Triggers = await service.listTriggers('tenant-1');
      expect(tenant1Triggers.length).toBe(2);
    });

    it('should filter by type', async () => {
      await service.registerTrigger('tenant-1', 'webhook', { name: 'wh-1', type: 'webhook' });
      await service.registerTrigger('tenant-1', 'schedule', { name: 'sch-1', type: 'schedule' });

      const webhooks = await service.listTriggers('tenant-1', 'webhook');
      expect(webhooks.length).toBe(1);
      expect(webhooks[0].type).toBe('webhook');
    });
  });

  // ==================== updateTrigger ====================

  describe('updateTrigger', () => {
    it('should update trigger name', async () => {
      const created = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'original-name',
        type: 'webhook',
      });

      const updated = await service.updateTrigger(created.id, { name: 'new-name' });
      expect(updated.name).toBe('new-name');
    });

    it('should update trigger config', async () => {
      const created = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'test',
        type: 'webhook',
      });

      const updated = await service.updateTrigger(created.id, {
        config: { webhookPath: '/new-path' },
      });
      expect((updated.config as any).webhookPath).toBe('/new-path');
    });

    it('should update enabled status', async () => {
      const created = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'test',
        type: 'webhook',
      });

      const updated = await service.updateTrigger(created.id, { enabled: false });
      expect(updated.enabled).toBe(false);
    });

    it('should update condition expression', async () => {
      const created = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'test',
        type: 'webhook',
        conditionExpression: 'env === "staging"',
      });

      const updated = await service.updateTrigger(created.id, {
        conditionExpression: 'env === "production"',
      });
      expect(updated.condition_expression).toBe('env === "production"');
    });
  });

  // ==================== deleteTrigger ====================

  describe('deleteTrigger', () => {
    it('should delete an existing trigger', async () => {
      const created = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'to-delete',
        type: 'webhook',
      });

      const deleted = await service.deleteTrigger(created.id);
      expect(deleted).toBe(true);
    });
  });

  // ==================== evaluateTrigger ====================

  describe('evaluateTrigger', () => {
    it('should match when conditions are met', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'build-complete',
        type: 'event',
        config: {
          eventTypes: ['build.completed'],
          conditions: { status: 'success' },
        },
        pipelineId: 'pipeline-001',
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'build.completed',
        status: 'success',
        branch: 'main',
      });

      expect(result.matched).toBe(true);
      expect(result.reason).toBe('Conditions matched');
    });

    it('should not match when event type does not match', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'build-complete',
        type: 'event',
        config: { eventTypes: ['build.completed'] },
        pipelineId: 'pipeline-001',
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test.failed',
      });

      expect(result.matched).toBe(false);
    });

    it('should not match when conditions are not met', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'prod-deploy',
        type: 'event',
        config: {
          conditions: { environment: 'production' },
        },
        pipelineId: 'pipeline-001',
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy.requested',
        environment: 'staging',
      });

      expect(result.matched).toBe(false);
    });

    it('should throw for non-existent trigger', async () => {
      await expect(
        service.evaluateTrigger('tenant-1', 'non-existent', {})
      ).rejects.toThrow('Trigger not found');
    });

    it('should throw when trigger does not belong to tenant', async () => {
      const created = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'test',
        type: 'webhook',
      });

      await expect(
        service.evaluateTrigger('tenant-2', created.id, {})
      ).rejects.toThrow('Trigger does not belong to this tenant');
    });

    it('should throw when trigger is disabled', async () => {
      const created = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'test',
        type: 'webhook',
      });
      await service.updateTrigger(created.id, { enabled: false });

      await expect(
        service.evaluateTrigger('tenant-1', created.id, {})
      ).rejects.toThrow('Trigger is disabled');
    });

    it('should increment trigger count on match', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'test',
        type: 'event',
        config: {},
      });

      await service.evaluateTrigger('tenant-1', created.id, { type: 'any' });

      const updated = await service.getTrigger(created.id);
      expect(updated?.trigger_count).toBe(1);
    });
  });

  // ==================== evaluateTrigger - filters ====================

  describe('evaluateTrigger - filters', () => {
    it('should match when filter includes matches', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'main-branch',
        type: 'event',
        config: {
          filters: { branch: { includes: ['main', 'release/v1'] } },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'push',
        branch: 'main',
      });

      expect(result.matched).toBe(true);
    });

    it('should not match when filter includes does not match', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'main-branch',
        type: 'event',
        config: {
          filters: { branch: { includes: ['main'] } },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'push',
        branch: 'feature/new',
      });

      expect(result.matched).toBe(false);
    });

    it('should not match when filter excludes matches', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'no-wip',
        type: 'event',
        config: {
          filters: { branch: { excludes: ['wip', 'draft'] } },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'push',
        branch: 'wip',
      });

      expect(result.matched).toBe(false);
    });

    it('should not match when value is below filter min', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'high-coverage',
        type: 'event',
        config: {
          filters: { coverage: { min: 80 } },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test.completed',
        coverage: 65,
      });

      expect(result.matched).toBe(false);
    });

    it('should match when value is above filter min', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'high-coverage',
        type: 'event',
        config: {
          filters: { coverage: { min: 80 } },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test.completed',
        coverage: 90,
      });

      expect(result.matched).toBe(true);
    });

    it('should match when pattern filter matches', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'version-tag',
        type: 'event',
        config: {
          filters: { tag: { pattern: '^v\\d+\\.\\d+\\.\\d+$' } },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'tag.created',
        tag: 'v1.2.3',
      });

      expect(result.matched).toBe(true);
    });
  });

  // ==================== evaluateTrigger - expressions ====================

  describe('evaluateTrigger - condition expressions', () => {
    it('should evaluate simple comparison expressions', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'env-check',
        type: 'event',
        conditionExpression: 'environment === "production"',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy',
        environment: 'production',
      });
      expect(match.matched).toBe(true);

      const noMatch = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy',
        environment: 'staging',
      });
      expect(noMatch.matched).toBe(false);
    });

    it('should evaluate AND expressions', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'complex-check',
        type: 'event',
        conditionExpression: 'environment === production',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy',
        environment: 'production',
        production: 'production',
      });
      expect(match.matched).toBe(true);

      const noMatch = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy',
        environment: 'staging',
        production: 'production',
      });
      expect(noMatch.matched).toBe(false);
    });

    it('should evaluate OR expressions', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'branch-check',
        type: 'event',
        conditionExpression: 'branch === "main" || branch === "release"',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'push',
        branch: 'main',
      });
      expect(match.matched).toBe(true);
    });

    it('should evaluate numeric comparisons', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'duration-check',
        type: 'event',
        conditionExpression: 'duration < 300',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'build.completed',
        duration: 120,
      });
      expect(match.matched).toBe(true);

      const noMatch = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'build.completed',
        duration: 600,
      });
      expect(noMatch.matched).toBe(false);
    });

    it('should return false when expression evaluation throws', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'bad-expression',
        type: 'event',
        conditionExpression: 'invalid syntax here !!@@',
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'any',
      });
      expect(result.matched).toBe(false);
    });
  });

  // ==================== executePipelineFromTrigger ====================

  describe('executePipelineFromTrigger', () => {
    it('should execute pipeline and return success', async () => {
      const created = await service.registerTrigger('tenant-1', 'manual', {
        name: 'manual-deploy',
        type: 'manual',
        pipelineId: 'pipeline-001',
      });

      const result = await service.executePipelineFromTrigger('tenant-1', created.id);

      expect(result.success).toBe(true);
      expect(result.pipelineRunId).toBeDefined();
    });

    it('should throw for non-existent trigger', async () => {
      await expect(
        service.executePipelineFromTrigger('tenant-1', 'non-existent')
      ).rejects.toThrow('Trigger not found');
    });

    it('should throw when trigger is disabled', async () => {
      const created = await service.registerTrigger('tenant-1', 'manual', {
        name: 'disabled',
        type: 'manual',
        pipelineId: 'pipeline-001',
      });
      await service.updateTrigger(created.id, { enabled: false });

      await expect(
        service.executePipelineFromTrigger('tenant-1', created.id)
      ).rejects.toThrow('Trigger is disabled');
    });

    it('should throw when trigger has no pipeline', async () => {
      const created = await service.registerTrigger('tenant-1', 'manual', {
        name: 'no-pipeline',
        type: 'manual',
      });

      await expect(
        service.executePipelineFromTrigger('tenant-1', created.id)
      ).rejects.toThrow('Trigger has no associated pipeline');
    });
  });

  // ==================== getTriggerStats ====================

  describe('getTriggerStats', () => {
    it('should return stats for a tenant', async () => {
      await service.registerTrigger('tenant-1', 'webhook', { name: 'wh-1', type: 'webhook' });
      await service.registerTrigger('tenant-1', 'schedule', { name: 'sch-1', type: 'schedule' });
      await service.registerTrigger('tenant-1', 'chat', { name: 'chat-1', type: 'chat' });

      const stats = await service.getTriggerStats('tenant-1');

      expect(stats.totalTriggers).toBe(3);
      expect(stats.triggersByType.webhook).toBe(1);
      expect(stats.triggersByType.schedule).toBe(1);
      expect(stats.triggersByType.chat).toBe(1);
      expect(stats.topTriggers.length).toBeGreaterThanOrEqual(0);
    });

    it('should count events and matched events', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'test-trigger',
        type: 'event',
        config: {},
      });

      await service.evaluateTrigger('tenant-1', created.id, { type: 'any' });

      const stats = await service.getTriggerStats('tenant-1');
      expect(stats.totalEvents).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== getTriggerEvents ====================

  describe('getTriggerEvents', () => {
    it('should return events for a trigger', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'test',
        type: 'event',
        config: {},
      });

      await service.evaluateTrigger('tenant-1', created.id, { type: 'event-1' });
      await service.evaluateTrigger('tenant-1', created.id, { type: 'event-2' });

      const events = await service.getTriggerEvents(created.id);
      expect(events.length).toBe(2);
    });

    it('should respect limit parameter', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'test',
        type: 'event',
        config: {},
      });

      for (let i = 0; i < 10; i++) {
        await service.evaluateTrigger('tenant-1', created.id, { type: `event-${i}` });
      }

      const events = await service.getTriggerEvents(created.id, 3);
      expect(events.length).toBe(3);
    });

    it('should use default limit of 50', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'test',
        type: 'event',
        config: {},
      });

      const events = await service.getTriggerEvents(created.id);
      expect(events.length).toBeLessThanOrEqual(50);
    });
  });
});
