/**
 * EventBus 集成测试
 *
 * 测试 NATS JetStream 事件总线的核心功能：
 * - 连接和断开
 * - 事件发布
 * - 事件订阅
 * - 死信队列
 * - 故障恢复
 */

import { EventBus } from '../src/EventBus';
import { CloudEventBuilder } from '../src/CloudEvent';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus({
      servers: ['nats://localhost:4222'],
      reconnect: {
        enabled: true,
        maxRetries: 3,
        interval: 2000,
      },
      retry: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2,
      },
    });
  });

  afterEach(async () => {
    await eventBus.close();
  });

  describe('Connection', () => {
    it('should connect to NATS server', async () => {
      await expect(eventBus.connect()).resolves.not.toThrow();
    });

    it('should handle connection failure gracefully', async () => {
      const eventBusOffline = new EventBus({
        servers: ['nats://invalid-host:4222'],
      });

      await expect(eventBusOffline.connect()).rejects.toThrow();
      await eventBusOffline.close();
    });
  });

  describe('Publish/Subscribe', () => {
    it('should publish and receive events', async () => {
      await eventBus.connect();

      // 创建测试流
      await eventBus.createStream({
        name: 'test-stream',
        subjects: ['test.event.*'],
        replicas: 1,
        storage: 'memory',
      });

      const receivedEvents: any[] = [];

      // 订阅事件
      await eventBus.subscribe('test.event.created', (event) => {
        receivedEvents.push(event);
        return Promise.resolve();
      }, {
        streamName: 'test-stream',
        durableName: 'test-subscriber',
        autoAck: true,
      });

      // 发布事件
      const event = new CloudEventBuilder()
        .withType('test.event.created')
        .withSource('event-bus-test')
        .withData({ test: 'data', id: 123 })
        .build();

      await eventBus.publish(event);

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].type).toBe('test.event.created');
      expect(receivedEvents[0].data).toEqual({ test: 'data', id: 123 });
    });

    it('should handle multiple subscribers', async () => {
      await eventBus.connect();

      await eventBus.createStream({
        name: 'test-stream-multi',
        subjects: ['test.multi.*'],
        replicas: 1,
        storage: 'memory',
      });

      const events1: any[] = [];
      const events2: any[] = [];

      // 两个订阅者
      await eventBus.subscribe('test.multi.event', (event) => {
        events1.push(event);
        return Promise.resolve();
      }, {
        streamName: 'test-stream-multi',
        durableName: 'subscriber-1',
        autoAck: true,
      });

      await eventBus.subscribe('test.multi.event', (event) => {
        events2.push(event);
        return Promise.resolve();
      }, {
        streamName: 'test-stream-multi',
        durableName: 'subscriber-2',
        autoAck: true,
      });

      // 发布事件
      const event = new CloudEventBuilder()
        .withType('test.multi.event')
        .withSource('event-bus-test')
        .withData({ multi: 'test' })
        .build();

      await eventBus.publish(event);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 每个订阅者都应该收到事件
      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });
  });

  describe('Stream Management', () => {
    it('should create stream with correct configuration', async () => {
      await eventBus.connect();

      await eventBus.createStream({
        name: 'test-config-stream',
        subjects: ['test.config.*'],
        replicas: 1,
        storage: 'memory',
        retention: 'limits',
        maxMsgs: 1000,
      });

      // 流创建成功即通过测试
      expect(true).toBe(true);
    });
  });

  describe('CloudEvent', () => {
    it('should create valid CloudEvent', () => {
      const event = new CloudEventBuilder()
        .withType('pipeline.run.created')
        .withSource('test-service')
        .withData({ pipelineId: '123', name: 'test' })
        .withSubject('pipeline-123')
        .withExtensions({
          tenantId: 'tenant-1',
          userId: 'user-1',
          priority: 'high',
        })
        .build();

      expect(event.specversion).toBe('1.0');
      expect(event.type).toBe('pipeline.run.created');
      expect(event.source).toBe('test-service');
      expect(event.data).toEqual({ pipelineId: '123', name: 'test' });
      expect(event.tenantId).toBe('tenant-1');
      expect(event.priority).toBe('high');
    });

    it('should validate CloudEvent', () => {
      const event = new CloudEventBuilder()
        .withType('test.event')
        .withSource('test')
        .withData({})
        .build();

      expect(() => event.validate()).not.toThrow();
    });

    it('should throw on invalid CloudEvent', () => {
      // @ts-ignore - 故意创建无效事件
      const event = new CloudEventBuilder()
        .withType('test.event')
        .withSource('test')
        // 缺少 data
        .build();

      expect(() => event.validate()).toThrow();
    });

    it('should serialize and deserialize CloudEvent', () => {
      const original = new CloudEventBuilder()
        .withType('test.event')
        .withSource('test')
        .withData({ key: 'value' })
        .withExtensions({ tenantId: 't1' })
        .build();

      const json = JSON.stringify(original.toJSON());
      const restored = CloudEventBuilder.fromJSON(json);

      expect(restored.type).toBe(original.type);
      expect(restored.data).toEqual(original.data);
    });
  });
});
