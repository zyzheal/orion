/**
 * ApprovalGateService - Pipeline 人工审批网关
 *
 * 负责：
 * - 在 stage 执行前请求审批
 * - 审批通过/拒绝后恢复/终止 pipeline 执行
 * - 管理审批状态、审批人、审批原因
 *
 * 审批流程：
 * 1. PipelineEngine 检查 stage 是否需要审批 (approval: true)
 * 2. 调用 requestApproval 暂停 pipeline
 * 3. 等待用户调用 approve 或 reject
 * 4. PipelineEngine 根据结果继续或终止
 *
 * PostgreSQL 持久化 + 乐观锁并发控制
 */

import pino from 'pino';
import { Pool } from 'pg';
import { getPool } from '../utils/database';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalRequest {
  id: string;
  runId: string;
  stageId: string;
  stageName: string;
  approvers: string[]; // user IDs who can approve
  reason: string;
  status: ApprovalStatus;
  createdAt: Date;
  respondedAt?: Date;
  respondedBy?: string;
  responseComment?: string;
  tenantId?: string;
  version: number;
}

export interface ApprovalRequestInput {
  runId: string;
  stageId: string;
  stageName: string;
  approvers: string[];
  reason?: string;
  tenantId?: string;
}

// 数据库行类型
interface ApprovalGateRow {
  id: string;
  run_id: string;
  stage_id: string;
  stage_name: string;
  status: ApprovalStatus;
  approvers: string[];
  reason: string;
  created_at: Date;
  responded_at: Date | null;
  responded_by: string | null;
  response_comment: string | null;
  tenant_id: string | null;
  version: number;
}

export class ApprovalGateServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ApprovalGateServiceError';
  }
}

export class ApprovalGateService {
  private pool: Pool;
  private maxAgeMs: number;

  constructor(options?: { maxAgeHours?: number; pool?: Pool }) {
    this.pool = options?.pool || getPool();
    this.maxAgeMs = (options?.maxAgeHours ?? 48) * 60 * 60 * 1000; // Default: 48 hours
  }

