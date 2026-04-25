/**
 * Pipeline Event Listener - Pipeline 事件监听器示例
 *
 * 展示如何订阅和处理 Pipeline 事件
 */

import { EventBus, CloudEvent, EventHandler, EventContext, Subscription } from '@orion/event-bus';
import { PipelineEventType, PipelineRunEventData, StageEventData } from './types';

/**
 * 事件处理器接口
 */
export interface PipelineEventHandler {
  /** 处理 PipelineRun 创建事件 */
  onRunCreated?: (event: CloudEvent<PipelineRunEventData>, context: EventContext) => Promise<void>;
  /** 处理 PipelineRun 开始事件 */
  onRunStarted?: (event: CloudEvent<PipelineRunEventData>, context: EventContext) => Promise<void>;
  /** 处理 PipelineRun 完成事件 */
  onRunCompleted?: (event: CloudEvent<PipelineRunEventData>, context: EventContext) => Promise<void>;
  /** 处理 PipelineRun 失败事件 */
  onRunFailed?: (event: CloudEvent<PipelineRunEventData>, context: EventContext) => Promise<void>;
  /** 处理 PipelineRun 取消事件 */
  onRunCancelled?: (event: CloudEvent<PipelineRunEventData>, context: EventContext) => Promise<void>;
  /** 处理 Stage 开始事件 */
  onStageStarted?: (event: CloudEvent<StageEventData>, context: EventContext) => Promise<void>;
  /** 处理 Stage 完成事件 */
  onStageCompleted?: (event: CloudEvent<StageEventData>, context: EventContext) => Promise<void>;
  /** 处理 Stage 失败事件 */
  onStageFailed?: (event: CloudEvent<StageEventData>, context: EventContext) => Promise<void>;
  /** 处理 Stage 跳过事件 */
  onStageSkipped?: (event: CloudEvent<StageEventData>, context: EventContext) => Promise<void>;
}

/**
 * 监听器配置
 */
export interface PipelineEventListenerConfig {
  /** 事件总线实例 */
  eventBus: EventBus;
  /** 流名称 */
  streamName: string;
  /** 订阅组名称（用于负载均衡） */
  consumerGroup?: string;
  /** 事件处理器 */
  handlers: PipelineEventHandler;
}

/**
 * Pipeline 事件监听器
 *
 * 订阅并处理所有 Pipeline 相关事件
 */
export class PipelineEventListener {
  private eventBus: EventBus;
  private streamName: string;
  private consumerGroup: string;
  private handlers: PipelineEventHandler;
  private subscriptions: Subscription[] = [];

  constructor(config: PipelineEventListenerConfig) {
    this.eventBus = config.eventBus;
    this.streamName = config.streamName;
    this.consumerGroup = config.consumerGroup || 'pipeline-event-consumers';
    this.handlers = config.handlers;
  }

  /**
   * 启动事件监听
   */
  async start(): Promise<void> {
    console.log('[PipelineEventListener] Starting event listeners...');

    // 订阅所有 Pipeline Run 事件
    await this.subscribeToRunEvents();

    // 订阅所有 Stage 事件
    await this.subscribeToStageEvents();

    console.log('[PipelineEventListener] All event listeners started');
  }

  /**
   * 订阅 Pipeline Run 事件
   */
  private async subscribeToRunEvents(): Promise<void> {
    const runEventTypes: Array<keyof Required<PipelineEventHandler>> = [
      'onRunCreated',
      'onRunStarted',
      'onRunCompleted',
      'onRunFailed',
      'onRunCancelled',
    ];

    const eventTypeMap: Record<string, PipelineEventType> = {
      'onRunCreated': 'pipeline.run.created',
      'onRunStarted': 'pipeline.run.started',
      'onRunCompleted': 'pipeline.run.completed',
      'onRunFailed': 'pipeline.run.failed',
      'onRunCancelled': 'pipeline.run.cancelled',
    };

    for (const handlerKey of runEventTypes) {
      const handler = this.handlers[handlerKey];
      if (!handler) continue;

      const eventType = eventTypeMap[handlerKey];
      const unsubscribe = await this.eventBus.subscribe<PipelineRunEventData>(
        eventType,
        handler as any,
        {
          streamName: this.streamName,
          durableName: `${this.consumerGroup}-${eventType}`,
          autoAck: false,
        }
      );

      this.subscriptions.push(unsubscribe);
      console.log(`[PipelineEventListener] Subscribed to ${eventType}`);
    }
  }

  /**
   * 订阅 Stage 事件
   */
  private async subscribeToStageEvents(): Promise<void> {
    const stageEventTypes: Array<keyof Required<PipelineEventHandler>> = [
      'onStageStarted',
      'onStageCompleted',
      'onStageFailed',
      'onStageSkipped',
    ];

    const eventTypeMap: Record<string, PipelineEventType> = {
      'onStageStarted': 'pipeline.stage.started',
      'onStageCompleted': 'pipeline.stage.completed',
      'onStageFailed': 'pipeline.stage.failed',
      'onStageSkipped': 'pipeline.stage.skipped',
    };

    for (const handlerKey of stageEventTypes) {
      const handler = this.handlers[handlerKey];
      if (!handler) continue;

      const eventType = eventTypeMap[handlerKey];
      const unsubscribe = await this.eventBus.subscribe<StageEventData>(
        eventType,
        handler as any,
        {
          streamName: this.streamName,
          durableName: `${this.consumerGroup}-${eventType}`,
          autoAck: false,
        }
      );

      this.subscriptions.push(unsubscribe);
      console.log(`[PipelineEventListener] Subscribed to ${eventType}`);
    }
  }

