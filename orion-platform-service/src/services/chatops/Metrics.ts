import pino from 'pino';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
/**
 * ChatOps Metrics - Prometheus 监控指标
 *
 * ARCH-007: 添加 Prometheus 监控指标，用于：
 * - 命令执行统计
 * - Mock 调用监控
 * - SSE 连接统计
 * - 事件总线状态
 */

/**
 * 指标类型
 */
interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
}

interface CounterMetric {
  type: 'counter';
  name: string;
  help: string;
  values: MetricValue[];
}

interface GaugeMetric {
  type: 'gauge';
  name: string;
  help: string;
  values: MetricValue[];
}

type Metric = CounterMetric | GaugeMetric;

/**
 * ChatOps 监控指标收集器
 */
export class ChatOpsMetrics {
  private counters: Map<string, CounterMetric> = new Map();
  private gauges: Map<string, GaugeMetric> = new Map();

  constructor() {
    // 初始化所有指标
    this.initMetrics();
  }

  private initMetrics(): void {
    // 命令执行计数器
    this.counters.set('chatops_command_executions_total', {
      type: 'counter',
      name: 'chatops_command_executions_total',
      help: 'Total number of ChatOps command executions',
      values: [],
    });

    // 命令执行成功计数
    this.counters.set('chatops_command_executions_success', {
      type: 'counter',
      name: 'chatops_command_executions_success',
      help: 'Number of successful ChatOps command executions',
      values: [],
    });

    // 命令执行失败计数
    this.counters.set('chatops_command_executions_failed', {
      type: 'counter',
      name: 'chatops_command_executions_failed',
      help: 'Number of failed ChatOps command executions',
      values: [],
    });

    // Mock 调用计数 (ARCH-007: 监控未接入服务)
    this.counters.set('chatops_mock_calls_total', {
      type: 'counter',
      name: 'chatops_mock_calls_total',
      help: 'Number of mock command executions (service not integrated)',
      values: [],
    });

    // SSE 连接数
    this.gauges.set('chatops_sse_connections_active', {
      type: 'gauge',
      name: 'chatops_sse_connections_active',
      help: 'Number of active SSE connections',
      values: [{ value: 0 }],
    });

    // SSE 连接总数
    this.counters.set('chatops_sse_connections_total', {
      type: 'counter',
      name: 'chatops_sse_connections_total',
      help: 'Total number of SSE connections established',
      values: [],
    });

    // SSE 断开总数
    this.counters.set('chatops_sse_disconnects_total', {
      type: 'counter',
      name: 'chatops_sse_disconnects_total',
      help: 'Total number of SSE disconnections',
      values: [],
    });

    // EventBus 事件发布总数
    this.counters.set('chatops_eventbus_publish_total', {
      type: 'counter',
      name: 'chatops_eventbus_publish_total',
      help: 'Total number of events published to EventBus',
      values: [],
    });

    // EventBus 事件发布失败
    this.counters.set('chatops_eventbus_publish_failed', {
      type: 'counter',
      name: 'chatops_eventbus_publish_failed',
      help: 'Number of EventBus publish failures',
      values: [],
    });

    // EventBus fallback 发布
    this.counters.set('chatops_eventbus_publish_fallback', {
      type: 'counter',
      name: 'chatops_eventbus_publish_fallback',
      help: 'Number of events published in fallback mode',
      values: [],
    });

    // EventBus 订阅总数
    this.counters.set('chatops_eventbus_subscribe_total', {
      type: 'counter',
      name: 'chatops_eventbus_subscribe_total',
      help: 'Total number of EventBus subscriptions',
      values: [],
    });

    // EventBus 订阅失败
    this.counters.set('chatops_eventbus_subscribe_failed', {
      type: 'counter',
      name: 'chatops_eventbus_subscribe_failed',
      help: 'Number of EventBus subscription failures',
      values: [],
    });

    // EventBus 连接状态
    this.gauges.set('chatops_eventbus_connection_state', {
      type: 'gauge',
      name: 'chatops_eventbus_connection_state',
      help: 'EventBus connection state (0=disabled, 1=disconnected, 2=fallback, 3=connected)',
      values: [{ value: 1 }],  // 默认 disconnected
    });

    // 推荐面板活跃数
    this.gauges.set('chatops_recommendations_active', {
      type: 'gauge',
      name: 'chatops_recommendations_active',
      help: 'Number of active recommendations in panel',
      values: [{ value: 0 }],
    });

    // Webhook 接收总数
    this.counters.set('chatops_webhook_received_total', {
      type: 'counter',
      name: 'chatops_webhook_received_total',
      help: 'Total number of webhooks received from IM platforms',
      values: [],
    });

    // Webhook 签名验证失败
    this.counters.set('chatops_webhook_verification_failed', {
      type: 'counter',
      name: 'chatops_webhook_verification_failed',
      help: 'Number of webhook signature verification failures',
      values: [],
    });
  }

  // ==================== Counter Operations ====================

  /**
   * 增加计数器
   */
  incrementCounter(name: string, labels?: Record<string, string>, amount: number = 1): void {
    const counter = this.counters.get(name);
    if (!counter) {
      logger.warn(`[ChatOpsMetrics] Counter ${name} not found`);
      return;
    }

    counter.values.push({
      value: amount,
      labels,
      timestamp: new Date(),
    });
  }

