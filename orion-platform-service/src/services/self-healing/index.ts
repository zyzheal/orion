/**
 * Self-Healing Engine Module
 *
 * TASK-702: Self-Healing Engine (自愈引擎)
 *
 * PostgreSQL-backed service for healing incidents, approvals,
 * rules, and executions. Strategy engine remains in-memory
 * for built-in strategy configuration.
 */

export * from './types';
export { HealingStrategyEngine } from './HealingStrategyEngine';
export { HealingActionExecutor } from './HealingActionExecutor';
export {
  HealingDecisionMaker,
  type IRiskAssessor,
  type DecisionMakerConfig,
} from './HealingDecisionMaker';

// Database-backed Repository and Service
export {
  SelfHealingRepository,
  type SelfHealingRule,
  type SelfHealingExecution,
  type HealingIncidentRow,
  type ApprovalRequestRow,
} from './SelfHealingRepository';
export {
  SelfHealingService,
  SelfHealingServiceError,
  type SelfHealingServiceOptions,
} from './SelfHealingService';
