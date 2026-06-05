/**
 * SelfHealingGuardian — 自愈引擎安全护栏
 *
 * SRE 生产必备护栏:
 * 1. 操作审计日志: 所有自愈动作的记录可追溯
 * 2. 风暴抑制: 同一根因触发的 N 个告警只执行 1 次自愈
 * 3. 高危操作双人确认: P0 级操作需要 2 人批准
 *
 * P0 SRE Guard | 2026-04-28
 */

import { v4 as uuidv4 } from 'uuid';
import { HealingAuditRepository } from '../../repositories/HealingAuditRepository';
import pino from 'pino';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'LSelf-LHealing-LGuardian' });

// ==================== Types ====================

export type HealingRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface HealingAuditEntry {
  id: string;
  timestamp: Date;
  incidentId: string;
  actionType: string;
  target: string;
  environment: string;
  riskLevel: HealingRiskLevel;
  approvers: string[]; // Who approved
  executor: string; // Who triggered (system or user)
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'blocked';
  reason: string;
  result?: string;
}

export interface StormSuppressionRule {
  // 时间窗口内同一 root cause 最多执行 N 次
  windowMs: number;
  maxExecutions: number;
  // 按这些维度判定为"同一风暴"
  groupBy: ('appName' | 'environment' | 'alertType')[];
}

export const DEFAULT_STORM_RULES: StormSuppressionRule[] = [
  // 5 分钟内同一 app + env 的相同告警只执行 1 次
  { windowMs: 5 * 60 * 1000, maxExecutions: 1, groupBy: ['appName', 'environment', 'alertType'] },
  // 30 分钟内同一 app 最多执行 3 次
  { windowMs: 30 * 60 * 1000, maxExecutions: 3, groupBy: ['appName'] },
];

export interface DualApprovalConfig {
  // 需要双人确认的风险级别
  requireDualApproval: HealingRiskLevel[];
  // 自动拒绝的风险级别（无人能批准）
  autoBlock: HealingRiskLevel[];
}

export const DEFAULT_DUAL_APPROVAL_CONFIG: DualApprovalConfig = {
  requireDualApproval: ['critical'],
  autoBlock: [],
};

// ==================== Guardian ====================

/** I2 Fix: Maximum size for storm window Map to prevent unbounded memory growth */
const MAX_STORM_WINDOW_SIZE = 10_000;

export class SelfHealingGuardian {
  private auditLog: HealingAuditEntry[] = [];
  private stormWindow: Map<string, { count: number; resetAt: number }> = new Map();
  private stormRules: StormSuppressionRule[];
  private dualApprovalConfig: DualApprovalConfig;
  /** I1 Fix: Optional PostgreSQL repository for persistent audit log */
  private auditRepo?: HealingAuditRepository;

  constructor(options?: {
    stormRules?: StormSuppressionRule[];
    dualApprovalConfig?: DualApprovalConfig;
    auditRepo?: HealingAuditRepository;
  }) {
    this.stormRules = options?.stormRules ?? DEFAULT_STORM_RULES;
    this.dualApprovalConfig = options?.dualApprovalConfig ?? DEFAULT_DUAL_APPROVAL_CONFIG;
    this.auditRepo = options?.auditRepo;
  }

  // ==================== 1. 操作审计日志 ====================

  /**
   * 记录自愈操作审计条目
   * I1 Fix: Persists to PostgreSQL if repository is available, falls back to in-memory
   */
  async recordAudit(entry: Omit<HealingAuditEntry, 'id' | 'timestamp'>): Promise<HealingAuditEntry> {
    const auditEntry: HealingAuditEntry = {
      ...entry,
      id: uuidv4(),
      timestamp: new Date(),
    };

    // I1 Fix: Try to persist to PostgreSQL first
    if (this.auditRepo) {
      try {
        await this.auditRepo.insert({
          incident_id: auditEntry.incidentId,
          action_type: auditEntry.actionType,
          target: auditEntry.target,
          environment: auditEntry.environment,
          risk_level: auditEntry.riskLevel,
          approvers: auditEntry.approvers,
          executor: auditEntry.executor,
          status: auditEntry.status,
          reason: auditEntry.reason,
          result: auditEntry.result,
        });
      } catch (err) {
        logger.warn('[SelfHealingGuardian] Failed to persist audit entry to DB, keeping in-memory:', err);
        // Fall back to in-memory
        this.auditLog.push(auditEntry);
      }
    } else {
      this.auditLog.push(auditEntry);
    }

    return auditEntry;
  }

