import { DatabasePool } from '../database';
/**
 * PipelineBudgetService - Execution budget management for pipelines
 *
 * Handles budget configuration, estimation, and real-time usage tracking.
 */

export interface BudgetConfig {
  timeBudget?: {
    maxDurationMs: number;
    warningPercent: number;
    policy: 'warn' | 'block' | 'rollback';
  };
  resourceBudget?: {
    maxCpuCoreHours: number;
    maxMemoryGBHours: number;
    warningPercent: number;
    policy: 'warn' | 'block' | 'rollback';
  };
  costBudget?: {
    maxCostCents: number;
    warningPercent: number;
    policy: 'warn' | 'block' | 'rollback';
  };
  updatedAt: Date;
}

export interface BudgetUsage {
  timeUsed: number;
  timePercent: number;
  cpuUsed: number;
  cpuPercent: number;
  memoryUsed: number;
  memoryPercent: number;
  costUsed: number;
  costPercent: number;
  alerts: BudgetAlert[];
}

export interface BudgetAlert {
  type: 'time' | 'cpu' | 'memory' | 'cost';
  level: 'warning' | 'critical';
  message: string;
  triggeredAt: Date;
}

export interface BudgetEstimate {
  estimatedTimeMs: number;
  estimatedCpuCores: number;
  estimatedMemoryGB: number;
  estimatedCost: number;
  confidence: number; // 0-1
}

export interface CreateBudgetInput {
  pipelineId: string;
  maxDurationMs?: number;
  timeWarningPct?: number;
  timePolicy?: 'warn' | 'block' | 'rollback';
  maxCpuCoreHours?: number;
  maxMemoryGBHours?: number;
  resourceWarningPct?: number;
  resourcePolicy?: 'warn' | 'block' | 'rollback';
  maxCostCents?: number;
  costWarningPct?: number;
  costPolicy?: 'warn' | 'block' | 'rollback';
}

export class PipelineBudgetService {

  constructor(private pool: DatabasePool) {}

  // ==================== Budget Configuration ====================

