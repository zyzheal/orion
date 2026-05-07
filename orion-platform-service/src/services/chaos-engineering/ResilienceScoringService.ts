/**
 * ResilienceScoringService - Enhanced resilience scoring with experiment scheduling
 *
 * Extends ResilienceScoreCalculator with:
 * - Chaos experiment scheduling (cron-based trigger)
 * - Pre-deployment chaos verification gate
 * - Enhanced resilience score calculation with blast radius and fault coverage
 *
 * Phase 3 P1 Service
 */

import { ResilienceScoreCalculator, ResilienceScoreRepository } from './ResilienceScoreCalculator';
import { DatabasePool } from '../database';

// ==================== Types ====================

export interface ChaosSchedule {
  id: string;
  experiment_id: string;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  max_runs: number;
  current_runs: number;
  last_run_at: Date | null;
  next_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PreDeployVerifyResult {
  passed: boolean;
  score: number;
  recent_experiments: PreDeployExperimentResult[];
  recommendations: string[];
  block_reason?: string;
}

export interface PreDeployExperimentResult {
  experiment_id: string;
  name: string;
  status: string;
  run_at: Date;
  mttr_ms: number;
  recovered: boolean;
  blast_radius: number;
}

export interface ResilienceScoreEnhanced {
  id: string;
  tenant_id: string;
  service_id: string | null;
  overall_score: number;
  experiment_success_rate: number;
  recovery_time_score: number;
  blast_radius_score: number;
  fault_coverage_score: number;
  trend: 'improving' | 'stable' | 'degrading';
  calculated_at: Date;
}

export interface BlastRadiusMetrics {
  affected_services: number;
  affected_users_percent: number;
  data_loss_risk: 'none' | 'low' | 'medium' | 'high';
  cascade_risk: boolean;
}

export interface FaultCoverageMetrics {
  total_fault_types: number;
  tested_fault_types: number;
  coverage_percent: number;
  untested_faults: string[];
}

export class ResilienceScoringService {
  
  private calculator: ResilienceScoreCalculator;
  private repository: ResilienceScoreRepository;

  private readonly FAULT_TYPES = [
    'network_latency', 'service_down', 'cpu_stress', 'memory_stress',
    'disk_full', 'dns_failure', 'packet_loss', 'timeout',
    'database_slow', 'cache_failure', 'queue_overflow',
  ];

  private readonly MIN_PREDEPLOY_SCORE = 70;
  private readonly MIN_RECENT_EXPERIMENTS = 3;
  private readonly PREDEPLOY_LOOKBACK_DAYS = 30;

  constructor(private pool: DatabasePool) {
    this.calculator = new ResilienceScoreCalculator(this.pool);
    this.repository = new ResilienceScoreRepository(this.pool);
  }

  // ==================== Chaos Experiment Scheduling ====================

  /**
   * Create a scheduled chaos experiment
   */
  async createSchedule(
    experimentId: string,
    cronExpression: string,
    options?: { timezone?: string; maxRuns?: number }
  ): Promise<ChaosSchedule> {
    const timezone = options?.timezone || 'UTC';
    const maxRuns = options?.maxRuns || 100;

    const nextRunAt = this.computeNextRun(cronExpression, timezone);

    const result = await this.pool.query(
      `INSERT INTO chaos_schedules
        (experiment_id, cron_expression, timezone, enabled, max_runs, next_run_at)
       VALUES ($1, $2, $3, true, $4, $5)
       RETURNING *`,
      [experimentId, cronExpression, timezone, maxRuns, nextRunAt]
    );

    return this.mapScheduleRow(result.rows[0]);
  }