  /**
   * 请求审批
   */
  async requestApproval(input: ApprovalRequestInput): Promise<ApprovalRequest> {
    if (!input.runId || !input.stageId || !input.approvers || input.approvers.length === 0) {
      throw new ApprovalGateServiceError(
        'Missing required fields: runId, stageId, approvers',
        'INVALID_INPUT'
      );
    }

    // 检查是否已有 pending 的审批
    const existing = await this.findPendingRequest(input.runId, input.stageId);
    if (existing) {
      return existing;
    }

    const id = this.generateId();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO approval_gates (id, run_id, stage_id, stage_name, status, approvers, reason, tenant_id, version, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)`,
      [
        id,
        input.runId,
        input.stageId,
        input.stageName,
        'pending',
        JSON.stringify(input.approvers),
        input.reason || 'Approval required before proceeding',
        input.tenantId || null,
        now,
      ]
    );

    logger.info(
      { runId: input.runId, stageName: input.stageName, approvers: input.approvers },
      'Approval requested'
    );

    return {
      id,
      runId: input.runId,
      stageId: input.stageId,
      stageName: input.stageName,
      approvers: input.approvers,
      reason: input.reason || 'Approval required before proceeding',
      status: 'pending',
      createdAt: now,
      tenantId: input.tenantId,
      version: 1,
    };
  }

  /**
   * 审批通过（使用乐观锁）
   */
  async approve(
    runId: string,
    stageId: string,
    userId: string,
    comment?: string
  ): Promise<ApprovalRequest> {
    const request = await this.getPendingRequest(runId, stageId);

    // 验证审批人
    if (!request.approvers.includes(userId)) {
      throw new ApprovalGateServiceError(
        `User '${userId}' is not authorized to approve this request`,
        'UNAUTHORIZED_APPROVER'
      );
    }

    // 使用乐观锁更新
    const now = new Date();
    const result = await this.pool.query(
      `UPDATE approval_gates
       SET status = $1, responded_at = $2, responded_by = $3, response_comment = $4, version = version + 1
       WHERE run_id = $5 AND stage_id = $6 AND status = 'pending' AND version = $7
       RETURNING *`,
      ['approved', now, userId, comment || null, runId, stageId, request.version]
    );

    if (result.rowCount === 0) {
      throw new ApprovalGateServiceError(
        'Concurrent modification detected, please retry',
        'CONCURRENT_MODIFICATION'
      );
    }

    logger.info({ runId, stageId, userId }, 'Approval granted');

    return this.toApprovalRequest(result.rows[0]);
  }

  /**
   * 审批拒绝（使用乐观锁）
   */
  async reject(
    runId: string,
    stageId: string,
    userId: string,
    comment?: string
  ): Promise<ApprovalRequest> {
    const request = await this.getPendingRequest(runId, stageId);

    // 验证审批人
    if (!request.approvers.includes(userId)) {
      throw new ApprovalGateServiceError(
        `User '${userId}' is not authorized to reject this request`,
        'UNAUTHORIZED_APPROVER'
      );
    }

    // 使用乐观锁更新
    const now = new Date();
    const result = await this.pool.query(
      `UPDATE approval_gates
       SET status = $1, responded_at = $2, responded_by = $3, response_comment = $4, version = version + 1
       WHERE run_id = $5 AND stage_id = $6 AND status = 'pending' AND version = $7
       RETURNING *`,
      ['rejected', now, userId, comment || null, runId, stageId, request.version]
    );

    if (result.rowCount === 0) {
      throw new ApprovalGateServiceError(
        'Concurrent modification detected, please retry',
        'CONCURRENT_MODIFICATION'
      );
    }

    logger.info({ runId, stageId, userId }, 'Approval rejected');

    return this.toApprovalRequest(result.rows[0]);
  }

  /**
   * 取消审批请求
   */
  async cancel(runId: string, stageId: string): Promise<ApprovalRequest | null> {
    const now = new Date();
    const result = await this.pool.query(
      `UPDATE approval_gates
       SET status = 'cancelled', responded_at = $1, version = version + 1
       WHERE run_id = $2 AND stage_id = $3 AND status = 'pending'
       RETURNING *`,
      [now, runId, stageId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    logger.info({ runId, stageId }, 'Approval request cancelled');
    return this.toApprovalRequest(result.rows[0]);
  }

  /**
   * 获取审批状态
   */
  async getStatus(runId: string, stageId: string): Promise<ApprovalRequest | null> {
    const result = await this.pool.query<ApprovalGateRow>(
      `SELECT * FROM approval_gates WHERE run_id = $1 AND stage_id = $2`,
      [runId, stageId]
    );

    if (result.rows.length === 0) return null;
    return this.toApprovalRequest(result.rows[0]);
  }

  /**
   * 获取某个 run 的所有审批请求
   */
  async getByRun(runId: string): Promise<ApprovalRequest[]> {
    const result = await this.pool.query<ApprovalGateRow>(
      `SELECT * FROM approval_gates WHERE run_id = $1 ORDER BY created_at ASC`,
      [runId]
    );

    return result.rows.map(row => this.toApprovalRequest(row));
  }

  /**
   * 检查是否需要审批（快速检查）
   */
  async isApprovalPending(runId: string, stageId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM approval_gates WHERE run_id = $1 AND stage_id = $2 AND status = 'pending'`,
      [runId, stageId]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * 检查是否已批准
   */
  async isApproved(runId: string, stageId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM approval_gates WHERE run_id = $1 AND stage_id = $2 AND status = 'approved'`,
      [runId, stageId]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * 检查是否已拒绝
   */
  async isRejected(runId: string, stageId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM approval_gates WHERE run_id = $1 AND stage_id = $2 AND status = 'rejected'`,
      [runId, stageId]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * 清理某个 run 的所有审批记录
   */
  async cleanupRun(runId: string): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM approval_gates WHERE run_id = $1`,
      [runId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * 清理过期的审批记录（超过 maxAgeMs 的 pending 记录）
   */
  async cleanupExpiredRequests(): Promise<number> {
    const cutoff = new Date(Date.now() - this.maxAgeMs);
    const result = await this.pool.query(
      `DELETE FROM approval_gates WHERE status = 'pending' AND created_at < $1`,
      [cutoff]
    );
    const removed = result.rowCount ?? 0;
    if (removed > 0) {
      logger.debug({ removed }, 'Cleaned up expired approval requests');
    }
    return removed;
  }

  // ==================== Internal Helpers ====================

  /**
   * 查找 pending 的审批请求
   */
  private async findPendingRequest(runId: string, stageId: string): Promise<ApprovalRequest | null> {
    const result = await this.pool.query<ApprovalGateRow>(
      `SELECT * FROM approval_gates WHERE run_id = $1 AND stage_id = $2 AND status = 'pending'`,
      [runId, stageId]
    );

    if (result.rows.length === 0) return null;
    return this.toApprovalRequest(result.rows[0]);
  }

  /**
   * 获取 pending 的审批请求（带 version 用于乐观锁）
   */
  private async getPendingRequest(runId: string, stageId: string): Promise<ApprovalRequest> {
    const request = await this.getStatus(runId, stageId);
    if (!request) {
      throw new ApprovalGateServiceError(
        `No pending approval request for run '${runId}', stage '${stageId}'`,
        'NO_PENDING_APPROVAL'
      );
    }
    if (request.status !== 'pending') {
      throw new ApprovalGateServiceError(
        `Approval request is already ${request.status}`,
        'APPROVAL_ALREADY_RESPONDED'
      );
    }
    return request;
  }

  /**
   * 数据库行转换为 ApprovalRequest
   */
  private toApprovalRequest(row: ApprovalGateRow): ApprovalRequest {
    return {
      id: row.id,
      runId: row.run_id,
      stageId: row.stage_id,
      stageName: row.stage_name,
      approvers: Array.isArray(row.approvers) ? row.approvers : [],
      reason: row.reason || '',
      status: row.status,
      createdAt: row.created_at,
      respondedAt: row.responded_at ?? undefined,
      respondedBy: row.responded_by ?? undefined,
      responseComment: row.response_comment ?? undefined,
      tenantId: row.tenant_id ?? undefined,
      version: row.version,
    };
  }

  private generateId(): string {
    return `approval-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}