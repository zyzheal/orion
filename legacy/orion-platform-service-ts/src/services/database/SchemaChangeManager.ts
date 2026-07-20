/**
 * 数据库 Schema 变更管理服务
 *
 * 功能：
 * 1. Schema 变更版本控制
 * 2. 变更审批工作流
 * 3. 变更回滚支持
 * 4. 变更执行与日志
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

/** 变更类型 */
export enum ChangeType {
  CREATE_TABLE = 'create_table',
  DROP_TABLE = 'drop_table',
  ALTER_TABLE = 'alter_table',
  CREATE_INDEX = 'create_index',
  DROP_INDEX = 'drop_index',
  ADD_COLUMN = 'add_column',
  DROP_COLUMN = 'drop_column',
  MODIFY_COLUMN = 'modify_column',
  RENAME_COLUMN = 'rename_column',
  CREATE_VIEW = 'create_view',
  DROP_VIEW = 'drop_view',
  OTHER = 'other',
}

/** 变更状态 */
export enum ChangeStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXECUTING = 'executing',
  EXECUTED = 'executed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

/** 变更风险级别 */
export enum ChangeRiskLevel {
  LOW = 'low',           // CREATE INDEX, ADD COLUMN
  MEDIUM = 'medium',     // MODIFY COLUMN, ALTER TABLE
  HIGH = 'high',         // DROP COLUMN, RENAME
  CRITICAL = 'critical', // DROP TABLE, TRUNCATE
}

/** Schema 变更记录 */
export interface SchemaChange {
  id: string;
  version: string;
  database: string;
  tableName: string;
  changeType: ChangeType;
  riskLevel: ChangeRiskLevel;
  status: ChangeStatus;
  title: string;
  description: string;
  sql: string;
  rollbackSql?: string;
  createdAt: Date;
  createdBy: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewComment?: string;
  executedAt?: Date;
  executionDuration?: number;
  executionLog?: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

/** 变更创建请求 */
export interface CreateChangeRequest {
  database: string;
  tableName: string;
  changeType: ChangeType;
  title: string;
  description: string;
  sql: string;
  rollbackSql?: string;
  createdBy: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** 变更审批请求 */
export interface ReviewRequest {
  changeId: string;
  approved: boolean;
  reviewedBy: string;
  comment: string;
}

/** 变更执行结果 */
export interface ExecutionResult {
  success: boolean;
  changeId: string;
  duration: number;
  log: string;
  error?: string;
}

/** 变更查询参数 */
export interface ChangeQuery {
  database?: string;
  tableName?: string;
  status?: ChangeStatus;
  changeType?: ChangeType;
  riskLevel?: ChangeRiskLevel;
  since?: Date;
  until?: Date;
  createdBy?: string;
  limit?: number;
}

/** 变更统计 */
export interface ChangeStats {
  total: number;
  byStatus: Record<ChangeStatus, number>;
  byType: Record<ChangeType, number>;
  byRiskLevel: Record<ChangeRiskLevel, number>;
  averageExecutionTime: number;
  successRate: number;
  rollbackRate: number;
}

/** Schema 版本 */
export interface SchemaVersion {
  version: string;
  database: string;
  appliedAt: Date;
  changes: string[];  // change IDs
  checksum: string;
}

/** Schema 变更管理配置 */
export interface SchemaChangeManagerConfig {
  /** 是否启用自动风险评估 */
  enableAutoRiskAssessment: boolean;
  /** 是否要求审批 */
  requireReview: boolean;
  /** 高风险变更需要的审批人数 */
  highRiskReviewers: number;
  /** 是否自动执行已批准的变更 */
  autoExecute: boolean;
  /** 执行超时时间（毫秒） */
  executionTimeout: number;
}

const DEFAULT_CONFIG: SchemaChangeManagerConfig = {
  enableAutoRiskAssessment: true,
  requireReview: true,
  highRiskReviewers: 2,
  autoExecute: false,
  executionTimeout: 300000, // 5 分钟
};

// ==================== 服务实现 ====================

/**
 * Schema 变更管理服务
 */
export class SchemaChangeManager extends EventEmitter {
  private config: SchemaChangeManagerConfig;
  private changes: Map<string, SchemaChange> = new Map();
  private versions: Map<string, SchemaVersion[]> = new Map(); // database -> versions

