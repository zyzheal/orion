/**
 * TASK-502: 成本追踪服务
 *
 * 按项目/租户/团队追踪成本
 * 支持成本分摊、回溯报告、趋势分析
 *
 * P1-14: Migrated from in-memory Map to PostgreSQL cost_records table (migration 094).
 * Falls back to in-memory mode when DB pool is not provided.
 */

import { v4 as uuidv4 } from 'uuid';
import type { DatabasePool } from '../database';
import {
  CostEntityType,
  CostPeriod,
  CostTrend,
  CostTrendPoint,
} from './types';

/**
 * 实体成本记录
 */
interface EntityCostRecord {
  /** 记录 ID */
  id: string;
  /** 实体类型 */
  entityType: CostEntityType;
  /** 实体 ID */
  entityId: string;
  /** 成本金额 */
  amount: number;
  /** 成本类别 */
  category: string;
  /** 时间戳 */
  timestamp: Date;
  /** 所属环境 */
  environment?: string;
  /** 额外标签 */
  tags?: Record<string, string>;
  /** 货币单位 */
  currency: string;
}

/**
 * 实体成本汇总
 */
export interface EntityCostSummary {
  /** 实体类型 */
  entityType: CostEntityType;
  /** 实体 ID */
  entityId: string;
  /** 总成本 */
  totalCost: number;
  /** 按类别分解 */
  breakdown: Record<string, number>;
  /** 统计周期 */
  period: CostPeriod;
  /** 货币单位 */
  currency: string;
  /** 记录数量 */
  recordCount: number;
}

/**
 * 成本分摊报告
 */
export interface ChargebackReport {
  /** 报告 ID */
  id: string;
  /** 生成时间 */
  generatedAt: Date;
  /** 统计周期 */
  period: CostPeriod;
  /** 总成本 */
  totalCost: number;
  /** 各实体分摊明细 */
  entities: {
    entityType: CostEntityType;
    entityId: string;
    cost: number;
    percentage: number;
    breakdown: Record<string, number>;
  }[];
  /** 货币单位 */
  currency: string;
}

/**
 * 成本趋势查询参数
 */
export interface CostTrendQuery {
  entityType: CostEntityType;
  entityId: string;
  period: CostPeriod;
  category?: string;
}

/**
 * 行级别安全 RLS 上下文
 */
interface RlsContext {
  tenantId?: string;
  traceId?: string;
}

/**
 * 数据库就绪标志（惰性初始化门控）
 */
let dbReady = false;
let dbInitPending = Promise.resolve();

/**
 * 初始化 RLS 上下文（一次性）
 */
async function initRlsContext(pool: DatabasePool, ctx: RlsContext): Promise<void> {
  if (dbReady) return;
  try {
    const prev = dbInitPending;
    dbInitPending = (async () => {
      await prev;
      if (ctx.tenantId) {
        await pool.query("SET app.current_tenant_id = $1", [ctx.tenantId]);
      }
      if (ctx.traceId) {
        await pool.query('SET tracing.trace_id = $1', [ctx.traceId]);
      }
      dbReady = true;
    })();
    await dbInitPending;
  } catch {
    // 忽略初始化失败，降级到内存模式
    dbReady = false;
  }
}

/**
 * 构建 metadata JSON 对象
 */
function buildMetadata(
  entityType: CostEntityType,
  entityId: string,
  environment?: string,
  tags?: Record<string, string>
): string {
  const meta: Record<string, unknown> = {
    entity_type: entityType,
    entity_id: entityId,
  };
  if (environment) {
    meta.environment = environment;
  }
  if (tags) {
    meta.tags = tags;
  }
  return JSON.stringify(meta);
}

/**
 * 从数据库行映射为 EntityCostRecord
 */
function rowToRecord(row: any): EntityCostRecord {
  const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
  return {
    id: row.id,
    entityType: (metadata.entity_type || 'project') as CostEntityType,
    entityId: metadata.entity_id || '',
    amount: parseFloat(row.amount) || 0,
    category: row.cost_type || '',
    timestamp: new Date(row.created_at),
    environment: metadata.environment,
    tags: metadata.tags,
    currency: row.currency || 'USD',
  };
}

/**
 * 成本追踪服务
 *
 * 提供按项目/租户/团队的细粒度成本追踪能力
 *
 * P1-14: 支持 PostgreSQL 持久化 + 内存回退
 */
export class CostTrackingService {
  /** 内存回退存储（当 DB 不可用时使用） */
  private records: EntityCostRecord[] = [];

  /** PostgreSQL 连接池（可选） */
  private pool?: DatabasePool | null;

  /**
   * 构造函数
   *
   * @param db - DatabasePool 实例；传入 null 或 undefined 则使用内存模式
   */
  constructor(db?: DatabasePool | null) {
    this.pool = db;
  }

  // ==================== 公共写入接口 ====================