  /**
   * List schedules for a tenant
   */
  async listSchedules(tenantId: string, enabledOnly?: boolean): Promise<ChaosSchedule[]> {
    let query = `
      SELECT cs.* FROM chaos_schedules cs
      JOIN chaos_experiments ce ON cs.experiment_id = ce.id
      WHERE ce.tenant_id = $1`;
    const params: any[] = [tenantId];

    if (enabledOnly) {
      query += ' AND cs.enabled = true';
    }

    query += ' ORDER BY cs.next_run_at ASC';

    const result = await this.pool.query(query, params);
    return result.rows.map((r: any) => this.mapScheduleRow(r));
  }

  /**
   * Toggle schedule enabled/disabled
   */
  async toggleSchedule(scheduleId: string, enabled: boolean): Promise<ChaosSchedule> {
    const result = await this.pool.query(
      `UPDATE chaos_schedules SET enabled = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [scheduleId, enabled]
    );
    if (!result.rows[0]) {
      throw new Error('Schedule not found');
    }
    return this.mapScheduleRow(result.rows[0]);
  }

  /**
   * Get due schedules (should run now)
   */
  async getDueSchedules(): Promise<ChaosSchedule[]> {
    const result = await this.pool.query(
      `SELECT * FROM chaos_schedules
       WHERE enabled = true
         AND next_run_at <= NOW()
         AND (max_runs = 0 OR current_runs < max_runs)
       ORDER BY next_run_at ASC`
    );
    return result.rows.map((r: any) => this.mapScheduleRow(r));
  }

  /**
   * Record a schedule run
   */
  async recordScheduleRun(scheduleId: string, runId: string): Promise<void> {
    const nextRunAt = await this.pool.query(
      `SELECT cron_expression, timezone FROM chaos_schedules WHERE id = $1`,
      [scheduleId]
    );

    if (nextRunAt.rows.length > 0) {
      const row = nextRunAt.rows[0];
      const next = this.computeNextRun(row.cron_expression, row.timezone);

      await this.pool.query(
        `UPDATE chaos_schedules
         SET current_runs = current_runs + 1, last_run_at = NOW(), next_run_at = $2, updated_at = NOW()
         WHERE id = $1`,
        [scheduleId, next]
      );
    }
  }

  // ==================== Pre-Deployment Chaos Verification ====================

  /**
   * Verify if a service is ready for production deployment
   * based on recent chaos experiment results
   */
  async preDeployVerification(
    tenantId: string,
    serviceId: string
  ): Promise<PreDeployVerifyResult> {
    const recentExperiments = await this.getRecentChaosExperiments(
      tenantId,
      serviceId,
      this.PREDEPLOY_LOOKBACK_DAYS
    );

    if (recentExperiments.length < this.MIN_RECENT_EXPERIMENTS) {
      return {
        passed: false,
        score: 0,
        recent_experiments: [],
        recommendations: [
          `Need at least ${this.MIN_RECENT_EXPERIMENTS} chaos experiments in the last ${this.PREDEPLOY_LOOKBACK_DAYS} days`,
          'Run more chaos experiments before deploying to production',
        ],
        block_reason: `Insufficient chaos experiments: ${recentExperiments.length}/${this.MIN_RECENT_EXPERIMENTS}`,
      };
    }

    const experimentResults = recentExperiments.map((exp) => ({
      experiment_id: exp.id,
      name: exp.name,
      status: exp.status,
      run_at: exp.ended_at || exp.started_at,
      mttr_ms: exp.metrics?.mttr_ms || 0,
      recovered: exp.metrics?.recovered || false,
      blast_radius: this.calculateBlastRadius(exp),
    }));

    // Calculate verification score
    const successRate = recentExperiments.filter((e) => e.status === 'completed').length / recentExperiments.length;
    const recoveryRate = recentExperiments.filter((e) => e.metrics?.recovered).length / recentExperiments.length;
    const avgBlastRadius = experimentResults.reduce((s, e) => s + e.blast_radius, 0) / experimentResults.length;

    const score = Math.round(
      successRate * 40 +
      recoveryRate * 30 +
      (1 - avgBlastRadius) * 30
    );

    const passed = score >= this.MIN_PREDEPLOY_SCORE;
    const recommendations: string[] = [];

    if (successRate < 0.8) {
      recommendations.push('Experiment success rate is below 80% - investigate failure patterns');
    }
    if (recoveryRate < 0.9) {
      recommendations.push('Recovery rate is below 90% - improve auto-recovery mechanisms');
    }
    if (avgBlastRadius > 0.5) {
      recommendations.push('Average blast radius is too high - reduce blast radius for production safety');
    }

    return {
      passed,
      score,
      recent_experiments: experimentResults,
      recommendations,
      block_reason: passed ? undefined : `Score ${score} below minimum ${this.MIN_PREDEPLOY_SCORE}`,
    };
  }

  // ==================== Enhanced Resilience Score Calculation ====================

  /**
   * Calculate enhanced resilience score with all four factors:
   * - Experiment success rate (30%)
   * - Recovery time (25%)
   * - Blast radius (20%)
   * - Fault coverage (25%)
   */
  async calculateEnhancedScore(
    tenantId: string,
    serviceId?: string
  ): Promise<ResilienceScoreEnhanced> {
    const metrics = await this.getEnhancedMetrics(tenantId, serviceId);

    const experimentSuccessRateScore = metrics.experimentSuccessRate * 100;
    const recoveryTimeScore = this.calculateRecoveryTimeScore(metrics.avgRecoveryTimeMs);
    const blastRadiusScore = Math.round((1 - metrics.avgBlastRadius) * 100);
    const faultCoverageScore = metrics.faultCoverage.coverage_percent * 100;

    const overallScore = Math.round(
      experimentSuccessRateScore * 0.30 +
      recoveryTimeScore * 0.25 +
      blastRadiusScore * 0.20 +
      faultCoverageScore * 0.25
    );

    const trend = await this.calculateScoreTrend(tenantId, overallScore, serviceId);

    const score: ResilienceScoreEnhanced = {
      id: `score-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      tenant_id: tenantId,
      service_id: serviceId || null,
      overall_score: Math.min(100, Math.max(0, overallScore)),
      experiment_success_rate: metrics.experimentSuccessRate,
      recovery_time_score: recoveryTimeScore,
      blast_radius_score: blastRadiusScore,
      fault_coverage_score: faultCoverageScore,
      trend,
      calculated_at: new Date(),
    };

    // Persist the score
    await this.pool.query(
      `INSERT INTO resilience_scores_enhanced
        (tenant_id, service_id, overall_score, experiment_success_rate,
         recovery_time_score, blast_radius_score, fault_coverage_score, trend)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        score.tenant_id,
        score.service_id,
        score.overall_score,
        score.experiment_success_rate,
        score.recovery_time_score,
        score.blast_radius_score,
        score.fault_coverage_score,
        score.trend,
      ]
    );

    return score;
  }

  /**
   * Get enhanced score breakdown
   */
  async getScoreBreakdown(tenantId: string, serviceId?: string): Promise<{
    overall_score: number;
    experiment_success_rate: number;
    recovery_time_score: number;
    blast_radius_score: number;
    fault_coverage_score: number;
    fault_coverage: FaultCoverageMetrics;
    blast_radius: BlastRadiusMetrics;
    recommendations: string[];
  }> {
    const score = await this.calculateEnhancedScore(tenantId, serviceId);
    const faultCoverage = await this.getFaultCoverage(tenantId, serviceId);
    const blastRadius = await this.getLatestBlastRadius(tenantId, serviceId);

    const recommendations = this.generateEnhancedRecommendations(score, faultCoverage, blastRadius);

    return {
      overall_score: score.overall_score,
      experiment_success_rate: score.experiment_success_rate,
      recovery_time_score: score.recovery_time_score,
      blast_radius_score: score.blast_radius_score,
      fault_coverage_score: score.fault_coverage_score,
      fault_coverage: faultCoverage,
      blast_radius: blastRadius,
      recommendations,
    };
  }

  // ==================== Private Helpers ====================

  private async getRecentChaosExperiments(
    tenantId: string,
    serviceId: string,
    lookbackDays: number
  ): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT ce.id, ce.name, cr.status, cr.metrics, cr.started_at, cr.ended_at
       FROM chaos_runs cr
       JOIN chaos_experiments ce ON cr.experiment_id = ce.id
       WHERE ce.tenant_id = $1
         AND ce.scope->>'service_id' = $2
         AND cr.started_at >= NOW() - INTERVAL '${lookbackDays} days'
       ORDER BY cr.started_at DESC`,
      [tenantId, serviceId]
    );
    return result.rows;
  }

