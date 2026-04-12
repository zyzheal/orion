/**
 * ConfigEventPublisher 单元测试
 */

import { ConfigEventPublisher } from '../ConfigEventPublisher';

// 模拟 EventBus
class MockEventBus {
  public publishedEvents: any[] = [];

  async publish(subject: string, data: any, options?: any): Promise<string> {
    const event = {
      specversion: '1.0',
      id: `event-${Date.now()}`,
      type: subject,
      source: 'orion-platform-service',
      time: new Date().toISOString(),
      data: data,
      ...options?.extensions,
    };
    this.publishedEvents.push({ subject, data: event, options });
    return 'mock-event-id';
  }

  isHealthy(): boolean {
    return true;
  }
}

describe('ConfigEventPublisher', () => {
  let publisher: ConfigEventPublisher;
  let mockEventBus: MockEventBus;

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    publisher = new ConfigEventPublisher({
      eventBus: mockEventBus,
      source: 'orion-platform-service',
      defaultTenantId: 'tenant-001',
      defaultUserId: 'user-001',
    });
  });

  afterEach(() => {
    mockEventBus.publishedEvents = [];
  });

  describe('CloudEvents 1.0 合规性', () => {
    it('发布的事件应包含所有必需字段', async () => {
      await publisher.publishDriftDetected({
        configId: 'config-001',
        resourceType: 'kubernetes.deployment',
        expected: { replicas: 3 },
        actual: { replicas: 2 },
        driftType: 'modified',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.specversion).toBe('1.0');
      expect(event.data.id).toBeDefined();
      expect(event.data.type).toBe('config.drift.detected');
      expect(event.data.source).toBe('orion-platform-service');
      expect(event.data.time).toBeDefined();
      expect(event.data.data).toBeDefined();
    });

    it('发布的事件应包含扩展属性', async () => {
      await publisher.publishDriftDetected(
        {
          configId: 'config-001',
          resourceType: 'kubernetes.deployment',
          expected: { replicas: 3 },
          actual: { replicas: 2 },
          driftType: 'modified',
        },
        {
          tenantId: 'tenant-001',
          userId: 'user-001',
          traceId: 'trace-abc',
        }
      );

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.tenantId).toBe('tenant-001');
      expect(event.data.userId).toBe('user-001');
      expect(event.data.traceId).toBe('trace-abc');
    });

    it('应使用默认的租户和用户 ID', async () => {
      await publisher.publishDriftDetected({
        configId: 'config-001',
        resourceType: 'kubernetes.deployment',
        expected: { replicas: 3 },
        actual: { replicas: 2 },
        driftType: 'modified',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.tenantId).toBe('tenant-001');
      expect(event.data.userId).toBe('user-001');
      expect(event.data.traceId).toBeDefined();
    });
  });

  describe('Config 事件', () => {
    it('发布 config.drift.detected 事件', async () => {
      await publisher.publishDriftDetected({
        configId: 'config-001',
        configName: 'api-gateway-deployment',
        resourceType: 'kubernetes.deployment',
        resourceId: 'deployment/api-gateway',
        expected: { replicas: 3, image: 'api-gateway:v1.2.3' },
        actual: { replicas: 2, image: 'api-gateway:v1.2.3' },
        driftType: 'modified',
        severity: 'high',
        diff: { replicas: { expected: 3, actual: 2 } },
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('config.drift.detected');
      expect(event.data.data.configId).toBe('config-001');
      expect(event.data.data.configName).toBe('api-gateway-deployment');
      expect(event.data.data.resourceType).toBe('kubernetes.deployment');
      expect(event.data.data.resourceId).toBe('deployment/api-gateway');
      expect(event.data.data.expected).toEqual({ replicas: 3, image: 'api-gateway:v1.2.3' });
      expect(event.data.data.actual).toEqual({ replicas: 2, image: 'api-gateway:v1.2.3' });
      expect(event.data.data.driftType).toBe('modified');
      expect(event.data.data.severity).toBe('high');
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 config.drift.resolved 事件', async () => {
      await publisher.publishDriftResolved({
        configId: 'config-001',
        configName: 'api-gateway-deployment',
        resourceType: 'kubernetes.deployment',
        resolution: 'reconciled',
        resolvedBy: 'user-001',
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('config.drift.resolved');
      expect(event.data.data.configId).toBe('config-001');
      expect(event.data.data.configName).toBe('api-gateway-deployment');
      expect(event.data.data.resourceType).toBe('kubernetes.deployment');
      expect(event.data.data.resolution).toBe('reconciled');
      expect(event.data.data.resolvedBy).toBe('user-001');
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 config.change.applied 事件', async () => {
      await publisher.publishChangeApplied({
        configId: 'config-001',
        configName: 'api-gateway-config',
        changeType: 'update',
        changedBy: 'user-001',
        changes: { replicas: { from: 2, to: 3 } },
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('config.change.applied');
      expect(event.data.data.configId).toBe('config-001');
      expect(event.data.data.configName).toBe('api-gateway-config');
      expect(event.data.data.changeType).toBe('update');
      expect(event.data.data.changedBy).toBe('user-001');
      expect(event.data.data.changes).toEqual({ replicas: { from: 2, to: 3 } });
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 config.change.rejected 事件', async () => {
      await publisher.publishChangeRejected({
        configId: 'config-001',
        configName: 'api-gateway-config',
        reason: 'Validation failed',
        validationErrors: ['replicas must be at least 1', 'image tag cannot be empty'],
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('config.change.rejected');
      expect(event.data.data.configId).toBe('config-001');
      expect(event.data.data.configName).toBe('api-gateway-config');
      expect(event.data.data.reason).toBe('Validation failed');
      expect(event.data.data.validationErrors).toEqual(['replicas must be at least 1', 'image tag cannot be empty']);
      expect(event.data.data.timestamp).toBeDefined();
    });
  });

  describe('漂移类型测试', () => {
    it('支持 added 漂移类型', async () => {
      await publisher.publishDriftDetected({
        configId: 'config-001',
        resourceType: 'kubernetes.configmap',
        expected: {},
        actual: { newKey: 'newValue' },
        driftType: 'added',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data.driftType).toBe('added');
    });

    it('支持 removed 漂移类型', async () => {
      await publisher.publishDriftDetected({
        configId: 'config-001',
        resourceType: 'kubernetes.configmap',
        expected: { oldKey: 'oldValue' },
        actual: {},
        driftType: 'removed',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data.driftType).toBe('removed');
    });

    it('支持 modified 漂移类型', async () => {
      await publisher.publishDriftDetected({
        configId: 'config-001',
        resourceType: 'kubernetes.configmap',
        expected: { key: 'oldValue' },
        actual: { key: 'newValue' },
        driftType: 'modified',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data.driftType).toBe('modified');
    });
  });

  describe('事件数据类型验证', () => {
    it('Drift Detected 事件应包含所有必需字段', async () => {
      await publisher.publishDriftDetected({
        configId: 'config-001',
        resourceType: 'kubernetes.deployment',
        expected: { replicas: 3 },
        actual: { replicas: 2 },
        driftType: 'modified',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data).toHaveProperty('configId');
      expect(event.data.data).toHaveProperty('resourceType');
      expect(event.data.data).toHaveProperty('expected');
      expect(event.data.data).toHaveProperty('actual');
      expect(event.data.data).toHaveProperty('driftType');
      expect(event.data.data).toHaveProperty('timestamp');
    });
  });

  describe('无 EventBus 时的行为', () => {
    it('EventBus 未连接时应优雅降级', async () => {
      const publisherWithoutBus = new ConfigEventPublisher();

      // 不应抛出错误
      await expect(
        publisherWithoutBus.publishDriftDetected({
          configId: 'config-001',
          resourceType: 'kubernetes.deployment',
          expected: { replicas: 3 },
          actual: { replicas: 2 },
          driftType: 'modified',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('setEventBus 和 getEventBus', () => {
    it('应该能够动态设置和获取 EventBus', () => {
      const newPublisher = new ConfigEventPublisher();
      expect(newPublisher.getEventBus()).toBeNull();

      newPublisher.setEventBus(mockEventBus);
      expect(newPublisher.getEventBus()).toBe(mockEventBus);
    });
  });
});