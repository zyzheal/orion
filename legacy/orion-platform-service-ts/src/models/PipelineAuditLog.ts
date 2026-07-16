/**
 * PipelineAuditLog - Pipeline execution audit trail model
 *
 * Tracks all pipeline/stage/task lifecycle events for forensic analysis.
 * Mirrors NeatLogic's console_log / node_log audit trail pattern.
 */

export type AuditAction =
  // Stage lifecycle
  | 'stage.start' | 'stage.complete' | 'stage.skip' | 'stage.fail'
  // Task lifecycle
  | 'task.start' | 'task.complete' | 'task.fail' | 'task.skip'
  // Approval events
  | 'approval.request' | 'approval.approve' | 'approval.reject'
  // Trigger events
  | 'trigger.fire'
  // Run lifecycle
  | 'run.create' | 'run.cancel' | 'run.complete';

export type AuditOutcome = 'success' | 'failed' | 'pending';

export interface PipelineAuditLog {
  id: string;
  tenantId: string;
  runId: string;
  stageId?: string;
  taskId?: string;
  action: AuditAction;
  actor: string; // userId | 'system' | 'trigger'
  outcome: AuditOutcome;
  durationMs?: number;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreatePipelineAuditLog {
  tenantId: string;
  runId: string;
  stageId?: string;
  taskId?: string;
  action: AuditAction;
  actor: string;
  outcome: AuditOutcome;
  durationMs?: number;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilter {
  tenantId?: string;
  runId?: string;
  stageId?: string;
  taskId?: string;
  action?: AuditAction;
  actor?: string;
  outcome?: AuditOutcome;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}