  /**
   * 记录命令执行
   */
  recordCommandExecution(command: string, platform: string, success: boolean): void {
    this.incrementCounter('chatops_command_executions_total', { command, platform });
    if (success) {
      this.incrementCounter('chatops_command_executions_success', { command, platform });
    } else {
      this.incrementCounter('chatops_command_executions_failed', { command, platform });
    }
  }

  /**
   * 记录 Mock 调用
   */
  recordMockCall(command: string): void {
    this.incrementCounter('chatops_mock_calls_total', { command });
  }

  /**
   * 记录 SSE 连接
   */
  recordSSEConnection(userId: string): void {
    this.incrementCounter('chatops_sse_connections_total', { user_id: userId });
    this.setGauge('chatops_sse_connections_active', this.getGaugeValue('chatops_sse_connections_active') + 1);
  }

  /**
   * 记录 SSE 断开
   */
  recordSSEDisconnect(userId: string): void {
    this.incrementCounter('chatops_sse_disconnects_total', { user_id: userId });
    this.setGauge('chatops_sse_connections_active', this.getGaugeValue('chatops_sse_connections_active') - 1);
  }

  /**
   * 记录 EventBus 发布
   */
  recordEventBusPublish(eventType: string, success: boolean, fallback: boolean): void {
    this.incrementCounter('chatops_eventbus_publish_total', { event_type: eventType });
    if (!success) {
      this.incrementCounter('chatops_eventbus_publish_failed', { event_type: eventType });
    }
    if (fallback) {
      this.incrementCounter('chatops_eventbus_publish_fallback', { event_type: eventType });
    }
  }

  /**
   * 记录 EventBus 订阅
   */
  recordEventBusSubscribe(eventType: string, success: boolean): void {
    this.incrementCounter('chatops_eventbus_subscribe_total', { event_type: eventType });
    if (!success) {
      this.incrementCounter('chatops_eventbus_subscribe_failed', { event_type: eventType });
    }
  }

  /**
   * 记录 Webhook 接收
   */
  recordWebhookReceived(platform: string, verified: boolean): void {
    this.incrementCounter('chatops_webhook_received_total', { platform });
    if (!verified) {
      this.incrementCounter('chatops_webhook_verification_failed', { platform });
    }
  }

  // ==================== Gauge Operations ====================

  /**
   * 设置 Gauge 值
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const gauge = this.gauges.get(name);
    if (!gauge) {
      logger.warn(`[ChatOpsMetrics] Gauge ${name} not found`);
      return;
    }

    gauge.values = [{ value, labels, timestamp: new Date() }];
  }

  /**
   * 获取 Gauge 当前值
   */
  getGaugeValue(name: string): number {
    const gauge = this.gauges.get(name);
    if (!gauge || gauge.values.length === 0) return 0;
    return gauge.values[0].value;
  }

  /**
   * 更新 EventBus 连接状态
   */
  setEventBusConnectionState(state: 'disabled' | 'disconnected' | 'fallback' | 'connected'): void {
    const stateMap: Record<string, number> = {
      disabled: 0,
      disconnected: 1,
      fallback: 2,
      connected: 3,
    };
    this.setGauge('chatops_eventbus_connection_state', stateMap[state] ?? 1);
  }

  /**
   * 更新推荐面板活跃数
   */
  setActiveRecommendations(count: number): void {
    this.setGauge('chatops_recommendations_active', count);
  }

  // ==================== Export ====================

  /**
   * 导出 Prometheus 格式
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    for (const counter of this.counters.values()) {
      lines.push(`# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} counter`);

      for (const v of counter.values) {
        const labelsStr = v.labels
          ? Object.entries(v.labels).map(([k, v]) => `${k}="${v}"`).join(',')
          : '';
        const labelPart = labelsStr ? `{${labelsStr}}` : '';
        lines.push(`${counter.name}${labelPart} ${v.value}`);
      }
    }

    for (const gauge of this.gauges.values()) {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`);
      lines.push(`# TYPE ${gauge.name} gauge`);

      for (const v of gauge.values) {
        const labelsStr = v.labels
          ? Object.entries(v.labels).map(([k, v]) => `${k}="${v}"`).join(',')
          : '';
        const labelPart = labelsStr ? `{${labelsStr}}` : '';
        lines.push(`${gauge.name}${labelPart} ${v.value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 导出 JSON 格式（用于 API）
   */
  exportJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, counter] of this.counters.entries()) {
      result[name] = {
        type: 'counter',
        help: counter.help,
        total: counter.values.reduce((sum, v) => sum + v.value, 0),
        byLabels: this.aggregateByLabels(counter.values),
      };
    }

    for (const [name, gauge] of this.gauges.entries()) {
      result[name] = {
        type: 'gauge',
        help: gauge.help,
        current: gauge.values.length > 0 ? gauge.values[0].value : 0,
      };
    }

    return result;
  }

  private aggregateByLabels(values: MetricValue[]): Record<string, number> {
    const aggregated: Record<string, number> = {};
    for (const v of values) {
      if (v.labels) {
        const key = Object.entries(v.labels).map(([k, v]) => `${k}:${v}`).join('|');
        aggregated[key] = (aggregated[key] || 0) + v.value;
      }
    }
    return aggregated;
  }

  /**
   * 重置所有计数器（用于测试）
   */
  reset(): void {
    this.initMetrics();
  }
}

/**
 * 全局指标实例
 */
export const chatOpsMetrics = new ChatOpsMetrics();