import { DatabasePool } from '../database';
/**
 * PipelineBudgetService - Business logic for Pipeline Execution Budget
 *
 * Implements execution budget capabilities including:
 * - Time budget configuration and monitoring
 * - Resource budget (CPU/Memory) tracking
 * - Cost budget management
 * - Over-budget policy handling (warn/block/rollback)
 *
 * Phase 1 P0 Service
 */

// ==================== Types ====================

export interface TimeBudget {
  maxDurationMs: number;
  warningPercent: number;
  policy: 'warn' | 'block' | 'rollback';
}

export interface ResourceBudget {
  maxCpuCoreHours: number;
  maxMemoryGBHours: number;
  warningPercent: number;
  policy: 'warn' | 'block' | 'rollback';
}

export interface CostBudget {
  maxCostCents: number;
  warningPercent: number;
  policy: 'warn' | 'block' | 'rollback';
}

export interface PipelineBudgetConfig {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  time_budget: TimeBudget;
  resource_budget: ResourceBudget;
  cost_budget: CostBudget;
  created_at: Date;
  updated_at: Date;
}

export interface BudgetUsage {
  run_id: string;
  time_used: number;
  time_percent: number;
  cpu_used: number;
  cpu_percent: number;
  memory_used: number;
  memory_percent: number;
  cost_used: number;
  cost_percent: number;
  alerts: BudgetAlert[];
}

export interface BudgetAlert {
  type: 'time' | 'cpu' | 'memory' | 'cost';
  level: 'warning' | 'critical';
  message: string;
  triggered_at: Date;
}

export interface BudgetEstimate {
  estimatedTimeMs: number;
  estimatedCpuCores: number;
  estimatedMemoryGB: number;
  estimatedCost: number;
  confidence: number;
}

export interface SetBudgetInput {
  tenant_id: string;
  pipeline_id: string;
  time_budget?: Partial<TimeBudget>;
  resource_budget?: Partial<ResourceBudget>;
  cost_budget?: Partial<CostBudget>;
}

export class PipelineBudgetServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PipelineBudgetServiceError';
  }
}

// ==================== Repository ====================

export class PipelineBudgetRepository {

  constructor(private pool: DatabasePool) {}