  /**
   * 停止事件监听
   */
  async stop(): Promise<void> {
    console.log('[PipelineEventListener] Stopping event listeners...');

    for (const subscription of this.subscriptions) {
      try {
        await subscription.unsubscribe();
      } catch (error) {
        console.error('[PipelineEventListener] Error unsubscribing:', error);
      }
    }

    this.subscriptions = [];
    console.log('[PipelineEventListener] All event listeners stopped');
  }
}

/**
 * 示例：创建事件监听器
 *
 * ```typescript
 * import { EventBus } from '@orion/event-bus';
 * import { PipelineEventListener } from './events/PipelineEventListener';
 *
 * // 创建事件总线
 * const eventBus = new EventBus({
 *   servers: ['nats://localhost:4222'],
 *   logging: { level: 'info' },
 * });
 *
 * // 连接事件总线
 * await eventBus.connect();
 *
 * // 创建事件流
 * await eventBus.createStream({
 *   name: 'orion-pipeline-stream',
 *   subjects: ['pipeline.*'],
 * });
 *
 * // 创建事件监听器
 * const listener = new PipelineEventListener({
 *   eventBus,
 *   streamName: 'orion-pipeline-stream',
 *   consumerGroup: 'my-pipeline-consumers',
 *   handlers: {
 *     async onRunCreated(event, context) {
 *       console.log(`Pipeline Run created: ${event.data.runId}`);
 *       // 发送通知、记录日志等
 *     },
 *     async onRunStarted(event, context) {
 *       console.log(`Pipeline Run started: ${event.data.runId}`);
 *       // 更新 UI、发送通知等
 *     },
 *     async onRunCompleted(event, context) {
 *       console.log(`Pipeline Run completed: ${event.data.runId}`);
 *       // 清理资源、发送通知等
 *     },
 *     async onRunFailed(event, context) {
 *       console.error(`Pipeline Run failed: ${event.data.runId}, error: ${event.data.error}`);
 *       // 告警、通知等
 *     },
 *     async onStageStarted(event, context) {
 *       console.log(`Stage started: ${event.data.stageName}`);
 *     },
 *     async onStageCompleted(event, context) {
 *       console.log(`Stage completed: ${event.data.stageName}`);
 *     },
 *     async onStageFailed(event, context) {
 *       console.error(`Stage failed: ${event.data.stageName}`);
 *     },
 *     async onStageSkipped(event, context) {
 *       console.log(`Stage skipped: ${event.data.stageName}`);
 *     },
 *   },
 * });
 *
 * // 启动监听
 * await listener.start();
 * ```
 */

// 导出默认处理器（可用于快速集成）
export const defaultHandlers: PipelineEventHandler = {
  async onRunCreated(event, context) {
    console.log(`[PipelineEvent] Run created: ${event.data.runId}`, {
      tenantId: event.tenantId,
      userId: event.userId,
      traceId: event.traceId,
    });
  },

  async onRunStarted(event, context) {
    console.log(`[PipelineEvent] Run started: ${event.data.runId}`, {
      tenantId: event.tenantId,
      userId: event.userId,
      traceId: event.traceId,
    });
  },

  async onRunCompleted(event, context) {
    console.log(`[PipelineEvent] Run completed: ${event.data.runId}`, {
      durationMs: event.data.durationMs,
      tenantId: event.tenantId,
      userId: event.userId,
      traceId: event.traceId,
    });
  },

  async onRunFailed(event, context) {
    console.error(`[PipelineEvent] Run failed: ${event.data.runId}`, {
      error: event.data.error,
      tenantId: event.tenantId,
      userId: event.userId,
      traceId: event.traceId,
    });
  },

  async onRunCancelled(event, context) {
    console.log(`[PipelineEvent] Run cancelled: ${event.data.runId}`, {
      tenantId: event.tenantId,
      userId: event.userId,
      traceId: event.traceId,
    });
  },

  async onStageStarted(event, context) {
    console.log(`[PipelineEvent] Stage started: ${event.data.stageName}`, {
      runId: event.data.runId,
      tenantId: event.tenantId,
      userId: event.userId,
      traceId: event.traceId,
    });
  },

  async onStageCompleted(event, context) {
    console.log(`[PipelineEvent] Stage completed: ${event.data.stageName}`, {
      runId: event.data.runId,
      durationMs: event.data.durationMs,
      tenantId: event.tenantId,
      userId: event.userId,
      traceId: event.traceId,
    });
  },

  async onStageFailed(event, context) {
    console.error(`[PipelineEvent] Stage failed: ${event.data.stageName}`, {
      runId: event.data.runId,
      error: event.data.error,
      tenantId: event.tenantId,
      userId: event.userId,
      traceId: event.traceId,
    });
  },

  async onStageSkipped(event, context) {
    console.log(`[PipelineEvent] Stage skipped: ${event.data.stageName}`, {
      runId: event.data.runId,
      tenantId: event.tenantId,
      userId: event.userId,
      traceId: event.traceId,
    });
  },
};
