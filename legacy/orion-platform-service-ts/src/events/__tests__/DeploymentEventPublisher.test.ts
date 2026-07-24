/**
 * DeploymentEventPublisher 单元测试
 */

import { DeploymentEventPublisher } from '../DeploymentEventPublisher';

// 模拟 EventBus - 与 EventBusAdapter 行为一致
class MockEventBus {
  public publishedEvents: any[] = [];

  async publish(subject: string, data: any, options?: any): Promise<string> {
    const eventId = `event-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    // 与 EventBusAdapter.createCloudEvent 一致
    const event = {
      specversion: '1.0',
      id: eventId,
      type: subject,
      source: options?.source || 'orion-platform-service',
      time: new Date().toISOString(),
      data: data,
      tenantid: options?.tenantId,
      userid: options?.publishedBy,
      traceid: options?.traceId ?? eventId,
    };
    this.publishedEvents.push({ subject, data: event, options });
    return eventId;
  }

  isHealthy(): boolean {
    return true;
  }

  isJetStreamAvailable(): boolean {
    return true;
  }

  getConnectionStatus(): { state: string } {
    return { state: 'connected' };
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
      expect(event.data.type).toBe('deploy.started');
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
      // CloudEvents 扩展属性使用小写
      expect(event.data.tenantid).toBe('tenant-001');
      expect(event.data.userid).toBe('user-001');
      expect(event.data.traceid).toBe('trace-abc');
    });

    it('应使用默认的租户和用户 ID', async () => {
      await publisher.publishDeploymentStarted({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.tenantid).toBe('tenant-001');
      expect(event.data.userid).toBe('user-001');
      expect(event.data.traceid).toBeDefined();
    });
  });

  describe('Deployment Started 事件', () => {
    it('发布 deploy.started 事件', async () => {
      await publisher.publishDeploymentStarted({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
        version: 'v1.0.0',
        deployedBy: 'user-001',
        strategy: 'rolling',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('deploy.started');
      expect(event.data.data.deploymentId).toBe('deploy-001');
      expect(event.data.data.service).toBe('api-gateway');
      expect(event.data.data.environment).toBe('production');
      expect(event.data.data.version).toBe('v1.0.0');
      expect(event.data.data.deployedBy).toBe('user-001');
      expect(event.data.data.strategy).toBe('rolling');
      expect(event.data.data.timestamp).toBeDefined();
    });
  });

  describe('Deployment Completed 事件', () => {
    it('发布 deploy.finished 事件', async () => {
      await publisher.publishDeploymentCompleted({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
        version: 'v1.0.0',
        status: 'success',
        durationMs: 120000,
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('deploy.finished');
      expect(event.data.data.deploymentId).toBe('deploy-001');
      expect(event.data.data.status).toBe('success');
      expect(event.data.data.durationMs).toBe(120000);
    });
  });

  describe('Deployment Failed 事件', () => {
    it('发布 deploy.failed 事件', async () => {
      await publisher.publishDeploymentFailed({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
        error: 'Health check failed',
        rollbackInitiated: true,
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('deploy.failed');
      expect(event.data.data.deploymentId).toBe('deploy-001');
      expect(event.data.data.error).toBe('Health check failed');
      expect(event.data.data.rollbackInitiated).toBe(true);
    });
  });

  describe('Deployment Cancelled 事件', () => {
    it('发布 deploy.cancelled 事件', async () => {
      await publisher.publishDeploymentCancelled({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
        cancelledBy: 'user-001',
        reason: 'Emergency stop',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('deploy.cancelled');
      expect(event.data.data.deploymentId).toBe('deploy-001');
      expect(event.data.data.cancelledBy).toBe('user-001');
      expect(event.data.data.reason).toBe('Emergency stop');
    });
  });

  describe('Deployment Rolledback 事件', () => {
    it('发布 deploy.rolledback 事件', async () => {
      await publisher.publishDeploymentRolledback({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
        rollbackToVersion: 'v0.9.0',
        rollbackReason: 'Health check failed',
        rollbackBy: 'system',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('deploy.rolledback');
      expect(event.data.data.deploymentId).toBe('deploy-001');
      expect(event.data.data.rollbackToVersion).toBe('v0.9.0');
      expect(event.data.data.rollbackReason).toBe('Health check failed');
    });
  });

  describe('setEventBus 和 getAdapter', () => {
    it('应该能够动态设置 EventBus', () => {
      const newPublisher = new DeploymentEventPublisher();
      // 通过 adapter 检查 EventBus 是否可用
      expect(newPublisher.getAdapter().isAvailable()).toBe(false);

      newPublisher.setEventBus(mockEventBus);
      expect(newPublisher.getAdapter().isAvailable()).toBe(true);
    });

    it('应该能够获取 Adapter 检查连接状态', () => {
      const adapter = publisher.getAdapter();
      expect(adapter.isAvailable()).toBe(true);
      expect(adapter.getConnectionState()).toBe('connected');
    });
  });

  describe('无 EventBus 时的行为', () => {
    it('EventBus 未连接时应优雅降级', async () => {
      const publisherWithoutBus = new DeploymentEventPublisher();

      // 不应抛出错误
      const result = await publisherWithoutBus.publishDeploymentStarted({
        deploymentId: 'deploy-001',
        service: 'api-gateway',
        environment: 'production',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('EventBus not available');
    });
  });
});