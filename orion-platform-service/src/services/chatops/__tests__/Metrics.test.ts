/**
 * ChatOps Metrics 单元测试
 *
 * 测试监控指标收集器：计数器、Gauge、Prometheus 导出、JSON 导出。
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

import { ChatOpsMetrics } from '../Metrics';

describe('ChatOpsMetrics', () => {
  let metrics: ChatOpsMetrics;

  beforeEach(() => {
    metrics = new ChatOpsMetrics();
  });

  describe('constructor', () => {
    it('should initialize all counters', () => {
      const json = metrics.exportJSON();
      expect(json['chatops_command_executions_total']).toBeDefined();
      expect(json['chatops_command_executions_success']).toBeDefined();
      expect(json['chatops_command_executions_failed']).toBeDefined();
      expect(json['chatops_mock_calls_total']).toBeDefined();
      expect(json['chatops_sse_connections_total']).toBeDefined();
      expect(json['chatops_sse_disconnects_total']).toBeDefined();
      expect(json['chatops_eventbus_publish_total']).toBeDefined();
      expect(json['chatops_eventbus_publish_failed']).toBeDefined();
      expect(json['chatops_eventbus_publish_fallback']).toBeDefined();
      expect(json['chatops_eventbus_subscribe_total']).toBeDefined();
      expect(json['chatops_eventbus_subscribe_failed']).toBeDefined();
      expect(json['chatops_webhook_received_total']).toBeDefined();
      expect(json['chatops_webhook_verification_failed']).toBeDefined();
    });

    it('should initialize all gauges', () => {
      const json = metrics.exportJSON();
      expect(json['chatops_sse_connections_active']).toBeDefined();
      expect(json['chatops_eventbus_connection_state']).toBeDefined();
      expect(json['chatops_recommendations_active']).toBeDefined();
    });
  });

  describe('incrementCounter', () => {
    it('should increment a counter', () => {
      metrics.incrementCounter('chatops_command_executions_total', { command: 'deploy', platform: 'slack' });
      metrics.incrementCounter('chatops_command_executions_total', { command: 'deploy', platform: 'slack' });
      const json = metrics.exportJSON();
      const counter = json['chatops_command_executions_total'] as any;
      expect(counter.total).toBe(2);
    });

    it('should increment by custom amount', () => {
      metrics.incrementCounter('chatops_mock_calls_total', { command: 'test' }, 5);
      const json = metrics.exportJSON();
      const counter = json['chatops_mock_calls_total'] as any;
      expect(counter.total).toBe(5);
    });

    it('should warn for unknown counter', () => {
      // Should not throw
      metrics.incrementCounter('unknown_counter');
    });
  });

  describe('recordCommandExecution', () => {
    it('should record successful execution', () => {
      metrics.recordCommandExecution('deploy', 'slack', true);
      const json = metrics.exportJSON();
      expect((json['chatops_command_executions_total'] as any).total).toBe(1);
      expect((json['chatops_command_executions_success'] as any).total).toBe(1);
      expect((json['chatops_command_executions_failed'] as any).total).toBe(0);
    });

    it('should record failed execution', () => {
      metrics.recordCommandExecution('deploy', 'slack', false);
      const json = metrics.exportJSON();
      expect((json['chatops_command_executions_total'] as any).total).toBe(1);
      expect((json['chatops_command_executions_success'] as any).total).toBe(0);
      expect((json['chatops_command_executions_failed'] as any).total).toBe(1);
    });
  });

  describe('recordMockCall', () => {
    it('should record mock call', () => {
      metrics.recordMockCall('deploy');
      metrics.recordMockCall('restart');
      const json = metrics.exportJSON();
      expect((json['chatops_mock_calls_total'] as any).total).toBe(2);
    });
  });

  describe('recordSSEConnection / recordSSEDisconnect', () => {
    it('should track SSE connections', () => {
      metrics.recordSSEConnection('user-1');
      metrics.recordSSEConnection('user-2');
      const json = metrics.exportJSON();
      expect((json['chatops_sse_connections_total'] as any).total).toBe(2);
      expect((json['chatops_sse_connections_active'] as any).current).toBe(2);
    });

    it('should track SSE disconnections', () => {
      metrics.recordSSEConnection('user-1');
      metrics.recordSSEConnection('user-2');
      metrics.recordSSEDisconnect('user-1');
      const json = metrics.exportJSON();
      expect((json['chatops_sse_disconnects_total'] as any).total).toBe(1);
      expect((json['chatops_sse_connections_active'] as any).current).toBe(1);
    });
  });

  describe('recordEventBusPublish', () => {
    it('should record successful publish', () => {
      metrics.recordEventBusPublish('alert.created', true, false);
      const json = metrics.exportJSON();
      expect((json['chatops_eventbus_publish_total'] as any).total).toBe(1);
      expect((json['chatops_eventbus_publish_failed'] as any).total).toBe(0);
      expect((json['chatops_eventbus_publish_fallback'] as any).total).toBe(0);
    });

    it('should record failed publish', () => {
      metrics.recordEventBusPublish('alert.created', false, false);
      const json = metrics.exportJSON();
      expect((json['chatops_eventbus_publish_failed'] as any).total).toBe(1);
    });

    it('should record fallback publish', () => {
      metrics.recordEventBusPublish('alert.created', true, true);
      const json = metrics.exportJSON();
      expect((json['chatops_eventbus_publish_fallback'] as any).total).toBe(1);
    });
  });

  describe('recordEventBusSubscribe', () => {
    it('should record successful subscribe', () => {
      metrics.recordEventBusSubscribe('alert.created', true);
      const json = metrics.exportJSON();
      expect((json['chatops_eventbus_subscribe_total'] as any).total).toBe(1);
      expect((json['chatops_eventbus_subscribe_failed'] as any).total).toBe(0);
    });

    it('should record failed subscribe', () => {
      metrics.recordEventBusSubscribe('alert.created', false);
      const json = metrics.exportJSON();
      expect((json['chatops_eventbus_subscribe_failed'] as any).total).toBe(1);
    });
  });

  describe('recordWebhookReceived', () => {
    it('should record verified webhook', () => {
      metrics.recordWebhookReceived('slack', true);
      const json = metrics.exportJSON();
      expect((json['chatops_webhook_received_total'] as any).total).toBe(1);
      expect((json['chatops_webhook_verification_failed'] as any).total).toBe(0);
    });

    it('should record unverified webhook', () => {
      metrics.recordWebhookReceived('slack', false);
      const json = metrics.exportJSON();
      expect((json['chatops_webhook_verification_failed'] as any).total).toBe(1);
    });
  });

  describe('setGauge / getGaugeValue', () => {
    it('should set and get gauge value', () => {
      metrics.setGauge('chatops_sse_connections_active', 42);
      expect(metrics.getGaugeValue('chatops_sse_connections_active')).toBe(42);
    });

    it('should return 0 for unknown gauge', () => {
      expect(metrics.getGaugeValue('unknown_gauge')).toBe(0);
    });

    it('should warn for unknown gauge set', () => {
      // Should not throw
      metrics.setGauge('unknown_gauge', 10);
    });
  });

  describe('setEventBusConnectionState', () => {
    it('should set disabled state', () => {
      metrics.setEventBusConnectionState('disabled');
      expect(metrics.getGaugeValue('chatops_eventbus_connection_state')).toBe(0);
    });

    it('should set disconnected state', () => {
      metrics.setEventBusConnectionState('disconnected');
      expect(metrics.getGaugeValue('chatops_eventbus_connection_state')).toBe(1);
    });

    it('should set fallback state', () => {
      metrics.setEventBusConnectionState('fallback');
      expect(metrics.getGaugeValue('chatops_eventbus_connection_state')).toBe(2);
    });

    it('should set connected state', () => {
      metrics.setEventBusConnectionState('connected');
      expect(metrics.getGaugeValue('chatops_eventbus_connection_state')).toBe(3);
    });
  });

  describe('setActiveRecommendations', () => {
    it('should set active recommendations count', () => {
      metrics.setActiveRecommendations(5);
      expect(metrics.getGaugeValue('chatops_recommendations_active')).toBe(5);
    });
  });

  describe('exportPrometheus', () => {
    it('should export in Prometheus format', () => {
      metrics.recordCommandExecution('deploy', 'slack', true);
      const output = metrics.exportPrometheus();
      expect(output).toContain('# HELP chatops_command_executions_total');
      expect(output).toContain('# TYPE chatops_command_executions_total counter');
      expect(output).toContain('chatops_command_executions_total{command="deploy",platform="slack"} 1');
    });

    it('should export gauges', () => {
      const output = metrics.exportPrometheus();
      expect(output).toContain('# TYPE chatops_sse_connections_active gauge');
    });

    it('should handle labels with values', () => {
      metrics.incrementCounter('chatops_mock_calls_total', { command: 'test' });
      const output = metrics.exportPrometheus();
      expect(output).toContain('chatops_mock_calls_total{command="test"} 1');
    });
  });

  describe('exportJSON', () => {
    it('should export counters with total', () => {
      metrics.recordCommandExecution('deploy', 'slack', true);
      const json = metrics.exportJSON() as any;
      expect(json.chatops_command_executions_total.type).toBe('counter');
      expect(json.chatops_command_executions_total.total).toBe(1);
    });

    it('should export gauges with current', () => {
      const json = metrics.exportJSON() as any;
      expect(json.chatops_sse_connections_active.type).toBe('gauge');
      expect(json.chatops_sse_connections_active.current).toBe(0);
    });

    it('should aggregate by labels', () => {
      metrics.incrementCounter('chatops_mock_calls_total', { command: 'deploy' });
      metrics.incrementCounter('chatops_mock_calls_total', { command: 'deploy' });
      metrics.incrementCounter('chatops_mock_calls_total', { command: 'restart' });
      const json = metrics.exportJSON() as any;
      expect(json.chatops_mock_calls_total.total).toBe(3);
      expect(json.chatops_mock_calls_total.byLabels['command:deploy']).toBe(2);
      expect(json.chatops_mock_calls_total.byLabels['command:restart']).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      metrics.recordCommandExecution('deploy', 'slack', true);
      metrics.recordSSEConnection('user-1');
      metrics.setActiveRecommendations(10);

      metrics.reset();

      const json = metrics.exportJSON() as any;
      expect(json.chatops_command_executions_total.total).toBe(0);
      expect(json.chatops_sse_connections_active.current).toBe(0);
      expect(json.chatops_recommendations_active.current).toBe(0);
    });
  });
});
