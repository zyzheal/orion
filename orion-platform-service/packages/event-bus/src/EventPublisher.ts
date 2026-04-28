/**
 * 事件发布器
 */

import { JetStreamClient, PubAck } from 'nats';
import { CloudEvent, CloudEventBuilder, CloudEventType } from './CloudEvent';

export interface PublisherOptions {
  /** 事件 ID (可选，自动生成) */
  id?: string;
  /** 事件源 (可选，默认从配置获取) */
  source?: string;
  /** 扩展属性 */
  extensions?: {
    tenantId?: string;
    userId?: string;
    traceId?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    [key: string]: any;
  };
}

export class EventPublisher {
  private jsClient: JetStreamClient;
  private defaultSource: string;

  constructor(jsClient: JetStreamClient, defaultSource?: string) {
    this.jsClient = jsClient;
    this.defaultSource = defaultSource || 'orion-platform';
  }

  /**
   * 发布事件
   */
  async publish<T>(
    type: CloudEventType,
    data: T,
    options?: PublisherOptions
  ): Promise<PubAck> {
    const builder = new CloudEventBuilder<T>()
      .withType(type)
      .withSource(options?.source || this.defaultSource)
      .withData(data);

    if (options?.id) {
      builder.withId(options.id);
    }
    if (options?.extensions) {
      builder.withExtensions(options.extensions);
    }

    const event = builder.build();

    // 验证事件
    event.validate();

    // 发布到 NATS
    const subject = event.type;
    const payload = Buffer.from(JSON.stringify(event.toJSON()));

    return this.jsClient.publish(subject, payload);
  }

  /**
   * 发布 Pipeline 事件
   */
  async publishPipelineEvent<T>(
    action: 'created' | 'started' | 'completed' | 'failed' | 'cancelled',
    data: T,
    options?: PublisherOptions
  ): Promise<PubAck> {
    return this.publish(`pipeline.run.${action}`, data, options);
  }

  /**
   * 发布 Stage 事件
   */
  async publishStageEvent<T>(
    action: 'started' | 'completed' | 'failed' | 'skipped',
    data: T,
    options?: PublisherOptions
  ): Promise<PubAck> {
    return this.publish(`pipeline.stage.${action}`, data, options);
  }

  /**
   * 发布部署事件
   */
  async publishDeploymentEvent<T>(
    action: 'started' | 'completed' | 'failed' | 'rolled_back',
    data: T,
    options?: PublisherOptions
  ): Promise<PubAck> {
    return this.publish(`deployment.${action}`, data, options);
  }

  /**
   * 发布代码事件
   */
  async publishCodeEvent<T>(
    action: 'pr.opened' | 'pr.merged' | 'pr.closed' | 'push' | 'tag',
    data: T,
    options?: PublisherOptions
  ): Promise<PubAck> {
    return this.publish(`code.${action}`, data, options);
  }

  /**
   * 发布配置事件
   */
  async publishConfigEvent<T>(
    action: 'changed' | 'drift.detected' | 'reverted',
    data: T,
    options?: PublisherOptions
  ): Promise<PubAck> {
    return this.publish(`config.${action}`, data, options);
  }

  /**
   * 发布告警事件
   */
  async publishAlertEvent<T>(
    action: 'triggered' | 'resolved' | 'acknowledged',
    data: T,
    options?: PublisherOptions
  ): Promise<PubAck> {
    return this.publish(`alert.${action}`, data, options);
  }

  /**
   * 发布事件 (通用)
   */
  async emit<T>(
    domain: string,
    action: string,
    data: T,
    options?: PublisherOptions
  ): Promise<PubAck> {
    return this.publish(`${domain}.${action}`, data, options);
  }
}
