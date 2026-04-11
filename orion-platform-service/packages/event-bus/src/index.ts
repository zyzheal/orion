/**
 * Orion Event Bus - NATS JetStream 实现
 *
 * 功能特性:
 * - 基于 CloudEvents 1.0 规范
 * - 支持事件发布/订阅
 * - 自动重连和故障切换
 * - ACK 确认、重试、死信队列
 * - 流式订阅和持久化订阅
 *
 * @module @orion/event-bus
 */

export { EventBus, EventBusConfig } from './EventBus';
export { EventPublisher, PublishOptions } from './EventPublisher';
export { EventSubscriber, SubscriptionOptions } from './EventSubscriber';
export { CloudEvent, CloudEventType, CloudEventBuilder } from './CloudEvent';
export { DeadLetterQueue, DLQConfig } from './DeadLetterQueue';
export type {
  EventHandler,
  EventContext,
  RetryConfig,
  Subscription,
} from './types';