  private async getEnhancedMetrics(
    tenantId: string,
    serviceId?: string
  ): Promise<{
    experimentSuccessRate: number;
    avgRecoveryTimeMs: number;
    avgBlastRadius: number;
    faultCoverage: FaultCoverageMetrics;
  }> {
    let query = `
      SELECT
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE cr.status = 'completed') as completed_runs,
        AVG((cr.metrics->>'mttr_ms')::float) FILTER (WHERE cr.status = 'completed') as avg_mttr,
        COUNT(*) FILTER (WHERE cr.metrics->>'recovered' = 'true') as recovered_runs
      FROM chaos_runs cr
      JOIN chaos_experiments ce ON cr.experiment_id = ce.id
      WHERE ce.tenant_id = $1`;
    const params: any[] = [tenantId];

    if (serviceId) {
      query += ` AND ce.scope->>'service_id' = $2`;
      params.push(serviceId);
    }

    const result = await this.pool.query(query, params);
    const row = result.rows[0];

    const totalRuns = parseInt(row.total_runs) || 0;
    const completedRuns = parseInt(row.completed_runs) || 0;

    const faultCoverage = await this.getFaultCoverage(tenantId, serviceId);
    const blastRadius = await this.getLatestBlastRadius(tenantId, serviceId);

    return {
      experimentSuccessRate: totalRuns > 0 ? completedRuns / totalRuns : 0,
      avgRecoveryTimeMs: parseFloat(row.avg_mttr) || 300000,
      avgBlastRadius: blastRadius.affected_users_percent / 100,
      faultCoverage,
    };
  }

