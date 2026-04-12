/**
 * DeploymentEventPublisher 单元测试
 */

import { DeploymentEventPublisher } from '../DeploymentEventPublisher';

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

describe('DeploymentEventPublisher', () => {
  let publisher: DeploymentEventPublisher;
  let mockEventBus: MockEventBus;

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    publisher = new DeploymentEventPublisher({
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
      await publisher.publishDeploymentStarted({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.specversion).toBe('1.0');
      expect(event.data.id).toBeDefined();
      expect(event.data.type).toBe('deployment.started');
      expect(event.data.source).toBe('orion-platform-service');
      expect(event.data.time).toBeDefined();
      expect(event.data.data).toBeDefined();
    });

    it('发布的事件应包含扩展属性', async () => {
      await publisher.publishDeploymentStarted(
        {
          deploymentId: 'deploy-001',
          service: 'api-gateway',
          environment: 'production',
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
      await publisher.publishDeploymentStarted({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.tenantId).toBe('tenant-001');
      expect(event.data.userId).toBe('user-001');
      expect(event.data.traceId).toBeDefined();
    });
  });

  describe('Deployment 事件', () => {
    it('发布 deployment.started 事件', async () => {
      await publisher.publishDeploymentStarted({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
        version: 'v1.2.3',
        deployedBy: 'user-001',
        strategy: 'blue-green',
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('deployment.started');
      expect(event.data.data.deploymentId).toBe('deploy-001');
      expect(event.data.data.service).toBe('api-gateway');
      expect(event.data.data.environment).toBe('production');
      expect(event.data.data.version).toBe('v1.2.3');
      expect(event.data.data.deployedBy).toBe('user-001');
      expect(event.data.data.strategy).toBe('blue-green');
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 deployment.completed 事件', async () => {
      await publisher.publishDeploymentCompleted({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
        status: 'success',
        version: 'v1.2.3',
        durationMs: 120000,
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('deployment.completed');
      expect(event.data.data.deploymentId).toBe('deploy-001');
      expect(event.data.data.service).toBe('api-gateway');
      expect(event.data.data.environment).toBe('production');
      expect(event.data.data.status).toBe('success');
      expect(event.data.data.durationMs).toBe(120000);
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 deployment.failed 事件', async () => {
      await publisher.publishDeploymentFailed({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'staging',
        error: 'Container failed to start',
        phase: 'deployment',
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('deployment.failed');
      expect(event.data.data.deploymentId).toBe('deploy-001');
      expect(event.data.data.service).toBe('api-gateway');
      expect(event.data.data.environment).toBe('staging');
      expect(event.data.data.error).toBe('Container failed to start');
      expect(event.data.data.phase).toBe('deployment');
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 deployment.cancelled 事件', async () => {
      await publisher.publishDeploymentCancelled({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
        cancelledBy: 'user-001',
        reason: 'Rollback required',
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('deployment.cancelled');
      expect(event.data.data.deploymentId).toBe('deploy-001');
      expect(event.data.data.service).toBe('api-gateway');
      expect(event.data.data.environment).toBe('production');
      expect(event.data.data.cancelledBy).toBe('user-001');
      expect(event.data.data.reason).toBe('Rollback required');
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 deployment.rolledback 事件', async () => {
      await publisher.publishDeploymentRolledback({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
        rollbackToVersion: 'v1.2.2',
        reason: 'Critical bug detected',
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('deployment.rolledback');
      expect(event.data.data.deploymentId).toBe('deploy-001');
      expect(event.data.data.service).toBe('api-gateway');
      expect(event.data.data.environment).toBe('production');
      expect(event.data.data.rollbackToVersion).toBe('v1.2.2');
      expect(event.data.data.reason).toBe('Critical bug detected');
      expect(event.data.data.timestamp).toBeDefined();
    });
  });

  describe('事件数据类型验证', () => {
    it('Deployment Started 事件应包含所有必需字段', async () => {
      await publisher.publishDeploymentStarted({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data).toHaveProperty('deploymentId');
      expect(event.data.data).toHaveProperty('service');
      expect(event.data.data).toHaveProperty('environment');
      expect(event.data.data).toHaveProperty('timestamp');
    });

    it('Deployment Completed 事件应包含所有必需字段', async () => {
      await publisher.publishDeploymentCompleted({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
        status: 'success',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data).toHaveProperty('deploymentId');
      expect(event.data.data).toHaveProperty('service');
      expect(event.data.data).toHaveProperty('environment');
      expect(event.data.data).toHaveProperty('status');
      expect(event.data.data).toHaveProperty('timestamp');
    });
  });

  describe('无 EventBus 时的行为', () => {
    it('EventBus 未连接时应优雅降级', async () => {
      const publisherWithoutBus = new DeploymentEventPublisher();

      // 不应抛出错误
      await expect(
        publisherWithoutBus.publishDeploymentStarted({
          deploymentId: 'deploy-001',
          service: 'api-gateway',
          environment: 'production',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('setEventBus 和 getEventBus', () => {
    it('应该能够动态设置和获取 EventBus', () => {
      const newPublisher = new DeploymentEventPublisher();
      expect(newPublisher.getEventBus()).toBeNull();

      newPublisher.setEventBus(mockEventBus);
      expect(newPublisher.getEventBus()).toBe(mockEventBus);
    });
  });
});