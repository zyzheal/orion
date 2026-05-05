/**
 * Self Adaptive Pipeline Service - Phase 2
 *
 * Pipeline auto-tuning based on historical performance
 */

import { DatabasePool } from '../database';

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

export class SelfAdaptivePipelineService {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  async analyzePipelinePerformance(pipelineId: string): Promise<{ metrics: Record<string, number>; suggestions: AdaptationRule[] }> {
    // Get historical run data
    const result = await this.pool.query(
      `SELECT AVG(duration_ms) as avg_duration, 
              AVG(success_rate) as avg_success,
              COUNT(*) as run_count
       FROM pipeline_runs WHERE pipeline_id = $1 AND status = 'completed'`,
      [pipelineId]
    );

    const row = result.rows[0];
    const metrics = {
      avgDuration: parseFloat(row.avg_duration) || 0,
      successRate: parseFloat(row.avg_success) || 0,
      runCount: parseInt(row.run_count) || 0,
    };

    // Generate adaptation suggestions
    const suggestions: AdaptationRule[] = [];
    
    if (metrics.avgDuration > 600000) {
      suggestions.push({
        metric: 'duration',
        condition: 'avg_duration > 10min',
        action: 'increase_timeout',
        confidence: 0.8,
      });
    }

    if (metrics.successRate < 0.9) {
      suggestions.push({
        metric: 'success_rate',
        condition: 'success_rate < 90%',
        action: 'add_retry_policy',
        confidence: 0.7,
      });
    }

    return { metrics, suggestions };
  }

  async applyAdaptation(pipelineId: string, adaptation: AdaptationRule): Promise<PipelineAdaptation> {
    const result = await this.pool.query(
      `INSERT INTO pipeline_adaptations 
        (tenant_id, pipeline_id, adaptation_type, before_value, after_value, reason, confidence, applied)
       VALUES ('default', $1, $2, '{}', '{}', $3, $4, false)
       RETURNING *`,
      [pipelineId, adaptation.action, adaptation.condition, adaptation.confidence]
    );
    return result.rows[0];
  }

  async getAdaptationHistory(pipelineId: string): Promise<PipelineAdaptation[]> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_adaptations WHERE pipeline_id = $1 ORDER BY created_at DESC',
      [pipelineId]
    );
    return result.rows;
  }
}