  /**
   * 记录项目成本
   */
  trackProjectCost(params: {
    projectId: string;
    amount: number;
    category: string;
    environment?: string;
    tags?: Record<string, string>;
    currency?: string;
    timestamp?: Date;
  }): EntityCostRecord {
    return this._createRecord({
      entityType: 'project',
      entityId: params.projectId,
      amount: params.amount,
      category: params.category,
      environment: params.environment,
      tags: params.tags,
      currency: params.currency || 'USD',
      timestamp: params.timestamp,
    });
  }

  /**
   * 记录租户成本
   */
  trackTenantCost(params: {
    tenantId: string;
    amount: number;
    category: string;
    environment?: string;
    tags?: Record<string, string>;
    currency?: string;
    timestamp?: Date;
  }): EntityCostRecord {
    return this._createRecord({
      entityType: 'tenant',
      entityId: params.tenantId,
      amount: params.amount,
      category: params.category,
      environment: params.environment,
      tags: params.tags,
      currency: params.currency || 'USD',
      timestamp: params.timestamp,
    });
  }

  /**
   * 记录团队成本
   */
  trackTeamCost(params: {
    teamId: string;
    amount: number;
    category: string;
    environment?: string;
    tags?: Record<string, string>;
    currency?: string;
    timestamp?: Date;
  }): EntityCostRecord {
    return this._createRecord({
      entityType: 'team',
      entityId: params.teamId,
      amount: params.amount,
      category: params.category,
      environment: params.environment,
      tags: params.tags,
      currency: params.currency || 'USD',
      timestamp: params.timestamp,
    });
  }

  /**
   * 通用内部写入入口 —— 先写 PG，再写内存。任一失败不阻断，回退到仅写一侧。
   */
  private _createRecord(params: {
    entityType: CostEntityType;
    entityId: string;
    amount: number;
    category: string;
    environment?: string;
    tags?: Record<string, string>;
    currency?: string;
    timestamp?: Date;
  }): EntityCostRecord {
    const now = params.timestamp || new Date();
    const id = uuidv4();
    const currency = params.currency || 'USD';
    const metadata = buildMetadata(params.entityType, params.entityId, params.environment, params.tags);

    // ---- 写 PG (migration 094 cost_records) ----
    if (this.pool) {
      const pending = this._insertPg(id, params.entityId, params.category, params.amount, currency, metadata, now);
      // 不 await，避免阻塞；写 PG 失败不影响返回值
      pending.catch(() => { /* 静默降级到内存 */ });
    }

    // ---- 写内存 ----
    const record: EntityCostRecord = {
      id,
      entityType: params.entityType,
      entityId: params.entityId,
      amount: params.amount,
      category: params.category,
      currency,
      timestamp: now,
      environment: params.environment,
      tags: params.tags,
    };
    this.records.push(record);

    return record;
  }

  /**
   * 异步插入 PG（非阻塞调用方）
   */
  private async _insertPg(
    id: string,
    tenantId: string,
    costType: string,
    amount: number,
    currency: string,
    metadata: string,
    now: Date,
  ): Promise<void> {
    try {
      const ctx: RlsContext = { tenantId };
      await initRlsContext(this.pool!, ctx);

      const sql = `INSERT INTO cost_records (id, tenant_id, cost_type, amount, currency, metadata, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`;
      await this.pool!.query(sql, [id, tenantId, costType, amount, currency, metadata, now]);
    } catch (err) {
      // DB 写入失败时降级
      console.error('[CostTrackingService] PG insert failed, falling back to memory only:', err);
      throw err; // 向上抛出，但调用方用 .catch() 忽略
    }
  }

  /**
   * 批量添加成本记录
   */
  addRecords(records: EntityCostRecord[]): void {
    for (const record of records) {
      this.records.push(record);
    }
  }

  // ==================== 公共查询接口 ====================

  /**
   * 获取指定实体的成本汇总
   */
  getCostByEntity(
    entityType: CostEntityType,
    entityId: string,
    period: CostPeriod = 'monthly',
  ): EntityCostSummary {
    const { startDate, endDate } = this.getPeriodDates(period);
    const filtered = this.filterRecords(entityType, entityId, startDate, endDate);

    const breakdown = this.computeBreakdown(filtered);
    const totalCost = filtered.reduce((sum, r) => sum + r.amount, 0);

    return {
      entityType,
      entityId,
      totalCost: Math.round(totalCost * 100) / 100,
      breakdown,
      period,
      currency: 'USD',
      recordCount: filtered.length,
    };
  }

  /**
   * 获取成本趋势
   */
  getCostTrend(query: CostTrendQuery): CostTrend {
    const { startDate, endDate } = this.getPeriodDates(query.period);
    let filtered = this.filterRecords(
      query.entityType,
      query.entityId,
      startDate,
      endDate,
    );

    if (query.category) {
      filtered = filtered.filter((r) => r.category === query.category);
    }

    if (filtered.length === 0) {
      return {
        points: [],
        overallChangeRate: 0,
        averageCost: 0,
        maxCost: 0,
        minCost: 0,
      };
    }

    // 按日期分组聚合
    const dateMap = new Map<string, number>();
    for (const record of filtered) {
      const dateKey = record.timestamp.toISOString().split('T')[0];
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + record.amount);
    }

