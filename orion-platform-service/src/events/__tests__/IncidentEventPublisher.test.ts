/**
 * IncidentEventPublisher 单元测试
 */

import { IncidentEventPublisher } from '../IncidentEventPublisher';

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

describe('IncidentEventPublisher', () => {
  let publisher: IncidentEventPublisher;
  let mockEventBus: MockEventBus;

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    publisher = new IncidentEventPublisher({
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
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'high',
        type: 'service_down',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.specversion).toBe('1.0');
      expect(event.data.id).toBeDefined();
      expect(event.data.type).toBe('incident.detected');
      expect(event.data.source).toBe('orion-platform-service');
      expect(event.data.time).toBeDefined();
      expect(event.data.data).toBeDefined();
    });

    it('发布的事件应包含扩展属性', async () => {
      await publisher.publishIncidentDetected(
        {
          incidentId: 'incident-001',
          service: 'api-gateway',
          severity: 'high',
          type: 'service_down',
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
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'high',
        type: 'service_down',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.tenantId).toBe('tenant-001');
      expect(event.data.userId).toBe('user-001');
      expect(event.data.traceId).toBeDefined();
    });
  });

  describe('Incident 事件', () => {
    it('发布 incident.detected 事件', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'critical',
        type: 'service_down',
        title: 'API Gateway 服务不可用',
        description: 'API Gateway 服务无法响应请求，健康检查失败',
        impact: '所有 API 请求失败',
        alertIds: ['alert-001', 'alert-002'],
        rootCause: '数据库连接池耗尽',
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('incident.detected');
      expect(event.data.data.incidentId).toBe('incident-001');
      expect(event.data.data.service).toBe('api-gateway');
      expect(event.data.data.severity).toBe('critical');
      expect(event.data.data.type).toBe('service_down');
      expect(event.data.data.title).toBe('API Gateway 服务不可用');
      expect(event.data.data.description).toBe('API Gateway 服务无法响应请求，健康检查失败');
      expect(event.data.data.impact).toBe('所有 API 请求失败');
      expect(event.data.data.alertIds).toEqual(['alert-001', 'alert-002']);
      expect(event.data.data.rootCause).toBe('数据库连接池耗尽');
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 incident.acknowledged 事件', async () => {
      await publisher.publishIncidentAcknowledged({
        incidentId: 'incident-001',
        service: 'api-gateway',
        acknowledgedBy: 'oncall-engineer-001',
        acknowledgedAt: new Date().toISOString(),
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('incident.acknowledged');
      expect(event.data.data.incidentId).toBe('incident-001');
      expect(event.data.data.service).toBe('api-gateway');
      expect(event.data.data.acknowledgedBy).toBe('oncall-engineer-001');
      expect(event.data.data.acknowledgedAt).toBeDefined();
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 incident.resolved 事件', async () => {
      await publisher.publishIncidentResolved({
        incidentId: 'incident-001',
        service: 'api-gateway',
        resolvedBy: 'engineer-001',
        resolution: '重启了数据库连接池，恢复了服务',
        durationMs: 1800000, // 30 minutes
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('incident.resolved');
      expect(event.data.data.incidentId).toBe('incident-001');
      expect(event.data.data.service).toBe('api-gateway');
      expect(event.data.data.resolvedBy).toBe('engineer-001');
      expect(event.data.data.resolution).toBe('重启了数据库连接池，恢复了服务');
      expect(event.data.data.durationMs).toBe(1800000);
      expect(event.data.data.timestamp).toBeDefined();
    });

    it('发布 incident.escalated 事件', async () => {
      await publisher.publishIncidentEscalated({
        incidentId: 'incident-001',
        service: 'api-gateway',
        escalationLevel: 2,
        reason: 'Incident not resolved within SLA',
        escalatedTo: 'team-lead',
      });

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('incident.escalated');
      expect(event.data.data.incidentId).toBe('incident-001');
      expect(event.data.data.service).toBe('api-gateway');
      expect(event.data.data.escalationLevel).toBe(2);
      expect(event.data.data.reason).toBe('Incident not resolved within SLA');
      expect(event.data.data.escalatedTo).toBe('team-lead');
      expect(event.data.data.timestamp).toBeDefined();
    });
  });

  describe('严重程度类型测试', () => {
    it('支持 low 严重程度', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'low',
        type: 'performance_degradation',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data.severity).toBe('low');
    });

    it('支持 medium 严重程度', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'medium',
        type: 'error_rate_spike',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data.severity).toBe('medium');
    });

    it('支持 high 严重程度', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'high',
        type: 'resource_exhaustion',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data.severity).toBe('high');
    });

    it('支持 critical 严重程度', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'critical',
        type: 'service_down',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data.severity).toBe('critical');
    });
  });

  describe('事故类型测试', () => {
    it('支持 service_down 类型', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'critical',
        type: 'service_down',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data.type).toBe('service_down');
    });

    it('支持 performance_degradation 类型', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'medium',
        type: 'performance_degradation',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data.type).toBe('performance_degradation');
    });

    it('支持 security_breach 类型', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'critical',
        type: 'security_breach',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data.type).toBe('security_breach');
    });
  });

  describe('事件数据类型验证', () => {
    it('Incident Detected 事件应包含所有必需字段', async () => {
      await publisher.publishIncidentDetected({
        incidentId: 'incident-001',
        service: 'api-gateway',
        severity: 'high',
        type: 'service_down',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data).toHaveProperty('incidentId');
      expect(event.data.data).toHaveProperty('service');
      expect(event.data.data).toHaveProperty('severity');
      expect(event.data.data).toHaveProperty('type');
      expect(event.data.data).toHaveProperty('timestamp');
    });

    it('Incident Acknowledged 事件应包含所有必需字段', async () => {
      await publisher.publishIncidentAcknowledged({
        incidentId: 'incident-001',
        service: 'api-gateway',
        acknowledgedBy: 'user-001',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data).toHaveProperty('incidentId');
      expect(event.data.data).toHaveProperty('service');
      expect(event.data.data).toHaveProperty('acknowledgedBy');
      expect(event.data.data).toHaveProperty('timestamp');
    });

    it('Incident Resolved 事件应包含所有必需字段', async () => {
      await publisher.publishIncidentResolved({
        incidentId: 'incident-001',
        service: 'api-gateway',
        resolvedBy: 'user-001',
      });

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data).toHaveProperty('incidentId');
      expect(event.data.data).toHaveProperty('service');
      expect(event.data.data).toHaveProperty('resolvedBy');
      expect(event.data.data).toHaveProperty('timestamp');
    });
  });

  describe('无 EventBus 时的行为', () => {
    it('EventBus 未连接时应优雅降级', async () => {
      const publisherWithoutBus = new IncidentEventPublisher();

      // 不应抛出错误
      await expect(
        publisherWithoutBus.publishIncidentDetected({
          incidentId: 'incident-001',
          service: 'api-gateway',
          severity: 'high',
          type: 'service_down',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('setEventBus 和 getEventBus', () => {
    it('应该能够动态设置和获取 EventBus', () => {
      const newPublisher = new IncidentEventPublisher();
      expect(newPublisher.getEventBus()).toBeNull();

      newPublisher.setEventBus(mockEventBus);
      expect(newPublisher.getEventBus()).toBe(mockEventBus);
    });
  });
});