  /**
   * Get budget config for a pipeline
   */
  async getBudget(pipelineId: string): Promise<BudgetConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_budgets WHERE pipeline_id = $1',
      [pipelineId]
    );
    if (!result.rows[0]) return null;
    return this.mapBudgetConfig(result.rows[0]);
  }

  /**
   * Update budget config for a pipeline
   */
  async updateBudget(pipelineId: string, input: CreateBudgetInput): Promise<BudgetConfig> {
    const existing = await this.getBudget(pipelineId);

    if (existing) {
      const result = await this.pool.query(
        `UPDATE pipeline_budgets SET
          max_duration_ms = $2, time_warning_pct = $3, time_policy = $4,
          max_cpu_core_hours = $5, max_memory_gb_hours = $6,
          resource_warning_pct = $7, resource_policy = $8,
          max_cost_cents = $9, cost_warning_pct = $10, cost_policy = $11,
          updated_at = NOW()
         WHERE pipeline_id = $1
         RETURNING *`,
        [
          pipelineId,
          input.maxDurationMs || null,
          input.timeWarningPct || 80,
          input.timePolicy || 'warn',
          input.maxCpuCoreHours || null,
          input.maxMemoryGBHours || null,
          input.resourceWarningPct || 80,
          input.resourcePolicy || 'warn',
          input.maxCostCents || null,
          input.costWarningPct || 80,
          input.costPolicy || 'warn',
        ]
      );
      return this.mapBudgetConfig(result.rows[0]);
    }

    const result = await this.pool.query(
      `INSERT INTO pipeline_budgets
        (pipeline_id, max_duration_ms, time_warning_pct, time_policy,
         max_cpu_core_hours, max_memory_gb_hours, resource_warning_pct, resource_policy,
         max_cost_cents, cost_warning_pct, cost_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        pipelineId,
        input.maxDurationMs || null,
        input.timeWarningPct || 80,
        input.timePolicy || 'warn',
        input.maxCpuCoreHours || null,
        input.maxMemoryGBHours || null,
        input.resourceWarningPct || 80,
        input.resourcePolicy || 'warn',
        input.maxCostCents || null,
        input.costWarningPct || 80,
        input.costPolicy || 'warn',
      ]
    );
    return this.mapBudgetConfig(result.rows[0]);
  }

  // ==================== Budget Estimation ====================

  /**
   * Estimate budget for a pipeline run based on historical data
   */
  async estimateBudget(
    pipelineId: string,
    _options: { triggerType?: string; context?: Record<string, any> } = {}
  ): Promise<BudgetEstimate> {
    // Get last 10 successful runs for estimation
    const result = await this.pool.query(
      `SELECT duration_ms, created_at
       FROM pipeline_runs
       WHERE pipeline_id = $1 AND status = 'success' AND duration_ms IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 10`,
      [pipelineId]
    );

    if (result.rows.length === 0) {
      // No historical data - return default estimates
      return {
        estimatedTimeMs: 300000, // 5 min default
        estimatedCpuCores: 2,
        estimatedMemoryGB: 4,
        estimatedCost: 0,
        confidence: 0,
      };
    }

    const durations = result.rows.map((r: any) => parseFloat(r.duration_ms));
    const avgDuration = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;

    // Simple resource estimation based on duration (would be more sophisticated in production)
    const estimatedCpu = Math.max(1, Math.ceil(avgDuration / 60000)); // ~1 core per minute
    const estimatedMemory = Math.max(2, Math.ceil(avgDuration / 30000)); // ~2GB base + scaling
    const estimatedCost = Math.round(avgDuration * 0.001); // rough cost estimate

    const confidence = Math.min(0.9, result.rows.length * 0.1);

    return {
      estimatedTimeMs: Math.round(avgDuration),
      estimatedCpuCores: estimatedCpu,
      estimatedMemoryGB: estimatedMemory,
      estimatedCost,
      confidence,
    };
  }

  // ==================== Budget Usage Tracking ====================

  /**
   * Get real-time budget usage for a specific run
   */
  async getBudgetUsage(pipelineId: string, runId: string): Promise<BudgetUsage> {
    const budget = await this.getBudget(pipelineId);
    if (!budget) {
      // No budget configured - return zeroes
      return {
        timeUsed: 0, timePercent: 0,
        cpuUsed: 0, cpuPercent: 0,
        memoryUsed: 0, memoryPercent: 0,
        costUsed: 0, costPercent: 0,
        alerts: [],
      };
    }

    // Get run duration
    const runResult = await this.pool.query(
      'SELECT duration_ms, status FROM pipeline_runs WHERE id = $1',
      [runId]
    );

    // Get resource usage from budget_usage table
    const usageResult = await this.pool.query(
      'SELECT * FROM pipeline_budget_usage WHERE run_id = $1',
      [runId]
    );

    const runDuration = runResult.rows[0]?.duration_ms || 0;
    const usageRow = usageResult.rows[0] || {};

    const cpuUsed = parseFloat(usageRow.cpu_core_hours || '0');
    const memoryUsed = parseFloat(usageRow.memory_gb_hours || '0');
    const costUsed = parseFloat(usageRow.cost_cents || '0');

    const timeBudgetMax = budget.timeBudget?.maxDurationMs || 0;
    const cpuBudgetMax = (budget.resourceBudget?.maxCpuCoreHours || 0) * 3600000; // convert hours to ms equivalent
    const memoryBudgetMax = (budget.resourceBudget?.maxMemoryGBHours || 0) * 3600000;
    const costBudgetMax = budget.costBudget?.maxCostCents || 0;

    const timePercent = timeBudgetMax > 0 ? (runDuration / timeBudgetMax) * 100 : 0;
    const cpuPercent = cpuBudgetMax > 0 ? (cpuUsed / (cpuBudgetMax / 3600000)) * 100 : 0;
    const memoryPercent = memoryBudgetMax > 0 ? (memoryUsed / (memoryBudgetMax / 3600000)) * 100 : 0;
    const costPercent = costBudgetMax > 0 ? (costUsed / costBudgetMax) * 100 : 0;

    // Generate alerts
    const alerts: BudgetAlert[] = [];
    const now = new Date();

    if (budget.timeBudget) {
      if (timePercent >= 100) {
        alerts.push({ type: 'time', level: 'critical', message: `Time budget exceeded (${Math.round(timePercent)}%)`, triggeredAt: now });
      } else if (timePercent >= budget.timeBudget.warningPercent) {
        alerts.push({ type: 'time', level: 'warning', message: `Time budget approaching limit (${Math.round(timePercent)}%)`, triggeredAt: now });
      }
    }

    if (budget.resourceBudget) {
      if (cpuPercent >= 100) {
        alerts.push({ type: 'cpu', level: 'critical', message: `CPU budget exceeded (${Math.round(cpuPercent)}%)`, triggeredAt: now });
      } else if (cpuPercent >= budget.resourceBudget.warningPercent) {
        alerts.push({ type: 'cpu', level: 'warning', message: `CPU budget approaching limit (${Math.round(cpuPercent)}%)`, triggeredAt: now });
      }
      if (memoryPercent >= 100) {
        alerts.push({ type: 'memory', level: 'critical', message: `Memory budget exceeded (${Math.round(memoryPercent)}%)`, triggeredAt: now });
      } else if (memoryPercent >= budget.resourceBudget.warningPercent) {
        alerts.push({ type: 'memory', level: 'warning', message: `Memory budget approaching limit (${Math.round(memoryPercent)}%)`, triggeredAt: now });
      }
    }

    if (budget.costBudget) {
      if (costPercent >= 100) {
        alerts.push({ type: 'cost', level: 'critical', message: `Cost budget exceeded (${Math.round(costPercent)}%)`, triggeredAt: now });
      } else if (costPercent >= budget.costBudget.warningPercent) {
        alerts.push({ type: 'cost', level: 'warning', message: `Cost budget approaching limit (${Math.round(costPercent)}%)`, triggeredAt: now });
      }
    }

    return {
      timeUsed: runDuration,
      timePercent: Math.round(timePercent * 100) / 100,
      cpuUsed,
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      memoryUsed,
      memoryPercent: Math.round(memoryPercent * 100) / 100,
      costUsed,
      costPercent: Math.round(costPercent * 100) / 100,
      alerts,
    };
  }

  /**
   * Check if a run would exceed budget and return the policy action
   */
  async checkBudgetExceeded(pipelineId: string, runId: string): Promise<{ exceeded: boolean; action?: 'warn' | 'block' | 'rollback' } | null> {
    const usage = await this.getBudgetUsage(pipelineId, runId);
    const budget = await this.getBudget(pipelineId);
    if (!budget) return null;

    // Check each dimension
    if (usage.timePercent >= 100 && budget.timeBudget) {
      return { exceeded: true, action: budget.timeBudget.policy };
    }
    if (usage.cpuPercent >= 100 && budget.resourceBudget) {
      return { exceeded: true, action: budget.resourceBudget.policy };
    }
    if (usage.costPercent >= 100 && budget.costBudget) {
      return { exceeded: true, action: budget.costBudget.policy };
    }

    return { exceeded: false };
  }

  // ==================== Internal helpers ====================

  private mapBudgetConfig(row: any): BudgetConfig {
    return {
      timeBudget: row.max_duration_ms
        ? {
            maxDurationMs: parseFloat(row.max_duration_ms),
            warningPercent: row.time_warning_pct || 80,
            policy: (row.time_policy as 'warn' | 'block' | 'rollback') || 'warn',
          }
        : undefined,
      resourceBudget: row.max_cpu_core_hours
        ? {
            maxCpuCoreHours: parseFloat(row.max_cpu_core_hours),
            maxMemoryGBHours: parseFloat(row.max_memory_gb_hours || '0'),
            warningPercent: row.resource_warning_pct || 80,
            policy: (row.resource_policy as 'warn' | 'block' | 'rollback') || 'warn',
          }
        : undefined,
      costBudget: row.max_cost_cents
        ? {
            maxCostCents: parseFloat(row.max_cost_cents),
            warningPercent: row.cost_warning_pct || 80,
            policy: (row.cost_policy as 'warn' | 'block' | 'rollback') || 'warn',
          }
        : undefined,
      updatedAt: row.updated_at,
    };
  }
}
