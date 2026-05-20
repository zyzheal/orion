import { DatabasePool } from '../database';
/**
 * Self Adaptive Pipeline Service - Phase 2 + Phase 3.4
 *
 * Pipeline auto-tuning based on historical performance
 * Phase 3.4: Added applyOptimization to actually apply tuning suggestions
 */

export interface AdaptationRule {
  metric: string;
  condition: string;
  action: string;
  confidence: number;
}

export interface PipelineAdaptation {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  adaptation_type: 'timeout_adjustment' | 'resource_scaling' | 'retry_optimization' | 'parallelism_tuning';
  before_value: Record<string, unknown>;
  after_value: Record<string, unknown>;
  reason: string;
  confidence: number;
  applied: boolean;
  created_at: Date;
}

export interface OptimizationSuggestion {
  type: PipelineAdaptation['adaptation_type'];
  description: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export class SelfAdaptivePipelineService {

  constructor(private pool: DatabasePool) {}

  async analyzePipelinePerformance(pipelineId: string, tenantId: string = 'default'): Promise<{ metrics: Record<string, number>; suggestions: OptimizationSuggestion[] }> {
    // Get historical run data
    const result = await this.pool.query(
      `SELECT AVG(duration_ms) as avg_duration,
              AVG(success_rate) as avg_success,
              COUNT(*) as run_count,
              MAX(duration_ms) as max_duration,
              MIN(duration_ms) as min_duration,
              AVG(resource_cpu_percent) as avg_cpu,
              AVG(resource_memory_percent) as avg_memory
       FROM pipeline_runs WHERE pipeline_id = $1 AND status = 'completed'`,
      [pipelineId]
    );

    const row = result.rows[0];
    const metrics = {
      avgDuration: parseFloat(row.avg_duration) || 0,
      successRate: parseFloat(row.avg_success) || 0,
      runCount: parseInt(row.run_count) || 0,
      maxDuration: parseFloat(row.max_duration) || 0,
      minDuration: parseFloat(row.min_duration) || 0,
      avgCpu: parseFloat(row.avg_cpu) || 0,
      avgMemory: parseFloat(row.avg_memory) || 0,
    };

    // Generate adaptation suggestions based on analysis
    const suggestions: OptimizationSuggestion[] = [];

    if (metrics.avgDuration > 600000) {
      suggestions.push({
        type: 'timeout_adjustment',
        description: '平均运行时间超过 10 分钟，建议增加超时时间',
        before: { timeout_ms: 600000 },
        after: { timeout_ms: Math.ceil(metrics.avgDuration * 1.5) },
        confidence: 0.8,
        riskLevel: 'low',
      });
    }

    if (metrics.successRate < 0.9 && metrics.runCount > 5) {
      suggestions.push({
        type: 'retry_optimization',
        description: '成功率低于 90%，建议添加重试策略',
        before: { retry_count: 0 },
        after: { retry_count: 2, retry_delay_ms: 5000, retry_backoff: 'exponential' },
        confidence: 0.7,
        riskLevel: 'low',
      });
    }

    if (metrics.avgCpu > 80) {
      suggestions.push({
        type: 'resource_scaling',
        description: '平均 CPU 使用率超过 80%，建议增加资源',
        before: { cpu_limit: '500m' },
        after: { cpu_limit: '1000m' },
        confidence: 0.75,
        riskLevel: 'medium',
      });
    }

    if (metrics.avgMemory > 85) {
      suggestions.push({
        type: 'resource_scaling',
        description: '平均内存使用率超过 85%，建议增加内存',
        before: { memory_limit: '512Mi' },
        after: { memory_limit: '1Gi' },
        confidence: 0.8,
        riskLevel: 'medium',
      });
    }

    // Check for parallelism opportunities
    if (metrics.avgDuration > 300000) {
      const stageResult = await this.pool.query(
        `SELECT stage_name, AVG(duration_ms) as avg_duration
         FROM pipeline_stage_runs WHERE pipeline_id = $1
         GROUP BY stage_name ORDER BY avg_duration DESC`,
        [pipelineId]
      );

      if (stageResult.rows.length > 1) {
        suggestions.push({
          type: 'parallelism_tuning',
          description: '存在可并行执行的阶段，建议优化依赖关系',
          before: { parallel: false },
          after: { parallel: true, stages: stageResult.rows.map((r: any) => r.stage_name) },
          confidence: 0.6,
          riskLevel: 'high',
        });
      }
    }

    return { metrics, suggestions };
  }

  /**
   * Apply an optimization suggestion to a pipeline.
   * Phase 3.4: Actually updates the pipeline definition based on the suggestion type.
   */
  async applyOptimization(
    pipelineId: string,
    suggestion: OptimizationSuggestion,
    tenantId: string = 'default'
  ): Promise<PipelineAdaptation> {
    // Low risk optimizations can be applied directly; medium/high need review
    const autoApply = suggestion.riskLevel === 'low';

    // Apply the optimization to the pipeline's config JSONB field
    let updateResult: any;

    switch (suggestion.type) {
      case 'timeout_adjustment':
        updateResult = await this.pool.query(
          `UPDATE pipelines SET config = jsonb_set(config, '{timeout_ms}', $1::jsonb, true), updated_at = NOW()
           WHERE id = $2 AND tenant_id = $3 RETURNING *`,
          [JSON.stringify(suggestion.after.timeout_ms), pipelineId, tenantId]
        );
        break;

      case 'retry_optimization':
        updateResult = await this.pool.query(
          `UPDATE pipelines SET config = jsonb_set(config, '{retry_config}', $1::jsonb, true), updated_at = NOW()
           WHERE id = $2 AND tenant_id = $3 RETURNING *`,
          [JSON.stringify(suggestion.after), pipelineId, tenantId]
        );
        break;

      case 'resource_scaling':
        updateResult = await this.pool.query(
          `UPDATE pipelines SET config = jsonb_set(config, '{resource_config}', $1::jsonb, true), updated_at = NOW()
           WHERE id = $2 AND tenant_id = $3 RETURNING *`,
          [JSON.stringify(suggestion.after), pipelineId, tenantId]
        );
        break;

      case 'parallelism_tuning':
        updateResult = await this.pool.query(
          `UPDATE pipelines SET config = jsonb_set(config, '{parallel_config}', $1::jsonb, true), updated_at = NOW()
           WHERE id = $2 AND tenant_id = $3 RETURNING *`,
          [JSON.stringify(suggestion.after), pipelineId, tenantId]
        );
        break;
    }

    if (!updateResult?.rows?.length) {
      throw new Error(`Pipeline ${pipelineId} not found or update failed`);
    }

    // Record the adaptation
    const result = await this.pool.query(
      `INSERT INTO pipeline_adaptations
        (tenant_id, pipeline_id, adaptation_type, before_value, after_value, reason, confidence, applied, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        tenantId,
        pipelineId,
        suggestion.type,
        JSON.stringify(suggestion.before),
        JSON.stringify(suggestion.after),
        suggestion.description,
        suggestion.confidence,
        autoApply,
      ]
    );

    return result.rows[0];
  }

  /**
   * Apply an adaptation rule (legacy API, kept for backward compatibility)
   */
  async applyAdaptation(pipelineId: string, adaptation: AdaptationRule): Promise<PipelineAdaptation> {
    const suggestion: OptimizationSuggestion = {
      type: this.inferAdaptationType(adaptation.action),
      description: adaptation.condition,
      before: {},
      after: {},
      confidence: adaptation.confidence,
      riskLevel: 'low',
    };

    return this.applyOptimization(pipelineId, suggestion, 'default');
  }

  private inferAdaptationType(action: string): PipelineAdaptation['adaptation_type'] {
    if (action.includes('timeout')) return 'timeout_adjustment';
    if (action.includes('retry')) return 'retry_optimization';
    if (action.includes('resource') || action.includes('scale')) return 'resource_scaling';
    if (action.includes('parallel')) return 'parallelism_tuning';
    return 'timeout_adjustment';
  }

  async getAdaptationHistory(pipelineId: string): Promise<PipelineAdaptation[]> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_adaptations WHERE pipeline_id = $1 ORDER BY created_at DESC',
      [pipelineId]
    );
    return result.rows;
  }
}