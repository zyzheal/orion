/**
 * CostBudgetGuardService - 预算门禁服务
 *
 * Phase 2: 在 Pipeline 执行前评估预估成本是否超出预算，
 * 提供成本门禁功能，阻止超预算的 Pipeline 执行。
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../../services/database';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export enum BudgetGuardAction {
  ALLOW = 'allow',
  BLOCK = 'block',
  WARN = 'warn',
}

export enum BudgetGuardStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface BudgetGuardInput {
  name: string;
  description?: string;
  budgetAmount: number;
  currency?: string;
  action: BudgetGuardAction;
  scope?: {
    projectIds?: string[];
    environment?: string;
  };
}

export interface BudgetGuard {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  budgetAmount: number;
  currency: string;
  action: BudgetGuardAction;
  scope: { projectIds: string[]; environment: string | null } | null;
  status: BudgetGuardStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvaluationResult {
  passed: boolean;
  action: BudgetGuardAction;
  estimatedCost: number;
  budgetAmount: number;
  usagePercent: number;
  matchedGuard: BudgetGuard | null;
  message: string;
  evaluatedAt: Date;
}

export class CostBudgetGuardService {
  private db: DatabasePool;

  constructor(db: DatabasePool) {
    this.db = db;
    this.ensureTable();
  }

  /**
   * 创建预算门禁
   */
  async createBudgetGuard(
    tenantId: string,
    input: BudgetGuardInput,
  ): Promise<BudgetGuard> {
    const id = `budget_guard_${uuidv4()}`;
    const now = new Date();
    const scope = input.scope
      ? JSON.stringify({
          projectIds: input.scope.projectIds || [],
          environment: input.scope.environment || null,
        })
      : null;

    await this.db.query(
      `INSERT INTO budget_guards (id, tenant_id, name, description, budget_amount, currency, action, scope, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        tenantId,
        input.name,
        input.description || null,
        input.budgetAmount,
        input.currency || 'USD',
        input.action,
        scope,
        BudgetGuardStatus.ACTIVE,
        now,
        now,
      ],
    );

    const guard: BudgetGuard = {
      id,
      tenantId,
      name: input.name,
      description: input.description || null,
      budgetAmount: input.budgetAmount,
      currency: input.currency || 'USD',
      action: input.action,
      scope: input.scope
        ? {
            projectIds: input.scope.projectIds || [],
            environment: input.scope.environment || null,
          }
        : null,
      status: BudgetGuardStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    };

    logger.info({ guardId: id, tenantId, budgetAmount: input.budgetAmount }, 'Budget guard created');
    return guard;
  }

  /**
   * 评估成本是否超预算
   * 返回评估结果，包含是否通过、建议动作、匹配的门禁等
   */
  async evaluateCostGuard(
    pipelineId: string,
    estimatedCost: number,
    options?: { tenantId?: string; projectId?: string; environment?: string },
  ): Promise<EvaluationResult> {
    const tenantId = options?.tenantId || 'default';

    // Get all active guards for this tenant
    const guards = await this.getBudgetGuards(tenantId);
    const activeGuards = guards.filter(g => g.status === BudgetGuardStatus.ACTIVE);

    if (activeGuards.length === 0) {
      return {
        passed: true,
        action: BudgetGuardAction.ALLOW,
        estimatedCost,
        budgetAmount: 0,
        usagePercent: 0,
        matchedGuard: null,
        message: 'No active budget guards configured',
        evaluatedAt: new Date(),
      };
    }

    // Find the most applicable guard
    let matchedGuard: BudgetGuard | null = null;
    for (const guard of activeGuards) {
      if (!guard.scope) {
        matchedGuard = guard;
        break;
      }
      // Check scope match
      if (options?.projectId && guard.scope.projectIds.length > 0) {
        if (guard.scope.projectIds.includes(options.projectId)) {
          matchedGuard = guard;
          break;
        }
      }
      if (options?.environment && guard.scope.environment) {
        if (guard.scope.environment === options.environment) {
          matchedGuard = guard;
          break;
        }
      }
    }

    // Fallback to first active guard
    if (!matchedGuard && activeGuards.length > 0) {
      matchedGuard = activeGuards[0];
    }

    if (!matchedGuard) {
      return {
        passed: true,
        action: BudgetGuardAction.ALLOW,
        estimatedCost,
        budgetAmount: 0,
        usagePercent: 0,
        matchedGuard: null,
        message: 'No applicable budget guards found',
        evaluatedAt: new Date(),
      };
    }

    const usagePercent = matchedGuard.budgetAmount > 0
      ? (estimatedCost / matchedGuard.budgetAmount) * 100
      : 0;

    let passed = true;
    let action = matchedGuard.action;

    if (estimatedCost > matchedGuard.budgetAmount) {
      passed = false;
      if (matchedGuard.action === BudgetGuardAction.BLOCK) {
        action = BudgetGuardAction.BLOCK;
      } else if (matchedGuard.action === BudgetGuardAction.WARN) {
        action = BudgetGuardAction.WARN;
      }
    }

    const message = passed
      ? `Estimated cost $${estimatedCost.toFixed(2)} is within budget $${matchedGuard.budgetAmount.toFixed(2)} (${usagePercent.toFixed(1)}%)`
      : `Estimated cost $${estimatedCost.toFixed(2)} exceeds budget $${matchedGuard.budgetAmount.toFixed(2)} (${usagePercent.toFixed(1)}%) - ${action.toUpperCase()}`;

    // Log the evaluation
    await this.logEvaluation({
      id: uuidv4(),
      tenantId,
      pipelineId,
      guardId: matchedGuard.id,
      estimatedCost,
      budgetAmount: matchedGuard.budgetAmount,
      usagePercent: Math.round(usagePercent * 100) / 100,
      passed,
      action,
      evaluatedAt: new Date(),
    });

    return {
      passed,
      action,
      estimatedCost,
      budgetAmount: matchedGuard.budgetAmount,
      usagePercent: Math.round(usagePercent * 100) / 100,
      matchedGuard,
      message,
      evaluatedAt: new Date(),
    };
  }

  /**
   * 获取预算门禁列表
   */
  async getBudgetGuards(tenantId: string): Promise<BudgetGuard[]> {
    const result = await this.db.query(
      `SELECT * FROM budget_guards WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );

    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      budgetAmount: row.budget_amount,
      currency: row.currency,
      action: row.action,
      scope: row.scope ? (typeof row.scope === 'string' ? JSON.parse(row.scope) : row.scope) : null,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * 删除预算门禁
   */
  async deleteBudgetGuard(guardId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM budget_guards WHERE id = $1 AND tenant_id = $2`,
      [guardId, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Private Helpers ====================

  private async logEvaluation(eval_: {
    id: string;
    tenantId: string;
    pipelineId: string;
    guardId: string;
    estimatedCost: number;
    budgetAmount: number;
    usagePercent: number;
    passed: boolean;
    action: string;
    evaluatedAt: Date;
  }): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO budget_guard_evaluations (id, tenant_id, pipeline_id, guard_id, estimated_cost, budget_amount, usage_percent, passed, action, evaluated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          eval_.id,
          eval_.tenantId,
          eval_.pipelineId,
          eval_.guardId,
          eval_.estimatedCost,
          eval_.budgetAmount,
          eval_.usagePercent,
          eval_.passed,
          eval_.action,
          eval_.evaluatedAt,
        ],
      );
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Failed to log budget guard evaluation');
    }
  }

  private async ensureTable(): Promise<void> {
    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS budget_guards (
          id VARCHAR(64) PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          budget_amount NUMERIC(12, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'USD',
          action VARCHAR(20) NOT NULL DEFAULT 'warn',
          scope JSONB,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS budget_guard_evaluations (
          id VARCHAR(64) PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL,
          pipeline_id VARCHAR(64) NOT NULL,
          guard_id VARCHAR(64) NOT NULL,
          estimated_cost NUMERIC(12, 2) NOT NULL,
          budget_amount NUMERIC(12, 2) NOT NULL,
          usage_percent NUMERIC(8, 2) NOT NULL,
          passed BOOLEAN NOT NULL,
          action VARCHAR(20) NOT NULL,
          evaluated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      logger.info('budget_guards tables ensured');
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Could not ensure budget_guards tables (may need migration)');
    }
  }
}
