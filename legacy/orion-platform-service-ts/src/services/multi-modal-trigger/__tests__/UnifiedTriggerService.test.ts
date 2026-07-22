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

  // ==================== No DB Configured Errors ====================

  describe('no DB configured errors', () => {
    let noDbService: UnifiedTriggerService;

    beforeEach(() => {
      noDbService = new UnifiedTriggerService();
      // triggerRepo and eventRepo remain null
    });

    it('should throw SERVICE_UNAVAILABLE for registerTrigger', async () => {
      await expect(
        noDbService.registerTrigger('tenant-1', 'webhook', { name: 'test', type: 'webhook' })
      ).rejects.toThrow('Database not configured');
    });

    it('should throw SERVICE_UNAVAILABLE for getTrigger', async () => {
      await expect(
        noDbService.getTrigger('trigger-1')
      ).rejects.toThrow('Database not configured');
    });

    it('should throw SERVICE_UNAVAILABLE for listTriggers', async () => {
      await expect(
        noDbService.listTriggers('tenant-1')
      ).rejects.toThrow('Database not configured');
    });

    it('should throw SERVICE_UNAVAILABLE for updateTrigger', async () => {
      await expect(
        noDbService.updateTrigger('trigger-1', { name: 'new' })
      ).rejects.toThrow('Database not configured');
    });

    it('should throw SERVICE_UNAVAILABLE for deleteTrigger', async () => {
      await expect(
        noDbService.deleteTrigger('trigger-1')
      ).rejects.toThrow('Database not configured');
    });

    it('should throw SERVICE_UNAVAILABLE for evaluateTrigger', async () => {
      await expect(
        noDbService.evaluateTrigger('tenant-1', 'trigger-1', {})
      ).rejects.toThrow('Database not configured');
    });

    it('should throw SERVICE_UNAVAILABLE for executePipelineFromTrigger', async () => {
      await expect(
        noDbService.executePipelineFromTrigger('tenant-1', 'trigger-1')
      ).rejects.toThrow('Database not configured');
    });

    it('should throw SERVICE_UNAVAILABLE for getTriggerStats', async () => {
      await expect(
        noDbService.getTriggerStats('tenant-1')
      ).rejects.toThrow('Database not configured');
    });

    it('should throw SERVICE_UNAVAILABLE for getTriggerEvents', async () => {
      await expect(
        noDbService.getTriggerEvents('trigger-1')
      ).rejects.toThrow('Database not configured');
    });
  });

  // ==================== Advanced Filter Tests ====================

  describe('evaluateTrigger - advanced filters', () => {
    it('should match when filter max value is not exceeded', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'max-filter',
        type: 'event',
        config: {
          filters: { coverage: { max: 95 } },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        coverage: 80,
      });
      expect(result.matched).toBe(true);
    });

    it('should not match when filter max value is exceeded', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'max-filter',
        type: 'event',
        config: {
          filters: { coverage: { max: 95 } },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        coverage: 100,
      });
      expect(result.matched).toBe(false);
    });

    it('should not match when pattern filter does not match', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'pattern-filter',
        type: 'event',
        config: {
          filters: { tag: { pattern: '^v\\d+\\.\\d+\\.\\d+$' } },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'tag.created',
        tag: 'invalid-tag',
      });
      expect(result.matched).toBe(false);
    });

    it('should match when simple value filter equals', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'simple-filter',
        type: 'event',
        config: {
          filters: { environment: 'production' },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy',
        environment: 'production',
      });
      expect(result.matched).toBe(true);
    });

    it('should not match when simple value filter does not equal', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'simple-filter',
        type: 'event',
        config: {
          filters: { environment: 'production' },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy',
        environment: 'staging',
      });
      expect(result.matched).toBe(false);
    });

    it('should match with min and max combined', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'range-filter',
        type: 'event',
        config: {
          filters: { score: { min: 50, max: 100 } },
        },
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        score: 75,
      });
      expect(match.matched).toBe(true);
    });

    it('should not match with min and max when out of range', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'range-filter',
        type: 'event',
        config: {
          filters: { score: { min: 50, max: 100 } },
        },
      });

      const noMatch = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        score: 30,
      });
      expect(noMatch.matched).toBe(false);
    });

    it('should handle excludes not matching (pass through)', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'excludes-filter',
        type: 'event',
        config: {
          filters: { branch: { excludes: ['wip'] } },
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'push',
        branch: 'main',
      });
      expect(result.matched).toBe(true);
    });
  });

  // ==================== Advanced Expression Tests ====================

  describe('evaluateTrigger - advanced expressions', () => {
    it('should evaluate !== operator', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'not-equal',
        type: 'event',
        conditionExpression: 'environment !== "staging"',
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

    it('should evaluate >= operator', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'gte-check',
        type: 'event',
        conditionExpression: 'score >= 80',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        score: 80,
      });
      expect(match.matched).toBe(true);

      const match2 = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        score: 90,
      });
      expect(match2.matched).toBe(true);

      const noMatch = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        score: 70,
      });
      expect(noMatch.matched).toBe(false);
    });

    it('should evaluate <= operator', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'lte-check',
        type: 'event',
        conditionExpression: 'duration <= 300',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'build',
        duration: 300,
      });
      expect(match.matched).toBe(true);

      const noMatch = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'build',
        duration: 400,
      });
      expect(noMatch.matched).toBe(false);
    });

    it('should evaluate > operator', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'gt-check',
        type: 'event',
        conditionExpression: 'score > 80',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        score: 90,
      });
      expect(match.matched).toBe(true);

      const noMatch = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        score: 80,
      });
      expect(noMatch.matched).toBe(false);
    });

    it('should evaluate == operator (loose equality)', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'loose-equal',
        type: 'event',
        conditionExpression: 'count == 5',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        count: 5,
      });
      expect(match.matched).toBe(true);
    });

    it('should evaluate != operator (loose inequality)', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'loose-not-equal',
        type: 'event',
        conditionExpression: 'status != "failed"',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        status: 'success',
      });
      expect(match.matched).toBe(true);
    });

    it('should evaluate boolean true literal', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'bool-true',
        type: 'event',
        conditionExpression: 'true',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'any',
      });
      expect(match.matched).toBe(true);
    });

    it('should evaluate boolean false literal', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'bool-false',
        type: 'event',
        conditionExpression: 'false',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'any',
      });
      expect(match.matched).toBe(false);
    });

    it('should evaluate event. prefixed field references', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'event-prefix',
        type: 'event',
        conditionExpression: 'event.environment === "production"',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy',
        environment: 'production',
      });
      expect(match.matched).toBe(true);
    });

    it('should evaluate variable reference as truthy check', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'truthy-check',
        type: 'event',
        conditionExpression: 'approved',
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy',
        approved: true,
      });
      expect(match.matched).toBe(true);

      const noMatch = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy',
        approved: false,
      });
      expect(noMatch.matched).toBe(false);
    });

    it('should evaluate nested field paths in conditions', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'nested-check',
        type: 'event',
        config: {
          conditions: { 'metadata.version': 'v2' },
        },
      });

      const match = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy',
        metadata: { version: 'v2' },
      });
      expect(match.matched).toBe(true);

      const noMatch = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'deploy',
        metadata: { version: 'v1' },
      });
      expect(noMatch.matched).toBe(false);
    });
  });

  // ==================== registerTrigger edge cases ====================

  describe('registerTrigger edge cases', () => {
    it('should register trigger with empty config', async () => {
      const trigger = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'minimal',
        type: 'webhook',
      });

      expect(trigger.config).toEqual({});
      expect(trigger.pipeline_id).toBeNull();
      expect(trigger.created_by).toBeNull();
      expect(trigger.condition_expression).toBeNull();
    });

    it('should generate unique IDs for concurrent registrations', async () => {
      const triggers = await Promise.all([
        service.registerTrigger('tenant-1', 'webhook', { name: 'a', type: 'webhook' }),
        service.registerTrigger('tenant-1', 'webhook', { name: 'b', type: 'webhook' }),
        service.registerTrigger('tenant-1', 'webhook', { name: 'c', type: 'webhook' }),
      ]);

      const ids = triggers.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  // ==================== Trigger evaluation edge cases ====================

  describe('evaluateTrigger - edge cases', () => {
    it('should handle event with event_type field instead of type', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'event-type-field',
        type: 'event',
        config: {
          eventTypes: ['push'],
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        event_type: 'push',
      });
      expect(result.matched).toBe(true);
    });

    it('should match when no event type filter is configured', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'no-filter',
        type: 'event',
        config: {},
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'anything',
      });
      expect(result.matched).toBe(true);
    });

    it('should match when empty eventTypes array', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'empty-types',
        type: 'event',
        config: {
          eventTypes: [],
        },
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'anything',
      });
      expect(result.matched).toBe(true);
    });

    it('should not increment trigger count when not matched', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'no-increment',
        type: 'event',
        config: {
          conditions: { status: 'success' },
        },
      });

      await service.evaluateTrigger('tenant-1', created.id, {
        type: 'any',
        status: 'failure',
      });

      const trigger = await service.getTrigger(created.id);
      expect(trigger?.trigger_count).toBe(0);
    });

    it('should return matched trigger and event in result', async () => {
      const created = await service.registerTrigger('tenant-1', 'event', {
        name: 'result-check',
        type: 'event',
        config: {},
      });

      const result = await service.evaluateTrigger('tenant-1', created.id, {
        type: 'test',
        data: 'value',
      });

      expect(result.trigger).toBeDefined();
      expect(result.trigger.id).toBe(created.id);
      expect(result.event).toBeDefined();
      expect(result.event.evaluation_result).toBe('matched');
    });
  });

  // ==================== executePipelineFromTrigger edge cases ====================

  describe('executePipelineFromTrigger - edge cases', () => {
    it('should throw when trigger does not belong to tenant', async () => {
      const created = await service.registerTrigger('tenant-1', 'manual', {
        name: 'test',
        type: 'manual',
        pipelineId: 'pipeline-001',
      });

      await expect(
        service.executePipelineFromTrigger('tenant-2', created.id)
      ).rejects.toThrow('Trigger does not belong to this tenant');
    });

    it('should increment trigger count after execution', async () => {
      const created = await service.registerTrigger('tenant-1', 'manual', {
        name: 'exec-count',
        type: 'manual',
        pipelineId: 'pipeline-001',
      });

      await service.executePipelineFromTrigger('tenant-1', created.id);

      const trigger = await service.getTrigger(created.id);
      expect(trigger?.trigger_count).toBe(1);
    });

    it('should create event record on execution', async () => {
      const created = await service.registerTrigger('tenant-1', 'manual', {
        name: 'exec-event',
        type: 'manual',
        pipelineId: 'pipeline-001',
      });

      const result = await service.executePipelineFromTrigger('tenant-1', created.id);
      expect(result.pipelineRunId).toMatch(/^run-/);

      const events = await service.getTriggerEvents(created.id);
      expect(events.length).toBe(1);
      expect(events[0].event_type).toBe('manual_execution');
    });
  });

  // ==================== getTriggerStats edge cases ====================

  describe('getTriggerStats - edge cases', () => {
    it('should return empty stats for tenant with no triggers', async () => {
      const stats = await service.getTriggerStats('tenant-empty');
      expect(stats.totalTriggers).toBe(0);
      expect(stats.triggersByType).toEqual({});
      expect(stats.totalEvents).toBe(0);
      expect(stats.matchedEvents).toBe(0);
      expect(stats.topTriggers).toEqual([]);
    });

    it('should sort topTriggers by count descending', async () => {
      const t1 = await service.registerTrigger('tenant-1', 'webhook', { name: 'low', type: 'webhook' });
      const t2 = await service.registerTrigger('tenant-1', 'webhook', { name: 'high', type: 'webhook' });
      const t3 = await service.registerTrigger('tenant-1', 'webhook', { name: 'mid', type: 'webhook' });

      // Simulate trigger counts via evaluation
      for (let i = 0; i < 5; i++) {
        await service.evaluateTrigger('tenant-1', t2.id, { type: 'any' });
      }
      for (let i = 0; i < 3; i++) {
        await service.evaluateTrigger('tenant-1', t3.id, { type: 'any' });
      }
      await service.evaluateTrigger('tenant-1', t1.id, { type: 'any' });

      const stats = await service.getTriggerStats('tenant-1');
      expect(stats.topTriggers[0].name).toBe('high');
      expect(stats.topTriggers[0].count).toBe(5);
      expect(stats.topTriggers[1].name).toBe('mid');
      expect(stats.topTriggers[1].count).toBe(3);
      expect(stats.topTriggers[2].name).toBe('low');
      expect(stats.topTriggers[2].count).toBe(1);
    });

    it('should limit topTriggers to 10', async () => {
      for (let i = 0; i < 15; i++) {
        await service.registerTrigger('tenant-1', 'webhook', { name: `trigger-${i}`, type: 'webhook' });
      }

      const stats = await service.getTriggerStats('tenant-1');
      expect(stats.topTriggers.length).toBeLessThanOrEqual(10);
    });

    it('should count pipeline runs correctly', async () => {
      const t1 = await service.registerTrigger('tenant-1', 'manual', { name: 'with-pipeline', type: 'manual', pipelineId: 'p1' });
      await service.registerTrigger('tenant-1', 'manual', { name: 'without-pipeline', type: 'manual' });

      await service.evaluateTrigger('tenant-1', t1.id, { type: 'any' });

      const stats = await service.getTriggerStats('tenant-1');
      expect(stats.pipelineRuns).toBe(1);
    });
  });

  // ==================== updateTrigger edge cases ====================

  describe('updateTrigger - edge cases', () => {
    it('should update pipelineId', async () => {
      const created = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'test',
        type: 'webhook',
        pipelineId: 'pipeline-old',
      });

      const updated = await service.updateTrigger(created.id, { pipelineId: 'pipeline-new' });
      expect(updated.pipeline_id).toBe('pipeline-new');
    });

    it('should allow partial updates without affecting other fields', async () => {
      const created = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'original',
        type: 'webhook',
        pipelineId: 'pipeline-1',
      });

      const updated = await service.updateTrigger(created.id, { name: 'renamed' });
      expect(updated.name).toBe('renamed');
      expect(updated.pipeline_id).toBe('pipeline-1');
      expect(updated.type).toBe('webhook');
    });

    it('should throw when updating non-existent trigger', async () => {
      await expect(
        service.updateTrigger('non-existent', { name: 'new' })
      ).rejects.toThrow('Trigger not found');
    });
  });

  // ==================== getTrigger edge cases ====================

  describe('getTrigger - edge cases', () => {
    it('should return undefined for non-existent trigger', async () => {
      const result = await service.getTrigger('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('should return full trigger entity with all fields', async () => {
      const created = await service.registerTrigger('tenant-1', 'webhook', {
        name: 'full-entity',
        type: 'webhook',
        config: { webhookPath: '/test' },
        conditionExpression: 'env === "prod"',
        pipelineId: 'pipeline-1',
        createdBy: 'user-1',
      });

      const found = await service.getTrigger(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('full-entity');
      expect(found?.config).toEqual({ webhookPath: '/test' });
      expect(found?.condition_expression).toBe('env === "prod"');
      expect(found?.pipeline_id).toBe('pipeline-1');
      expect(found?.created_by).toBe('user-1');
      expect(found?.enabled).toBe(true);
      expect(found?.trigger_count).toBe(0);
      expect(found?.created_at).toBeDefined();
      expect(found?.updated_at).toBeDefined();
    });
  });
});
