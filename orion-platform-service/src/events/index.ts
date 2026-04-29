/**
 * 事件发布器统一导出
 *
 * 符合 CloudEvents 1.0 规范
 * ARCH-010: 添加 EventBusAdapter 统一接口
 */

// EventBusAdapter (新增)
export {
  EventBusAdapter,
  EventBusAdapterConfig,
  PublishOptions,
  PublishResult,
  CloudEvent,
  createEventBusAdapter,
} from './EventBusAdapter';

// Pipeline 事件
export { PipelineEventPublisher, PipelineEventPublisherConfig, pipelineEventPublisher } from './PipelineEventPublisher';
export { PipelineEventListener } from './PipelineEventListener';

// Code 事件
export { CodeEventPublisher, CodeEventPublisherConfig, codeEventPublisher } from './CodeEventPublisher';

// Deployment 事件
export { DeploymentEventPublisher, DeploymentEventPublisherConfig, deploymentEventPublisher } from './DeploymentEventPublisher';

// Config 事件
export { ConfigEventPublisher, ConfigEventPublisherConfig, configEventPublisher } from './ConfigEventPublisher';

// Incident 事件
export { IncidentEventPublisher, IncidentEventPublisherConfig, incidentEventPublisher } from './IncidentEventPublisher';

// Pipeline 类型
export {
  PipelineEventType,
  PipelineRunEventData,
  StageEventData,
  TaskEventData,
  PipelineEventExtensions,
  StageInfo,
} from './types';

// Code 类型
export {
  CodeEventType,
  PROpenedEventData,
  PRMergedEventData,
  PRClosedEventData,
  PRUpdatedEventData,
  CodeEventExtensions,
} from './types/code';

// Deployment 类型
export {
  DeploymentEventType,
  DeploymentStatus,
  DeploymentStartedEventData,
  DeploymentCompletedEventData,
  DeploymentFailedEventData,
  DeploymentCancelledEventData,
  DeploymentRolledbackEventData,
  DeploymentEventExtensions,
} from './types/deployment';

// Config 类型
export {
  ConfigEventType,
  DriftType,
  DriftSeverity,
  ConfigDriftDetectedEventData,
  ConfigDriftResolvedEventData,
  ConfigChangeAppliedEventData,
  ConfigChangeRejectedEventData,
  ConfigEventExtensions,
} from './types/config';

// JetStream consumer framework (new)
export { JetStreamEventConsumer, ConsumerHandler } from './JetStreamEventConsumer';
export { EventSubscriber, SubscriptionRule, TypedSubscriptionRule } from './EventSubscriber';

// Incident 类型
export {
  IncidentEventType,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  IncidentDetectedEventData,
  IncidentAcknowledgedEventData,
  IncidentResolvedEventData,
  IncidentEscalatedEventData,
  IncidentEventExtensions,
} from './types/incident';