  constructor(config: Partial<SchemaChangeManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 创建变更
   */
  createChange(request: CreateChangeRequest): SchemaChange {
    const changeType = request.changeType;
    const riskLevel = this.config.enableAutoRiskAssessment
      ? this.assessRisk(changeType, request.sql)
      : ChangeRiskLevel.LOW;

    const id = `chg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const version = this.generateVersion(request.database);

    const change: SchemaChange = {
      id,
      version,
      database: request.database,
      tableName: request.tableName,
      changeType,
      riskLevel,
      status: this.config.requireReview ? ChangeStatus.PENDING_REVIEW : ChangeStatus.APPROVED,
      title: request.title,
      description: request.description,
      sql: request.sql,
      rollbackSql: request.rollbackSql,
      createdAt: new Date(),
      createdBy: request.createdBy,
      tags: request.tags || [],
      metadata: request.metadata || {},
    };

    this.changes.set(id, change);
    this.emit('change-created', change);

    return change;
  }

  /**
   * 审批变更
   */
  reviewChange(request: ReviewRequest): SchemaChange {
    const change = this.changes.get(request.changeId);
    if (!change) {
      throw new Error(`Change ${request.changeId} not found`);
    }

    if (change.status !== ChangeStatus.PENDING_REVIEW) {
      throw new Error(`Change ${request.changeId} is not in pending review status`);
    }

    change.reviewedAt = new Date();
    change.reviewedBy = request.reviewedBy;
    change.reviewComment = request.comment;

    if (request.approved) {
      change.status = ChangeStatus.APPROVED;
      this.emit('change-approved', change);

      // 自动执行
      if (this.config.autoExecute) {
        this.executeChange(change.id);
      }
    } else {
      change.status = ChangeStatus.REJECTED;
      this.emit('change-rejected', change);
    }

    return change;
  }

  /**
   * 执行变更
   */
  async executeChange(changeId: string): Promise<ExecutionResult> {
    const change = this.changes.get(changeId);
    if (!change) {
      throw new Error(`Change ${changeId} not found`);
    }

    if (change.status !== ChangeStatus.APPROVED) {
      throw new Error(`Change ${changeId} is not approved`);
    }

    change.status = ChangeStatus.EXECUTING;
    this.emit('change-executing', change);

    const startTime = Date.now();

    try {
      // 模拟执行（实际应连接数据库执行 SQL）
      await this.simulateExecution(change.sql);

      const duration = Date.now() - startTime;
      change.status = ChangeStatus.EXECUTED;
      change.executedAt = new Date();
      change.executionDuration = duration;
      change.executionLog = `Successfully executed in ${duration}ms`;

      // 记录版本
      this.recordVersion(change);

      this.emit('change-executed', change);

      return {
        success: true,
        changeId,
        duration,
        log: change.executionLog,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      change.status = ChangeStatus.FAILED;
      change.executionDuration = duration;
      change.executionLog = `Execution failed: ${error.message}`;

      this.emit('change-failed', change);

      return {
        success: false,
        changeId,
        duration,
        log: change.executionLog,
        error: error.message,
      };
    }
  }

  /**
   * 回滚变更
   */
  async rollbackChange(changeId: string): Promise<ExecutionResult> {
    const change = this.changes.get(changeId);
    if (!change) {
      throw new Error(`Change ${changeId} not found`);
    }

    if (!change.rollbackSql) {
      throw new Error(`Change ${changeId} has no rollback SQL`);
    }

    if (change.status !== ChangeStatus.EXECUTED) {
      throw new Error(`Change ${changeId} has not been executed`);
    }

    const startTime = Date.now();

    try {
      await this.simulateExecution(change.rollbackSql);

      const duration = Date.now() - startTime;
      change.status = ChangeStatus.ROLLED_BACK;

      this.emit('change-rolled-back', change);

      return {
        success: true,
        changeId,
        duration,
        log: `Rolled back successfully in ${duration}ms`,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        changeId,
        duration,
        log: `Rollback failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * 获取变更详情
   */
  getChange(changeId: string): SchemaChange | undefined {
    return this.changes.get(changeId);
  }

  /**
   * 查询变更列表
   */
  queryChanges(query: ChangeQuery = {}): SchemaChange[] {
    let results = Array.from(this.changes.values());

    if (query.database) {
      results = results.filter((c) => c.database === query.database);
    }
    if (query.tableName) {
      results = results.filter((c) => c.tableName === query.tableName);
    }
    if (query.status) {
      results = results.filter((c) => c.status === query.status);
    }
    if (query.changeType) {
      results = results.filter((c) => c.changeType === query.changeType);
    }
    if (query.riskLevel) {
      results = results.filter((c) => c.riskLevel === query.riskLevel);
    }
    if (query.since) {
      results = results.filter((c) => c.createdAt >= query.since!);
    }
    if (query.until) {
      results = results.filter((c) => c.createdAt <= query.until!);
    }
    if (query.createdBy) {
      results = results.filter((c) => c.createdBy === query.createdBy);
    }

    // 按创建时间倒序
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * 获取数据库版本历史
   */
  getVersionHistory(database: string): SchemaVersion[] {
    return this.versions.get(database) || [];
  }

  /**
   * 获取当前版本
   */
  getCurrentVersion(database: string): SchemaVersion | undefined {
    const versions = this.versions.get(database);
    return versions?.[versions.length - 1];
  }

  /**
   * 获取统计信息
   */
  getStats(): ChangeStats {
    const all = Array.from(this.changes.values());
    const total = all.length;

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};

    for (const change of all) {
      byStatus[change.status] = (byStatus[change.status] || 0) + 1;
      byType[change.changeType] = (byType[change.changeType] || 0) + 1;
      byRiskLevel[change.riskLevel] = (byRiskLevel[change.riskLevel] || 0) + 1;
    }

    const executed = all.filter((c) => c.status === ChangeStatus.EXECUTED);
    const failed = all.filter((c) => c.status === ChangeStatus.FAILED);
    const rolledBack = all.filter((c) => c.status === ChangeStatus.ROLLED_BACK);

    const avgExecTime = executed.length > 0
      ? executed.reduce((sum, c) => sum + (c.executionDuration || 0), 0) / executed.length
      : 0;

    const totalExecuted = executed.length + failed.length;
    const successRate = totalExecuted > 0 ? (executed.length / totalExecuted) * 100 : 0;
    const rollbackRate = executed.length > 0 ? (rolledBack.length / executed.length) * 100 : 0;

    return {
      total,
      byStatus: byStatus as Record<ChangeStatus, number>,
      byType: byType as Record<ChangeType, number>,
      byRiskLevel: byRiskLevel as Record<ChangeRiskLevel, number>,
      averageExecutionTime: Math.round(avgExecTime),
      successRate: Math.round(successRate * 100) / 100,
      rollbackRate: Math.round(rollbackRate * 100) / 100,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<SchemaChangeManagerConfig>): void {
    Object.assign(this.config, updates);
  }

  // ==================== 内部方法 ====================

  /**
   * 评估变更风险
   */
  private assessRisk(changeType: ChangeType, sql: string): ChangeRiskLevel {
    switch (changeType) {
      case ChangeType.DROP_TABLE:
        return ChangeRiskLevel.CRITICAL;
      case ChangeType.DROP_COLUMN:
      case ChangeType.DROP_INDEX:
        return ChangeRiskLevel.HIGH;
      case ChangeType.ALTER_TABLE:
      case ChangeType.MODIFY_COLUMN:
      case ChangeType.RENAME_COLUMN:
        return ChangeRiskLevel.MEDIUM;
      case ChangeType.CREATE_TABLE:
      case ChangeType.CREATE_INDEX:
      case ChangeType.ADD_COLUMN:
      case ChangeType.CREATE_VIEW:
        return ChangeRiskLevel.LOW;
      default:
        // 基于 SQL 内容判断
        const upper = sql.toUpperCase();
        if (upper.includes('DROP')) return ChangeRiskLevel.HIGH;
        if (upper.includes('ALTER')) return ChangeRiskLevel.MEDIUM;
        return ChangeRiskLevel.LOW;
    }
  }

  /**
   * 生成版本号
   */
  private generateVersion(database: string): string {
    const versions = this.versions.get(database) || [];
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const seq = String(versions.length + 1).padStart(4, '0');
    return `v${datePart}.${seq}`;
  }

  /**
   * 记录版本
   */
  private recordVersion(change: SchemaChange): void {
    const versions = this.versions.get(change.database) || [];
    const version: SchemaVersion = {
      version: change.version,
      database: change.database,
      appliedAt: new Date(),
      changes: [change.id],
      checksum: this.computeChecksum(change.sql),
    };
    versions.push(version);
    this.versions.set(change.database, versions);
  }

  /**
   * 计算校验和
   */
  private computeChecksum(sql: string): string {
    let hash = 0;
    for (let i = 0; i < sql.length; i++) {
      hash = ((hash << 5) - hash) + sql.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 模拟 SQL 执行
   */
  private simulateExecution(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 模拟执行时间
      const duration = Math.random() * 2000 + 500;
      setTimeout(() => {
        // 模拟 5% 失败率
        if (Math.random() < 0.05) {
          reject(new Error('Simulated execution error: connection timeout'));
        } else {
          resolve();
        }
      }, duration);
    });
  }
}