  /**
   * 查询审计日志
   * I1 Fix: Queries PostgreSQL if repository is available, merges with in-memory
   */
  async queryAudit(options?: {
    incidentId?: string;
    actionType?: string;
    environment?: string;
    status?: string;
    limit?: number;
  }): Promise<HealingAuditEntry[]> {
    let entries: HealingAuditEntry[] = [];

    // I1 Fix: Query from PostgreSQL first (authoritative source)
    if (this.auditRepo) {
      try {
        let dbEntries;
        if (options?.incidentId) {
          dbEntries = await this.auditRepo.findByIncident(options.incidentId, options.limit);
        } else if (options?.environment) {
          dbEntries = await this.auditRepo.findByEnvironment(options.environment, options.limit);
        } else if (options?.status) {
          dbEntries = await this.auditRepo.findByStatus(options.status, options.limit);
        } else {
          const limit = options?.limit ?? 100;
          dbEntries = (await this.auditRepo.findAll({ limit })).entities;
        }
        // Map entity to entry (createdAt -> timestamp)
        entries = dbEntries.map((e: import('../../repositories/HealingAuditRepository').HealingAuditEntity) => this.entityToEntry(e));
      } catch (err) {
        logger.warn('[SelfHealingGuardian] Failed to query audit entries from DB, falling back to memory:', err);
      }
    }

    // If no DB results, fall back to in-memory
    if (entries.length === 0) {
      entries = [...this.auditLog];

      if (options?.incidentId) {
        entries = entries.filter((e) => e.incidentId === options.incidentId);
      }
      if (options?.actionType) {
        entries = entries.filter((e) => e.actionType === options.actionType);
      }
      if (options?.environment) {
        entries = entries.filter((e) => e.environment === options.environment);
      }
      if (options?.status) {
        entries = entries.filter((e) => e.status === options.status);
      }

      const limit = options?.limit ?? 100;
      entries = entries.slice(-limit);
    }

    return entries.reverse(); // Most recent first
  }

