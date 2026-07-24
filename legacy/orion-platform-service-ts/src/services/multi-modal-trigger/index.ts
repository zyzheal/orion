/**
 * Multi-Modal Trigger Services
 *
 * Phase 3: Supports webhook, chat, schedule, event, and manual triggers.
 */

export { UnifiedTriggerService } from './UnifiedTriggerService';
export type {
  TriggerConfig,
  TriggerInput,
  TriggerEvaluationResult,
  TriggerStats,
} from './UnifiedTriggerService';

export { WebhookTriggerHandler } from './WebhookTriggerHandler';
export type {
  WebhookConfig,
  WebhookPayload,
  WebhookProcessResult,
  WebhookHistoryEntry,
} from './WebhookTriggerHandler';

export { ChatTriggerHandler } from './ChatTriggerHandler';
export type {
  ChatCommand,
  ChatMessage,
  ChatTriggerResult,
} from './ChatTriggerHandler';
