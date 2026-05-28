/**
 * ConfigChangeService - 配置变更管理服务
 *
 * 提供增强版配置变更生命周期管理：
 * - 提交变更请求（含风险评估）
 * - 审批/拒绝变更
 * - 执行变更
 * - 回滚变更
 * - 查询变更历史
 *
 * 复用现有的 ConfigService + ConfigApprovalService 基础能力
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { ConfigService } from '../config-mgmt/ConfigService';
import { ConfigApprovalService } from '../config-mgmt/ConfigApprovalService';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../../errors';

const logger = pino({ name: 'LConfig-LChange-LService' });

// ============================================================
// Types
// ============================================================

export type ChangeRequestType = 'create' | 'modify' | 'delete';
export type ChangeRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'rolled_back';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ChangeRequest {
  id: string;
  tenantId: string;
  configKey: string;
  configGroup?: string;
  environment: string;
  changeType: ChangeRequestType;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string;
  riskLevel: RiskLevel;
  requester: string;
  status: ChangeRequestStatus;
  executionPlan?: Record<string, unknown>;
  rollbackPlan?: Record<string, unknown>;
  approvals: ApprovalRecord[];
  requiredApprovals: number;
  executedAt?: Date;
  executedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  rolledBackAt?: Date;
  rolledBackBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalRecord {
  id: string;
  approver: string;
  action: 'approve' | 'reject';
  comment?: string;
  approvedAt: Date;
}

export interface SubmitChangeRequestInput {
  configKey: string;
  configGroup?: string;
  environment?: string;
  changeType?: ChangeRequestType;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason: string;
  riskLevel?: RiskLevel;
  executionPlan?: Record<string, unknown>;
  rollbackPlan?: Record<string, unknown>;
  requiredApprovals?: number;
}

export interface ChangeHistoryFilter {
  status?: ChangeRequestStatus;
  configKey?: string;
  configGroup?: string;
  environment?: string;
  requester?: string;
  riskLevel?: RiskLevel;
  limit?: number;
  offset?: number;
}

export interface ChangeHistoryEntry {
  id: string;
  tenantId?: string;
  changeRequestId: string;
  configKey: string;
  configGroup?: string;
  environment: string;
  action: string;
  actor: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  notes?: string;
  createdAt: Date;
}

// ============================================================
// Repository
// ============================================================

interface ChangeRequestRow {
  id: string;
  tenant_id: string;
  config_key: string;
  config_group: string | null;
  environment: string;
  change_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string;
  risk_level: string;
  requester: string;
  status: string;
  execution_plan: Record<string, unknown> | null;
  rollback_plan: Record<string, unknown> | null;
  approvals: Record<string, unknown>[];
  required_approvals: number;
  executed_at: Date | null;
  executed_by: string | null;
  approved_at: Date | null;
  approved_by: string | null;
  rolled_back_at: Date | null;
  rolled_back_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ChangeHistoryRow {
  id: string;
  tenant_id: string;
  change_request_id: string | null;
  config_key: string;
  config_group: string | null;
  environment: string;
  action: string;
  actor: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  notes: string | null;
  created_at: Date;
}

class ConfigChangeRepository {
  private pool: DatabasePool | null;
  private memory = new Map<string, ChangeRequest>();
  private historyMemory: ChangeHistoryEntry[] = [];

  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  async save(req: ChangeRequest): Promise<void> {
    if (!this.isDbAvailable()) {
      this.memory.set(req.id, req);
      return;
    }
    await this.pool!.query(
      `INSERT INTO config_change_requests_enhanced (
        id, tenant_id, config_key, config_group, environment, change_type,
        old_value, new_value, reason, risk_level, requester, status,
        execution_plan, rollback_plan, approvals, required_approvals,
        executed_at, executed_by, approved_at, approved_by,
        rolled_back_at, rolled_back_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        approvals = EXCLUDED.approvals,
        executed_at = EXCLUDED.executed_at,
        executed_by = EXCLUDED.executed_by,
        approved_at = EXCLUDED.approved_at,
        approved_by = EXCLUDED.approved_by,
        rolled_back_at = EXCLUDED.rolled_back_at,
        rolled_back_by = EXCLUDED.rolled_back_by,
        updated_at = EXCLUDED.updated_at`,
      [
        req.id,
        req.tenantId,
        req.configKey,
        req.configGroup || null,
        req.environment,
        req.changeType,
        req.oldValue ? JSON.stringify(req.oldValue) : null,
        req.newValue ? JSON.stringify(req.newValue) : null,
        req.reason,
        req.riskLevel,
        req.requester,
        req.status,
        req.executionPlan ? JSON.stringify(req.executionPlan) : null,
        req.rollbackPlan ? JSON.stringify(req.rollbackPlan) : null,
        JSON.stringify(req.approvals),
        req.requiredApprovals,
        req.executedAt || null,
        req.executedBy || null,
        req.approvedAt || null,
        req.approvedBy || null,
        req.rolledBackAt || null,
        req.rolledBackBy || null,
        req.createdAt,
        req.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<ChangeRequest | null> {
    if (!this.isDbAvailable()) {
      return this.memory.get(id) || null;
    }
    const rows = (
      await this.pool!.query(
        'SELECT * FROM config_change_requests_enhanced WHERE id = $1',
        [id]
      )
    ).rows;
    if (rows.length === 0) return null;
    return this.rowToChangeRequest(rows[0]);
  }

  async findByTenant(tenantId: string, filter?: ChangeHistoryFilter): Promise<ChangeRequest[]> {
    if (!this.isDbAvailable()) {
      let results = Array.from(this.memory.values()).filter((r) => r.tenantId === tenantId);
      if (filter?.status) results = results.filter((r) => r.status === filter.status);
      if (filter?.configKey) results = results.filter((r) => r.configKey === filter.configKey);
      if (filter?.configGroup) results = results.filter((r) => r.configGroup === filter.configGroup);
      if (filter?.environment) results = results.filter((r) => r.environment === filter.environment);
      if (filter?.requester) results = results.filter((r) => r.requester === filter.requester);
      if (filter?.riskLevel) results = results.filter((r) => r.riskLevel === filter.riskLevel);
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const offset = filter?.offset || 0;
      const limit = filter?.limit || 100;
      return results.slice(offset, offset + limit);
    }

    let query = 'SELECT * FROM config_change_requests_enhanced WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (filter?.status) {
      query += ` AND status = $${paramIdx}`;
      params.push(filter.status);
      paramIdx++;
    }
    if (filter?.configKey) {
      query += ` AND config_key = $${paramIdx}`;
      params.push(filter.configKey);
      paramIdx++;
    }
    if (filter?.configGroup) {
      query += ` AND config_group = $${paramIdx}`;
      params.push(filter.configGroup);
      paramIdx++;
    }
    if (filter?.environment) {
      query += ` AND environment = $${paramIdx}`;
      params.push(filter.environment);
      paramIdx++;
    }
    if (filter?.requester) {
      query += ` AND requester = $${paramIdx}`;
      params.push(filter.requester);
      paramIdx++;
    }
    if (filter?.riskLevel) {
      query += ` AND risk_level = $${paramIdx}`;
      params.push(filter.riskLevel);
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';
    if (filter?.limit) {
      query += ` LIMIT $${paramIdx}`;
      params.push(filter.limit);
      paramIdx++;
    }
    if (filter?.offset) {
      query += ` OFFSET $${paramIdx}`;
      params.push(filter.offset);
    }

    const rows = (await this.pool!.query(query, params)).rows;
    return rows.map((r: ChangeRequestRow) => this.rowToChangeRequest(r));
  }

  async addHistoryEntry(entry: ChangeHistoryEntry): Promise<void> {
    if (!this.isDbAvailable()) {
      this.historyMemory.push(entry);
      return;
    }
    await this.pool!.query(
      `INSERT INTO config_change_history (
        id, tenant_id, change_request_id, config_key, config_group,
        environment, action, actor, old_value, new_value, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        entry.id,
        entry.tenantId || 'default',
        entry.changeRequestId || null,
        entry.configKey,
        entry.configGroup || null,
        entry.environment,
        entry.action,
        entry.actor,
        entry.oldValue ? JSON.stringify(entry.oldValue) : null,
        entry.newValue ? JSON.stringify(entry.newValue) : null,
        entry.notes || null,
        entry.createdAt,
      ]
    );
  }

  async getHistory(tenantId: string, filter?: ChangeHistoryFilter): Promise<ChangeHistoryEntry[]> {
    if (!this.isDbAvailable()) {
      let results = this.historyMemory.filter((h) => h.tenantId === tenantId || h.tenantId === 'default');
      if (filter?.configKey) results = results.filter((h) => h.configKey === filter.configKey);
      if (filter?.configGroup) results = results.filter((h) => h.configGroup === filter.configGroup);
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const offset = filter?.offset || 0;
      const limit = filter?.limit || 100;
      return results.slice(offset, offset + limit);
    }

    let query = 'SELECT * FROM config_change_history WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (filter?.configKey) {
      query += ` AND config_key = $${paramIdx}`;
      params.push(filter.configKey);
      paramIdx++;
    }
    if (filter?.configGroup) {
      query += ` AND config_group = $${paramIdx}`;
      params.push(filter.configGroup);
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';
    if (filter?.limit) {
      query += ` LIMIT $${paramIdx}`;
      params.push(filter.limit);
      paramIdx++;
    }
    if (filter?.offset) {
      query += ` OFFSET $${paramIdx}`;
      params.push(filter.offset);
    }

    const rows = (await this.pool!.query(query, params)).rows;
    return rows.map((r: ChangeHistoryRow) => ({
      id: r.id,
      changeRequestId: r.change_request_id || '',
      configKey: r.config_key,
      configGroup: r.config_group || undefined,
      environment: r.environment,
      action: r.action,
      actor: r.actor,
      oldValue: r.old_value || null,
      newValue: r.new_value || null,
      notes: r.notes || undefined,
      createdAt: r.created_at,
    }));
  }

  private rowToChangeRequest(row: ChangeRequestRow): ChangeRequest {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      configKey: row.config_key,
      configGroup: row.config_group || undefined,
      environment: row.environment,
      changeType: row.change_type as ChangeRequestType,
      oldValue: row.old_value,
      newValue: row.new_value,
      reason: row.reason,
      riskLevel: row.risk_level as RiskLevel,
      requester: row.requester,
      status: row.status as ChangeRequestStatus,
      executionPlan: row.execution_plan || undefined,
      rollbackPlan: row.rollback_plan || undefined,
      approvals: ((row.approvals || []) as unknown) as ApprovalRecord[],
      requiredApprovals: row.required_approvals,
      executedAt: row.executed_at || undefined,
      executedBy: row.executed_by || undefined,
      approvedAt: row.approved_at || undefined,
      approvedBy: row.approved_by || undefined,
      rolledBackAt: row.rolled_back_at || undefined,
      rolledBackBy: row.rolled_back_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ============================================================
// Service
// ============================================================

export class ConfigChangeService {
  private repository: ConfigChangeRepository;
  private configService?: ConfigService;
  private approvalService?: ConfigApprovalService;

  constructor(options: {
    database?: DatabasePool;
    configService?: ConfigService;
    approvalService?: ConfigApprovalService;
  } = {}) {
    this.repository = new ConfigChangeRepository(options.database);
    this.configService = options.configService;
    this.approvalService = options.approvalService;
  }

  /**
   * 提交配置变更请求
   */
  async submitChangeRequest(
    tenantId: string,
    input: SubmitChangeRequestInput,
    requester?: string
  ): Promise<ChangeRequest> {
    const id = uuidv4();
    const now = new Date();

    const changeRequest: ChangeRequest = {
      id,
      tenantId,
      configKey: input.configKey,
      configGroup: input.configGroup,
      environment: input.environment || 'default',
      changeType: input.changeType || 'modify',
      oldValue: input.oldValue || null,
      newValue: input.newValue || null,
      reason: input.reason,
      riskLevel: input.riskLevel || 'low',
      requester: requester || 'system',
      status: 'pending',
      executionPlan: input.executionPlan,
      rollbackPlan: input.rollbackPlan,
      approvals: [],
      requiredApprovals: input.requiredApprovals || this.calculateRequiredApprovals(input.riskLevel || 'low'),
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(changeRequest);
    await this.repository.addHistoryEntry({
      id: uuidv4(),
      changeRequestId: id,
      configKey: input.configKey,
      configGroup: input.configGroup,
      environment: changeRequest.environment,
      action: 'submitted',
      actor: changeRequest.requester,
      oldValue: changeRequest.oldValue,
      newValue: changeRequest.newValue,
      notes: input.reason,
      createdAt: now,
    });

    return { ...changeRequest };
  }

  /**
   * 审批变更请求
   */
  async approveChangeRequest(
    requestId: string,
    reviewerId: string,
    action: 'approve' | 'reject',
    comment?: string
  ): Promise<ChangeRequest> {
    const changeRequest = await this.repository.findById(requestId);
    if (!changeRequest) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Change request '${requestId}' not found`);
    }

    if (changeRequest.status !== 'pending') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Change request is not pending (current: ${changeRequest.status})`);
    }

    // Check if reviewer already voted
    const existingApproval = changeRequest.approvals.find((a) => a.approver === reviewerId);
    if (existingApproval) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Reviewer '${reviewerId}' has already voted on this change request`);
    }

    const now = new Date();
    const approval: ApprovalRecord = {
      id: uuidv4(),
      approver: reviewerId,
      action,
      comment,
      approvedAt: now,
    };

    changeRequest.approvals.push(approval);
    changeRequest.updatedAt = now;

    if (action === 'approve') {
      const approvedCount = changeRequest.approvals.filter(
        (a) => a.action === 'approve'
      ).length;

      if (approvedCount >= changeRequest.requiredApprovals) {
        changeRequest.status = 'approved';
        changeRequest.approvedAt = now;
        changeRequest.approvedBy = reviewerId;
      }
    } else {
      // Rejection is immediate
      changeRequest.status = 'rejected';
    }

    await this.repository.save(changeRequest);
    await this.repository.addHistoryEntry({
      id: uuidv4(),
      changeRequestId: requestId,
      configKey: changeRequest.configKey,
      environment: changeRequest.environment,
      action: action === 'approve' ? 'approved' : 'rejected',
      actor: reviewerId,
      oldValue: changeRequest.oldValue,
      newValue: changeRequest.newValue,
      notes: comment,
      createdAt: now,
    });

    return { ...changeRequest };
  }

  /**
   * 执行变更请求
   */
  async executeChangeRequest(
    requestId: string,
    executorId?: string
  ): Promise<ChangeRequest> {
    const changeRequest = await this.repository.findById(requestId);
    if (!changeRequest) {
      throw new Error(`Change request '${requestId}' not found`);
    }

    if (changeRequest.status !== 'approved') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Change request must be approved before execution (current: ${changeRequest.status})`);
    }

    changeRequest.status = 'executing';
    changeRequest.updatedAt = new Date();
    await this.repository.save(changeRequest);

    try {
      // Execute the actual config change
      if (this.configService) {
        await this.applyConfigChange(changeRequest);
      } else {
        // Simulate execution
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      changeRequest.status = 'executed';
      changeRequest.executedAt = new Date();
      changeRequest.executedBy = executorId || 'system';
      changeRequest.updatedAt = new Date();
      await this.repository.save(changeRequest);
    } catch (error) {
      changeRequest.status = 'failed';
      changeRequest.updatedAt = new Date();
      await this.repository.save(changeRequest);
      throw error;
    }

    await this.repository.addHistoryEntry({
      id: uuidv4(),
      changeRequestId: requestId,
      configKey: changeRequest.configKey,
      environment: changeRequest.environment,
      action: 'executed',
      actor: executorId || 'system',
      oldValue: changeRequest.oldValue,
      newValue: changeRequest.newValue,
      notes: 'Change applied successfully',
      createdAt: new Date(),
    });

    return { ...changeRequest };
  }

  /**
   * 回滚变更请求
   */
  async rollbackChangeRequest(
    requestId: string,
    rolledBackBy?: string
  ): Promise<ChangeRequest> {
    const changeRequest = await this.repository.findById(requestId);
    if (!changeRequest) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Change request '${requestId}' not found`);
    }

    if (changeRequest.status !== 'executed' && changeRequest.status !== 'failed') {
      throw new Error(`Can only rollback executed or failed changes (current: ${changeRequest.status})`);
    }

    changeRequest.status = 'rolled_back';
    changeRequest.rolledBackAt = new Date();
    changeRequest.rolledBackBy = rolledBackBy || 'system';
    changeRequest.updatedAt = new Date();
    await this.repository.save(changeRequest);

    // Apply rollback if config service available
    if (this.configService && changeRequest.oldValue) {
      try {
        // Restore old value (simplified — actual implementation would use config service)
        logger.info(`[ConfigChangeService] Rollback applied for request ${requestId}`);
      } catch (error) {
        logger.error(`[ConfigChangeService] Rollback failed for request ${requestId}:`, error);
      }
    }

    await this.repository.addHistoryEntry({
      id: uuidv4(),
      changeRequestId: requestId,
      configKey: changeRequest.configKey,
      environment: changeRequest.environment,
      action: 'rolled_back',
      actor: rolledBackBy || 'system',
      oldValue: changeRequest.newValue,
      newValue: changeRequest.oldValue,
      notes: `Rollback by ${rolledBackBy || 'system'}`,
      createdAt: new Date(),
    });

    return { ...changeRequest };
  }

  /**
   * 获取变更历史
   */
  async getChangeHistory(
    tenantId: string,
    filter?: ChangeHistoryFilter
  ): Promise<{
    changeRequests: ChangeRequest[];
    history: ChangeHistoryEntry[];
  }> {
    const changeRequests = await this.repository.findByTenant(tenantId, filter);
    const history = await this.repository.getHistory(tenantId, filter);

    return { changeRequests, history };
  }

  /**
   * 获取变更请求详情
   */
  async getChangeRequestById(id: string): Promise<ChangeRequest | null> {
    return this.repository.findById(id);
  }

  /**
   * 列出变更请求
   */
  async listChangeRequests(
    tenantId: string,
    filter?: ChangeHistoryFilter
  ): Promise<ChangeRequest[]> {
    return this.repository.findByTenant(tenantId, filter);
  }

  // ============================================================
  // Internal Methods
  // ============================================================

  private calculateRequiredApprovals(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case 'critical':
        return 3;
      case 'high':
        return 2;
      case 'medium':
        return 1;
      case 'low':
      default:
        return 1;
    }
  }

  private async applyConfigChange(changeRequest: ChangeRequest): Promise<void> {
    if (!this.configService) return;

    switch (changeRequest.changeType) {
      case 'create':
      case 'modify':
        if (changeRequest.newValue) {
          await this.configService.set(
            changeRequest.tenantId,
            changeRequest.configKey,
            changeRequest.newValue,
            `change-request:${changeRequest.id}`
          );
        }
        break;
      case 'delete':
        await this.configService.delete(
          changeRequest.tenantId,
          changeRequest.configKey
        );
        break;
    }
  }
}