  private calculateRecoveryTimeScore(recoveryTimeMs: number): number {
    if (recoveryTimeMs <= 60000) return 100;       // < 1 min
    if (recoveryTimeMs <= 300000) return 80;       // < 5 min
    if (recoveryTimeMs <= 900000) return 60;       // < 15 min
    return Math.max(20, 60 - (recoveryTimeMs - 900000) / 30000);
  }

  private calculateBlastRadius(run: any): number {
    const metrics = run.metrics || {};
    const affectedServices = (metrics.affected_services || []).length;
    // Normalize: 0-1 where 1 means maximum blast radius
    return Math.min(1, affectedServices / 10);
  }

  private async getFaultCoverage(
    tenantId: string,
    serviceId?: string
  ): Promise<FaultCoverageMetrics> {
    let query = `SELECT DISTINCT UNNEST(ARRAY(SELECT jsonb_array_elements_text(
      (SELECT jsonb_agg(f->>'type') FROM jsonb_array_elements(faults) f))
    )) as fault_type FROM chaos_experiments WHERE tenant_id = $1`;
    const params: any[] = [tenantId];

    if (serviceId) {
      query += ` AND scope->>'service_id' = $2`;
      params.push(serviceId);
    }

    const result = await this.pool.query(query, params);
    const testedFaults = new Set(result.rows.map((r: any) => r.fault_type));

    const untested = this.FAULT_TYPES.filter((f) => !testedFaults.has(f));

    return {
      total_fault_types: this.FAULT_TYPES.length,
      tested_fault_types: testedFaults.size,
      coverage_percent: testedFaults.size / this.FAULT_TYPES.length,
      untested_faults: untested,
    };
  }

