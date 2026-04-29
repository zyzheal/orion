/**
 * Pipeline Event Listener - Pipeline 事件监听器示例
 *
 * 展示如何订阅和处理 Pipeline 事件
 * 使用 EventBusService 直接订阅，不依赖外部 @orion/event-bus 包
 */

import { EventBusService, TypedEnvelope } from '../services/event-bus-service';
import { PipelineRunEventData, StageEventData, TaskEventData } from './types';

export type PipelineEventHandlerType =
  | 'onRunCreated' | 'onRunStarted' | 'onRunCompleted' | 'onRunFailed' | 'onRunCancelled'
  | 'onStageStarted' | 'onStageCompleted' | 'onStageFailed' | 'onStageSkipped'
  | 'onTaskStarted' | 'onTaskCompleted' | 'onTaskFailed';

export type PipelineHandlerFn<T = unknown> = (event: TypedEnvelope<T>) => Promise<void>;

export interface PipelineEventHandler {
  onRunCreated?: PipelineHandlerFn<PipelineRunEventData>;
  onRunStarted?: PipelineHandlerFn<PipelineRunEventData>;
  onRunCompleted?: PipelineHandlerFn<PipelineRunEventData>;
  onRunFailed?: PipelineHandlerFn<PipelineRunEventData>;
  onRunCancelled?: PipelineHandlerFn<PipelineRunEventData>;
  onStageStarted?: PipelineHandlerFn<StageEventData>;
  onStageCompleted?: PipelineHandlerFn<StageEventData>;
  onStageFailed?: PipelineHandlerFn<StageEventData>;
  onStageSkipped?: PipelineHandlerFn<StageEventData>;
  onTaskStarted?: PipelineHandlerFn<TaskEventData>;
  onTaskCompleted?: PipelineHandlerFn<TaskEventData>;
  onTaskFailed?: PipelineHandlerFn<TaskEventData>;
}

export interface PipelineEventListenerConfig {
  eventBus: EventBusService;
  streamName: string;
  consumerGroup?: string;
  handlers: Partial<PipelineEventHandler>;
}

const RUN_EVENT_MAP: Record<string, string> = {
  onRunCreated: 'orion.pipeline.run.created',
  onRunStarted: 'orion.pipeline.run.started',
  onRunCompleted: 'orion.pipeline.run.completed',
  onRunFailed: 'orion.pipeline.run.failed',
  onRunCancelled: 'orion.pipeline.run.cancelled',
};

const STAGE_EVENT_MAP: Record<string, string> = {
  onStageStarted: 'orion.pipeline.stage.started',
  onStageCompleted: 'orion.pipeline.stage.completed',
  onStageFailed: 'orion.pipeline.stage.failed',
  onStageSkipped: 'orion.pipeline.stage.skipped',
};

const TASK_EVENT_MAP: Record<string, string> = {
  onTaskStarted: 'orion.pipeline.task.started',
  onTaskCompleted: 'orion.pipeline.task.completed',
  onTaskFailed: 'orion.pipeline.task.failed',
};

export class PipelineEventListener {
  private eventBus: EventBusService;
  private streamName: string;
  private consumerGroup: string;
  private handlers: Partial<PipelineEventHandler>;
  private unsubscribers: Array<() => Promise<void>> = [];

  constructor(config: PipelineEventListenerConfig) {
    this.eventBus = config.eventBus;
    this.streamName = config.streamName;
    this.consumerGroup = config.consumerGroup || 'pipeline-event-consumers';
    this.handlers = config.handlers;
  }

  async start(): Promise<void> {
    await this.subscribeToEvents(RUN_EVENT_MAP, 'run');
    await this.subscribeToEvents(STAGE_EVENT_MAP, 'stage');
    await this.subscribeToEvents(TASK_EVENT_MAP, 'task');
  }

  private async subscribeToEvents(eventMap: Record<string, string>, category: string): Promise<void> {
    const consumerName = `${this.consumerGroup}-${category}`;
    for (const [handlerKey, eventType] of Object.entries(eventMap)) {
      const handler = (this.handlers as any)[handlerKey];
      if (!handler) continue;
      const unsub = await this.eventBus.subscribe(eventType, handler, {
        streamName: this.streamName, durableName: consumerName,
      });
      this.unsubscribers.push(unsub);
    }
  }

  async stop(): Promise<void> {
    for (const unsub of this.unsubscribers) { await unsub(); }
    this.unsubscribers = [];
  }
}

export const defaultHandlers: Partial<PipelineEventHandler> = {
  async onRunCreated(event) { console.log(`[PipelineEvent] Run created: ${(event.data as any).runId}`); },
  async onRunStarted(event) { console.log(`[PipelineEvent] Run started: ${(event.data as any).runId}`); },
  async onRunCompleted(event) { console.log(`[PipelineEvent] Run completed: ${(event.data as any).runId}`); },
  async onRunFailed(event) { console.error(`[PipelineEvent] Run failed: ${(event.data as any).runId}`); },
  async onStageCompleted(event) { console.log(`[PipelineEvent] Stage completed: ${(event.data as any).stageName}`); },
  async onStageFailed(event) { console.error(`[PipelineEvent] Stage failed: ${(event.data as any).stageName}`); },
};