  /**
   * 获取审计统计
   * I1 Fix: Uses PostgreSQL counts if repository is available
   */
  async getAuditStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byRiskLevel: Record<string, number>;
    byEnvironment: Record<string, number>;
  }> {
    // I1 Fix: Get stats from PostgreSQL if available
    if (this.auditRepo) {
      try {
        const [total, byStatus, byRiskLevel, byEnvironment] = await Promise.all([
          this.auditRepo.totalCount(),
          this.auditRepo.countByStatus(),
          this.auditRepo.countByRiskLevel(),
          this.auditRepo.countByEnvironment(),
        ]);
        return { total, byStatus, byRiskLevel, byEnvironment };
      } catch (err) {
        logger.warn('[SelfHealingGuardian] Failed to get audit stats from DB, falling back to memory:', err);
      }
    }

    // Fall back to in-memory
    const byStatus: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};
    const byEnvironment: Record<string, number> = {};

    for (const entry of this.auditLog) {
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
      byRiskLevel[entry.riskLevel] = (byRiskLevel[entry.riskLevel] || 0) + 1;
      byEnvironment[entry.environment] = (byEnvironment[entry.environment] || 0) + 1;
    }

    return {
      total: this.auditLog.length,
      byStatus,
      byRiskLevel,
      byEnvironment,
    };
  }

  // ==================== 2. 风暴抑制 ====================

  /**
   * 检查是否应该抑制当前自愈动作
   * 返回 true 表示应该抑制（不执行）
   * I2 Fix: Enforces MAX_STORM_WINDOW_SIZE to prevent unbounded memory growth
   */
  shouldSuppress(alert: {
    appName: string;
    environment: string;
    alertType: string;
  }): boolean {
    // Clean up expired windows
    this.cleanStormWindows();

    // I2 Fix: If still over limit after cleanup, evict oldest entries
    if (this.stormWindow.size >= MAX_STORM_WINDOW_SIZE) {
      this.evictOldestStormEntries(MAX_STORM_WINDOW_SIZE / 2);
    }

    for (const rule of this.stormRules) {
      const key = this.buildStormKey(rule, alert);
      const window = this.stormWindow.get(key);
      const now = Date.now();

      if (window) {
        if (now > window.resetAt) {
          // Window expired, reset
          this.stormWindow.set(key, { count: 1, resetAt: now + rule.windowMs });
        } else if (window.count >= rule.maxExecutions) {
          // Suppressed!
          logger.info(
            `[SelfHealingGuardian] Storm suppression: ${key} (count=${window.count}, max=${rule.maxExecutions})`
          );
          return true;
        } else {
          window.count++;
        }
      } else {
        this.stormWindow.set(key, { count: 1, resetAt: now + rule.windowMs });
      }
    }

    return false;
  }

  /**
   * I2 Fix: Evict the oldest entries from the storm window to free memory
   */
  private evictOldestStormEntries(keepCount: number): void {
    if (this.stormWindow.size <= keepCount) return;

    // Sort by resetAt (oldest first) and delete entries until we're under limit
    const sortedKeys = Array.from(this.stormWindow.entries())
      .sort(([, a], [, b]) => a.resetAt - b.resetAt)
      .slice(0, this.stormWindow.size - keepCount);

    for (const [key] of sortedKeys) {
      this.stormWindow.delete(key);
    }
  }

  /**
   * 获取当前风暴抑制状态
   */
  getStormStatus(): { activeWindows: number; suppressedCount: number } {
    this.cleanStormWindows();
    let suppressedCount = 0;
    for (const [key, window] of this.stormWindow) {
      if (window.count >= 2) {
        suppressedCount += window.count - 1;
      }
    }
    return {
      activeWindows: this.stormWindow.size,
      suppressedCount,
    };
  }

  // ==================== 3. 高危操作双人确认 ====================

  /**
   * 检查操作是否需要双人确认
   */
  requiresDualApproval(riskLevel: HealingRiskLevel): boolean {
    return this.dualApprovalConfig.requireDualApproval.includes(riskLevel);
  }

  /**
   * 检查操作是否应该被自动拒绝
   */
  shouldAutoBlock(riskLevel: HealingRiskLevel): boolean {
    return this.dualApprovalConfig.autoBlock.includes(riskLevel);
  }

  /**
   * 验证双人审批是否完成
   * 返回审批结果
   */
  validateDualApproval(
    approvers: string[],
    riskLevel: HealingRiskLevel
  ): { approved: boolean; reason: string } {
    if (this.shouldAutoBlock(riskLevel)) {
      return { approved: false, reason: `Risk level '${riskLevel}' is auto-blocked` };
    }

    if (!this.requiresDualApproval(riskLevel)) {
      // 不需要双人确认，单人审批即可
      if (approvers.length >= 1) {
        return { approved: true, reason: 'Single approval sufficient' };
      }
      return { approved: false, reason: 'No approver yet' };
    }

    // 需要双人确认
    if (approvers.length < 2) {
      return {
        approved: false,
        reason: `Dual approval required, got ${approvers.length}/2`,
      };
    }

    // 检查是否是同一个人审批了两次
    const uniqueApprovers = new Set(approvers);
    if (uniqueApprovers.size < 2) {
      return {
        approved: false,
        reason: 'Dual approval requires 2 different approvers',
      };
    }

    return { approved: true, reason: 'Dual approval complete' };
  }

  // ==================== Private Helpers ====================

  /**
   * I1 Fix: Convert repository entity to audit entry format
   * Maps createdAt -> timestamp for compatibility
   */
  private entityToEntry(entity: import('../../repositories/HealingAuditRepository').HealingAuditEntity): HealingAuditEntry {
    return {
      id: entity.id,
      incidentId: entity.incidentId,
      actionType: entity.actionType,
      target: entity.target,
      environment: entity.environment,
      riskLevel: entity.riskLevel,
      approvers: entity.approvers,
      executor: entity.executor,
      status: entity.status,
      reason: entity.reason || '',
      result: entity.result || '',
      timestamp: entity.createdAt,
    };
  }

  private buildStormKey(rule: StormSuppressionRule, alert: Record<string, string>): string {
    const parts = rule.groupBy.map((field) => `${field}:${alert[field] || 'unknown'}`);
    return parts.join('|');
  }

  private cleanStormWindows(): void {
    const now = Date.now();
    for (const [key, window] of this.stormWindow) {
      if (now > window.resetAt) {
        this.stormWindow.delete(key);
      }
    }
  }
}
