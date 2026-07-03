/**
 * PipelineAuditLogService - Pipeline execution audit trail
 *
 * Records and queries pipeline lifecycle events:
 * - Stage start/complete/skip/fail
 * - Task start/complete/fail/skip
 * - Approval request/approve/reject
 * - Trigger fire
 * - Run create/cancel/complete
 *
 * Uses PipelineAuditLogRepository for persistence.
 * P2 feature from neatlogic-autoexec comparison analysis.
 */

import { createLogger } from '../utils/logger';
import { PipelineAuditLogRepository } from '../../repositories/PipelineAuditLogRepository';
import { OrionError, ErrorCode } from '../../errors';
import type {
  PipelineAuditLog,
  CreatePipelineAuditLog,
  AuditLogFilter,
  AuditAction,
  AuditOutcome,
} from '../../models/PipelineAuditLog';
import type { PipelineAuditLogEntity } from '../../repositories/PipelineAuditLogRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class PipelineAuditLogServiceError extends Error {
  constructor(message: string, public code: string) {
    super(`[${code}] ${message}`);
    this.name = 'PipelineAuditLogServiceError';
  }
}

export interface PipelineAuditLogServiceOptions {
  db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
}

export class PipelineAuditLogService {
  private repository: PipelineAuditLogRepository | null = null;

  constructor(options?: PipelineAuditLogServiceOptions) {
    if (options?.db) {
      this.repository = new PipelineAuditLogRepository(options.db);
    }
  }

  // ==================== Recording ====================