  private async getLatestBlastRadius(
    tenantId: string,
    serviceId?: string
  ): Promise<BlastRadiusMetrics> {
    let query = `
      SELECT cr.metrics
      FROM chaos_runs cr
      JOIN chaos_experiments ce ON cr.experiment_id = ce.id
      WHERE ce.tenant_id = $1 AND cr.status = 'completed'`;
    const params: any[] = [tenantId];

    if (serviceId) {
      query += ` AND ce.scope->>'service_id' = $2`;
      params.push(serviceId);
    }

    query += ' ORDER BY cr.started_at DESC LIMIT 1';

    const result = await this.pool.query(query, params);
    if (result.rows.length === 0) {
      return {
        affected_services: 0,
        affected_users_percent: 0,
        data_loss_risk: 'none',
        cascade_risk: false,
      };
    }

    const metrics = result.rows[0].metrics || {};
    const affectedServices = (metrics.affected_services || []).length;

    return {
      affected_services: affectedServices,
      affected_users_percent: Math.min(100, affectedServices * 10),
      data_loss_risk: affectedServices > 5 ? 'high' : affectedServices > 2 ? 'medium' : 'low',
      cascade_risk: affectedServices > 3,
    };
  }

  private async calculateScoreTrend(
    tenantId: string,
    currentScore: number,
    serviceId?: string
  ): Promise<'improving' | 'stable' | 'degrading'> {
    let query = `SELECT overall_score FROM resilience_scores_enhanced WHERE tenant_id = $1`;
    const params: any[] = [tenantId];

    if (serviceId) {
      query += ` AND service_id = $2`;
      params.push(serviceId);
    }

    query += ' ORDER BY calculated_at DESC LIMIT 1';

    const result = await this.pool.query(query, params);
    if (result.rows.length === 0) return 'stable';

    const diff = currentScore - (result.rows[0].overall_score || currentScore);
    if (diff > 5) return 'improving';
    if (diff < -5) return 'degrading';
    return 'stable';
  }

  private generateEnhancedRecommendations(
    score: ResilienceScoreEnhanced,
    faultCoverage: FaultCoverageMetrics,
    blastRadius: BlastRadiusMetrics
  ): string[] {
    const recommendations: string[] = [];

    if (score.experiment_success_rate < 0.8) {
      recommendations.push('Experiment success rate is below 80% - review fault injection configurations');
    }
    if (score.recovery_time_score < 60) {
      recommendations.push('Recovery time needs improvement - implement automated recovery procedures');
    }
    if (score.blast_radius_score < 50) {
      recommendations.push('Blast radius is too large - use smaller scope for chaos experiments');
    }
    if (faultCoverage.coverage_percent < 0.5) {
      recommendations.push(`Only ${Math.round(faultCoverage.coverage_percent * 100)}% fault coverage - test: ${faultCoverage.untested_faults.slice(0, 3).join(', ')}`);
    }
    if (blastRadius.cascade_risk) {
      recommendations.push('Cascade risk detected - implement circuit breakers and bulkheads');
    }
    if (score.overall_score < 60) {
      recommendations.push('Overall resilience is critical - prioritize chaos engineering program');
    }
    if (recommendations.length === 0) {
      recommendations.push('Resilience posture is healthy - maintain regular chaos testing cadence');
    }

    return recommendations;
  }

  private computeNextRun(cronExpression: string, timezone: string): Date | null {
    // Simplified cron next-run computation
    // In production, use a proper cron parser like cron-parser
    const now = new Date();
    // Default: schedule for 1 hour from now
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  private mapScheduleRow(row: any): ChaosSchedule {
    return {
      id: row.id,
      experiment_id: row.experiment_id,
      cron_expression: row.cron_expression,
      timezone: row.timezone || 'UTC',
      enabled: row.enabled ?? true,
      max_runs: parseInt(row.max_runs) || 0,
      current_runs: parseInt(row.current_runs) || 0,
      last_run_at: row.last_run_at,
      next_run_at: row.next_run_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