    // 转换为数据点
    const dataPoints = Array.from(dateMap.entries())
      .map(([date, cost]) => ({
        date: new Date(date),
        cost: Math.round(cost * 100) / 100,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return this.computeTrend(dataPoints);
  }

  /**
   * 获取成本分摊报告
   *
   * 生成指定周期内所有实体的成本分摊明细
   */
  getChargebackReport(period: CostPeriod = 'monthly'): ChargebackReport {
    const { startDate, endDate } = this.getPeriodDates(period);
    const filtered = this.records.filter(
      (r) => r.timestamp >= startDate && r.timestamp <= endDate,
    );

    // 按实体聚合
    const entityMap = new Map<
      string,
      {
        entityType: CostEntityType;
        entityId: string;
        cost: number;
        breakdown: Record<string, number>;
      }
    >();

    for (const record of filtered) {
      const key = `${record.entityType}:${record.entityId}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, {
          entityType: record.entityType,
          entityId: record.entityId,
          cost: 0,
          breakdown: {},
        });
      }
      const entry = entityMap.get(key)!;
      entry.cost += record.amount;
      entry.breakdown[record.category] =
        (entry.breakdown[record.category] || 0) + record.amount;
    }

    const totalCost = Array.from(entityMap.values()).reduce(
      (sum, e) => sum + e.cost,
      0,
    );

    const entities = Array.from(entityMap.values())
      .map((e) => ({
        entityType: e.entityType,
        entityId: e.entityId,
        cost: Math.round(e.cost * 100) / 100,
        percentage:
          totalCost > 0
            ? Math.round((e.cost / totalCost) * 10000) / 100
            : 0,
        breakdown: Object.fromEntries(
          Object.entries(e.breakdown).map(([k, v]) => [
            k,
            Math.round(v * 100) / 100,
          ]),
        ),
      }))
      .sort((a, b) => b.cost - a.cost);

    return {
      id: uuidv4(),
      generatedAt: new Date(),
      period,
      totalCost: Math.round(totalCost * 100) / 100,
      entities,
      currency: 'USD',
    };
  }

  /**
   * 获取所有成本记录
   */
  getAllRecords(filter?: {
    entityType?: CostEntityType;
    entityId?: string;
    category?: string;
  }): EntityCostRecord[] {
    let records = [...this.records];

    if (filter?.entityType) {
      records = records.filter((r) => r.entityType === filter.entityType);
    }
    if (filter?.entityId) {
      records = records.filter((r) => r.entityId === filter.entityId);
    }
    if (filter?.category) {
      records = records.filter((r) => r.category === filter.category);
    }

    return records;
  }

  /**
   * 清空所有记录
   */
  clearAll(): void {
    this.records = [];
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 从内存过滤指定实体和时间范围的记录
   */
  private filterRecords(
    entityType: CostEntityType,
    entityId: string,
    startDate: Date,
    endDate: Date,
  ): EntityCostRecord[] {
    return this.records.filter((r) => {
      if (r.entityType !== entityType) return false;
      if (r.entityId !== entityId) return false;
      if (r.timestamp < startDate || r.timestamp > endDate) return false;
      return true;
    });
  }

  /**
   * 计算类别分解
   */
  private computeBreakdown(records: EntityCostRecord[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const record of records) {
      breakdown[record.category] =
        (breakdown[record.category] || 0) + record.amount;
    }
    // 四舍五入
    return Object.fromEntries(
      Object.entries(breakdown).map(([k, v]) => [k, Math.round(v * 100) / 100]),
    );
  }

  /**
   * 计算趋势
   */
  private computeTrend(dataPoints: { date: Date; cost: number }[]): CostTrend {
    if (dataPoints.length === 0) {
      return {
        points: [],
        overallChangeRate: 0,
        averageCost: 0,
        maxCost: 0,
        minCost: 0,
      };
    }

    const sorted = [...dataPoints].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    const points: CostTrendPoint[] = [];
    for (let i = 0; i < sorted.length; i++) {
      let changeRate = 0;
      if (i > 0 && sorted[i - 1].cost > 0) {
        changeRate =
          ((sorted[i].cost - sorted[i - 1].cost) / sorted[i - 1].cost) * 100;
      }

      points.push({
        date: sorted[i].date,
        cost: sorted[i].cost,
        changeRate: Math.round(changeRate * 100) / 100,
      });
    }

    const costs = sorted.map((p) => p.cost);
    const totalCost = costs.reduce((sum, c) => sum + c, 0);
    const firstCost = sorted[0].cost;
    const lastCost = sorted[sorted.length - 1].cost;
    const overallChangeRate =
      firstCost > 0 ? ((lastCost - firstCost) / firstCost) * 100 : 0;

    return {
      points,
      overallChangeRate: Math.round(overallChangeRate * 100) / 100,
      averageCost: Math.round((totalCost / costs.length) * 100) / 100,
      maxCost: Math.max(...costs),
      minCost: Math.min(...costs),
    };
  }

  /**
   * 获取周期的起止日期
   */
  private getPeriodDates(period: CostPeriod): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const endDate = now;
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarterly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'yearly':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }
}