  /**
   * Record a single audit log entry.
   */
  async record(params: CreatePipelineAuditLog): Promise<PipelineAuditLog> {
    if (!this.repository) {
      throw new PipelineAuditLogServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entity = await this.repository.create({
      id: this.generateId('audit'),
      tenant_id: params.tenantId,
      run_id: params.runId,
      stage_id: params.stageId ?? undefined,
      task_id: params.taskId ?? undefined,
      action: params.action,
      actor: params.actor,
      outcome: params.outcome,
      duration_ms: params.durationMs ?? undefined,
      input_summary: params.inputSummary ?? {},
      output_summary: params.outputSummary ?? {},
      error_message: params.errorMessage ?? undefined,
      metadata: params.metadata ?? {},
    });

    return this.mapEntityToLog(entity);
  }

  /**
   * Record multiple audit log entries in batch.
   * More efficient than calling record() multiple times.
   */
  async recordBatch(paramsList: CreatePipelineAuditLog[]): Promise<PipelineAuditLog[]> {
    if (!this.repository) {
      throw new PipelineAuditLogServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entities = await this.repository.createBatch(
      paramsList.map(p => ({
        id: this.generateId('audit'),
        tenant_id: p.tenantId,
        run_id: p.runId,
        stage_id: p.stageId ?? undefined,
        task_id: p.taskId ?? undefined,
        action: p.action,
        actor: p.actor,
        outcome: p.outcome,
        duration_ms: p.durationMs ?? undefined,
        input_summary: p.inputSummary ?? {},
        output_summary: p.outputSummary ?? {},
        error_message: p.errorMessage ?? undefined,
        metadata: p.metadata ?? {},
      }))
    );

    return entities.map(e => this.mapEntityToLog(e));
  }

  // ==================== Convenience Methods ====================

  /**
   * Record a stage lifecycle event.
   */
  async recordStageEvent(params: {
    tenantId: string; runId: string; stageId: string;
    action: 'start' | 'complete' | 'skip' | 'fail';
    actor: string; outcome: AuditOutcome;
    durationMs?: number; errorMessage?: string; metadata?: Record<string, unknown>;
  }): Promise<PipelineAuditLog> {
    return this.record({
      tenantId: params.tenantId,
      runId: params.runId,
      stageId: params.stageId,
      action: `stage.${params.action}` as AuditAction,
      actor: params.actor,
      outcome: params.outcome,
      durationMs: params.durationMs,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
    });
  }

  /**
   * Record a task lifecycle event.
   */
  async recordTaskEvent(params: {
    tenantId: string; runId: string; stageId: string; taskId: string;
    action: 'start' | 'complete' | 'fail' | 'skip';
    actor: string; outcome: AuditOutcome;
    durationMs?: number;
    inputSummary?: Record<string, unknown>;
    outputSummary?: Record<string, unknown>;
    errorMessage?: string; metadata?: Record<string, unknown>;
  }): Promise<PipelineAuditLog> {
    return this.record({
      tenantId: params.tenantId,
      runId: params.runId,
      stageId: params.stageId,
      taskId: params.taskId,
      action: `task.${params.action}` as AuditAction,
      actor: params.actor,
      outcome: params.outcome,
      durationMs: params.durationMs,
      inputSummary: params.inputSummary,
      outputSummary: params.outputSummary,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
    });
  }

  /**
   * Record an approval event.
   */
  async recordApprovalEvent(params: {
    tenantId: string; runId: string; stageId: string;
    action: 'request' | 'approve' | 'reject';
    actor: string; outcome: AuditOutcome;
    metadata?: Record<string, unknown>;
  }): Promise<PipelineAuditLog> {
    return this.record({
      tenantId: params.tenantId,
      runId: params.runId,
      stageId: params.stageId,
      action: `approval.${params.action}` as AuditAction,
      actor: params.actor,
      outcome: params.outcome,
      metadata: params.metadata,
    });
  }

  /**
   * Record a run lifecycle event.
   */
  async recordRunEvent(params: {
    tenantId: string; runId: string;
    action: 'create' | 'cancel' | 'complete';
    actor: string; outcome: AuditOutcome;
    metadata?: Record<string, unknown>;
  }): Promise<PipelineAuditLog> {
    return this.record({
      tenantId: params.tenantId,
      runId: params.runId,
      action: `run.${params.action}` as AuditAction,
      actor: params.actor,
      outcome: params.outcome,
      metadata: params.metadata,
    });
  }

  // ==================== Querying ====================

  /**
   * Query audit logs with flexible filters.
   */
  async query(filter: AuditLogFilter): Promise<{ logs: PipelineAuditLog[]; total: number }> {
    if (!this.repository) {
      throw new PipelineAuditLogServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const [entities, total] = await Promise.all([
      this.repository.findByFilter({
        tenantId: filter.tenantId,
        runId: filter.runId,
        stageId: filter.stageId,
        taskId: filter.taskId,
        action: filter.action,
        actor: filter.actor,
        outcome: filter.outcome,
        startTime: filter.startTime,
        endTime: filter.endTime,
        limit: filter.limit ?? 50,
        offset: filter.offset ?? 0,
      }),
      this.repository.countByFilter({
        tenantId: filter.tenantId,
        runId: filter.runId,
        stageId: filter.stageId,
        action: filter.action,
        outcome: filter.outcome,
        startTime: filter.startTime,
        endTime: filter.endTime,
      }),
    ]);

    return {
      logs: entities.map(e => this.mapEntityToLog(e)),
      total,
    };
  }

  /**
   * Get audit trail for a specific pipeline run.
   */
  async getRunAuditTrail(tenantId: string, runId: string, limit = 100): Promise<PipelineAuditLog[]> {
    const { logs } = await this.query({
      tenantId,
      runId,
      limit,
    });
    return logs;
  }

  // ==================== Maintenance ====================

  /**
   * Delete audit logs older than retention period.
   * Returns count of deleted entries.
   */
  async cleanupExpired(retentionDays: number): Promise<number> {
    if (!this.repository) {
      throw new PipelineAuditLogServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    return this.repository.deleteOlderThan(cutoff);
  }

  // ==================== Private Helpers ====================

  private mapEntityToLog(entity: PipelineAuditLogEntity): PipelineAuditLog {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      runId: entity.run_id,
      stageId: entity.stage_id ?? undefined,
      taskId: entity.task_id ?? undefined,
      action: entity.action as PipelineAuditLog['action'],
      actor: entity.actor,
      outcome: entity.outcome as PipelineAuditLog['outcome'],
      durationMs: entity.duration_ms ?? undefined,
      inputSummary: entity.input_summary,
      outputSummary: entity.output_summary,
      errorMessage: entity.error_message ?? undefined,
      metadata: entity.metadata,
      createdAt: entity.created_at,
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