  async findByPipeline(pipelineId: string): Promise<PipelineBudgetConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_budgets WHERE pipeline_id = $1',
      [pipelineId]
    );
    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return this.mapRowToConfig(row);
  }

  async createOrUpdate(input: SetBudgetInput): Promise<PipelineBudgetConfig> {
    // Check if budget exists
    const existing = await this.findByPipeline(input.pipeline_id);

    const timeBudget = {
      ...existing?.time_budget,
      ...input.time_budget,
      maxDurationMs: input.time_budget?.maxDurationMs || existing?.time_budget?.maxDurationMs || 3600000,
      warningPercent: input.time_budget?.warningPercent || existing?.time_budget?.warningPercent || 80,
      policy: input.time_budget?.policy || existing?.time_budget?.policy || 'warn',
    };

    const resourceBudget = {
      ...existing?.resource_budget,
      ...input.resource_budget,
      maxCpuCoreHours: input.resource_budget?.maxCpuCoreHours || existing?.resource_budget?.maxCpuCoreHours || 100,
      maxMemoryGBHours: input.resource_budget?.maxMemoryGBHours || existing?.resource_budget?.maxMemoryGBHours || 200,
      warningPercent: input.resource_budget?.warningPercent || existing?.resource_budget?.warningPercent || 80,
      policy: input.resource_budget?.policy || existing?.resource_budget?.policy || 'warn',
    };

    const costBudget = {
      ...existing?.cost_budget,
      ...input.cost_budget,
      maxCostCents: input.cost_budget?.maxCostCents || existing?.cost_budget?.maxCostCents || 10000,
      warningPercent: input.cost_budget?.warningPercent || existing?.cost_budget?.warningPercent || 80,
      policy: input.cost_budget?.policy || existing?.cost_budget?.policy || 'warn',
    };

    if (existing) {
      const result = await this.pool.query(
        `UPDATE pipeline_budgets 
         SET time_budget = $1, resource_budget = $2, cost_budget = $3, updated_at = now()
         WHERE pipeline_id = $4
         RETURNING *`,
        [JSON.stringify(timeBudget), JSON.stringify(resourceBudget), JSON.stringify(costBudget), input.pipeline_id]
      );
      return this.mapRowToConfig(result.rows[0]);
    } else {
      const result = await this.pool.query(
        `INSERT INTO pipeline_budgets 
          (tenant_id, pipeline_id, time_budget, resource_budget, cost_budget)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.tenant_id, input.pipeline_id, JSON.stringify(timeBudget), JSON.stringify(resourceBudget), JSON.stringify(costBudget)]
      );
      return this.mapRowToConfig(result.rows[0]);
    }
  }

  mapRowToConfig(row: any): PipelineBudgetConfig {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      pipeline_id: row.pipeline_id,
      time_budget: row.time_budget || {
        maxDurationMs: 3600000,
        warningPercent: 80,
        policy: 'warn',
      },
      resource_budget: row.resource_budget || {
        maxCpuCoreHours: 100,
        maxMemoryGBHours: 200,
        warningPercent: 80,
        policy: 'warn',
      },
      cost_budget: row.cost_budget || {
        maxCostCents: 10000,
        warningPercent: 80,
        policy: 'warn',
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // Budget usage tracking
  async getBudgetUsage(runId: string, pipelineId: string): Promise<BudgetUsage | null> {
    const budgetConfig = await this.findByPipeline(pipelineId);
    if (!budgetConfig) return null;

    // Get run metrics
    const runResult = await this.pool.query(
      `SELECT id, duration_ms, started_at, completed_at 
       FROM pipeline_runs 
       WHERE id = $1`,
      [runId]
    );

    if (!runResult.rows[0]) return null;

    const run = runResult.rows[0];
    const durationMs = run.duration_ms || 
      (run.completed_at && run.started_at ? 
        (new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) : 0);

    // Calculate usage (simplified - actual implementation would get from metrics)
    const timeUsed = durationMs;
    const timePercent = (timeUsed / budgetConfig.time_budget.maxDurationMs) * 100;

    // Placeholder values for CPU/Memory/Cost (would be tracked during execution)
    const cpuUsed = 0;
    const cpuPercent = 0;
    const memoryUsed = 0;
    const memoryPercent = 0;
    const costUsed = 0;
    const costPercent = 0;

    // Generate alerts based on thresholds
    const alerts: BudgetAlert[] = [];

    if (timePercent >= budgetConfig.time_budget.warningPercent) {
      alerts.push({
        type: 'time',
        level: timePercent >= 100 ? 'critical' : 'warning',
        message: `Time usage at ${Math.round(timePercent)}% of budget`,
        triggered_at: new Date(),
      });
    }

    return {
      run_id: runId,
      time_used: timeUsed,
      time_percent: timePercent,
      cpu_used: cpuUsed,
      cpu_percent: cpuPercent,
      memory_used: memoryUsed,
      memory_percent: memoryPercent,
      cost_used: costUsed,
      cost_percent: costPercent,
      alerts,
    };
  }

  // Historical usage for estimation
  async getHistoricalUsage(pipelineId: string, limit: number = 10): Promise<{
    avgTimeMs: number;
    avgCpuCoreHours: number;
    avgMemoryGBHours: number;
    avgCostCents: number;
    sampleCount: number;
  }> {
    const result = await this.pool.query(
      `SELECT 
         AVG(duration_ms) as avg_time,
         COUNT(*) as sample_count
       FROM pipeline_runs 
       WHERE pipeline_id = $1 AND status = 'completed' AND duration_ms IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $2`,
      [pipelineId, limit]
    );

    const row = result.rows[0];
    return {
      avgTimeMs: parseFloat(row.avg_time) || 0,
      avgCpuCoreHours: 0, // Would be calculated from actual metrics
      avgMemoryGBHours: 0,
      avgCostCents: 0,
      sampleCount: parseInt(row.sample_count) || 0,
    };
  }
}

// ==================== Service ====================

export class PipelineBudgetService {
  private repository: PipelineBudgetRepository;

  constructor(private pool: DatabasePool) {
    this.repository = new PipelineBudgetRepository(this.pool);
  }

  /**
   * Get budget configuration for a pipeline
   */
  async getBudget(pipelineId: string): Promise<PipelineBudgetConfig | null> {
    return this.repository.findByPipeline(pipelineId);
  }

  /**
   * Set or update budget configuration
   */
  async setBudget(input: SetBudgetInput): Promise<PipelineBudgetConfig> {
    return this.repository.createOrUpdate(input);
  }

  /**
   * Estimate budget before execution
   */
  async estimateBudget(
    pipelineId: string,
    triggerType?: string,
    context?: Record<string, unknown>
  ): Promise<BudgetEstimate> {
    const historical = await this.repository.getHistoricalUsage(pipelineId, 10);

    // Confidence based on sample count
    const confidence = Math.min(historical.sampleCount / 10, 1) * 0.8 + 0.1;

    return {
      estimatedTimeMs: historical.avgTimeMs,
      estimatedCpuCores: historical.avgCpuCoreHours,
      estimatedMemoryGB: historical.avgMemoryGBHours,
      estimatedCost: historical.avgCostCents,
      confidence: confidence,
    };
  }

  /**
   * Get real-time budget usage for a run
   */
  async getBudgetUsage(runId: string, pipelineId: string): Promise<BudgetUsage | null> {
    return this.repository.getBudgetUsage(runId, pipelineId);
  }

  /**
   * Check if run exceeds budget (returns policy action needed)
   */
  async checkBudgetExceeded(
    runId: string,
    pipelineId: string
  ): Promise<{ exceeded: boolean; policy: 'warn' | 'block' | 'rollback' | null; alerts: BudgetAlert[] }> {
    const budgetConfig = await this.getBudget(pipelineId);
    if (!budgetConfig) {
      return { exceeded: false, policy: null, alerts: [] };
    }

    const usage = await this.getBudgetUsage(runId, pipelineId);
    if (!usage) {
      return { exceeded: false, policy: null, alerts: [] };
    }

    // Check critical thresholds (100%)
    const exceeded = usage.time_percent >= 100;

    // Determine policy action based on which budget exceeded
    let policy: 'warn' | 'block' | 'rollback' | null = null;

    if (usage.time_percent >= 100) {
      policy = budgetConfig.time_budget.policy;
    }

    return { exceeded, policy, alerts: usage.alerts };
  }

  /**
   * Update run with budget exceeded flag
   */
  async markBudgetExceeded(
    runId: string,
    policyAction: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE pipeline_runs 
       SET budget_exceeded = true, budget_policy_action = $2
       WHERE id = $1`,
      [runId, policyAction]
    );
  }

  /**
   * Get budget dashboard data for tenant
   */
  async getTenantBudgetDashboard(tenantId: string): Promise<{
    pipelines: Array<{
      pipeline_id: string;
      pipeline_name: string;
      budget_config: PipelineBudgetConfig;
      current_month_usage: {
        totalRuns: number;
        avgTimeMs: number;
        totalCostCents: number;
      };
    }>;
    totals: {
      totalRuns: number;
      totalCostCents: number;
      avgBudgetUtilization: number;
    };
  }> {
    // Get all pipelines with budgets
    const budgetsResult = await this.pool.query(
      `SELECT pb.*, p.name as pipeline_name
       FROM pipeline_budgets pb
       JOIN pipelines p ON pb.pipeline_id = p.id
       WHERE pb.tenant_id = $1`,
      [tenantId]
    );

    const pipelines = budgetsResult.rows.map(row => ({
      pipeline_id: row.pipeline_id,
      pipeline_name: row.pipeline_name,
      budget_config: this.repository.mapRowToConfig(row),
      current_month_usage: {
        totalRuns: 0,
        avgTimeMs: 0,
        totalCostCents: 0,
      },
    }));

    return {
      pipelines,
      totals: {
        totalRuns: pipelines.length,
        totalCostCents: 0,
        avgBudgetUtilization: 0,
      },
    };
  }
}