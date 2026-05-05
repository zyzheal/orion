/**
 * ResilienceScoreCalculator - Business logic for Resilience Score Calculation
 *
 * Implements resilience scoring capabilities including:
 * - MTTR (Mean Time To Recovery) calculation
 * - Success rate during faults
 * - Error budget tracking
 * - Resilience trend analysis
 *
 * Phase 3 P1 Service
 */

import { DatabasePool } from '../database';

// ==================== Types ====================

export interface ResilienceScore {
  id: string;
  tenant_id: string;
  service_id: string | null;
  score: number;
  mttr_ms: number;
  success_rate: number;
  error_budget: number;
  trend: 'improving' | 'stable' | 'degrading';
  calculated_at: Date;
}

export interface ResilienceFactors {
  mttr_factor: number;
  success_rate_factor: number;
  error_budget_factor: number;
  recovery_success_factor: number;
}

export interface ResilienceHistory {
  date: string;
  score: number;
  mttr_ms: number;
  success_rate: number;
}

export interface ScoreBreakdown {
  overall_score: number;
  mttr_score: number;
  success_rate_score: number;
  error_budget_score: number;
  recovery_score: number;
  factors: ResilienceFactors;
  recommendations: string[];
}

export interface ServiceResilienceSummary {
  service_id: string;
  current_score: number;
  trend: string;
  avg_mttr_ms: number;
  avg_success_rate: number;
  total_incidents: number;
  recovered_incidents: number;
}

export class ResilienceScoreCalculatorError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ResilienceScoreCalculatorError';
  }
}

// ==================== Repository ====================

export class ResilienceScoreRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  async findById(id: string): Promise<ResilienceScore | null> {
    const result = await this.pool.query(
      'SELECT * FROM resilience_scores WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findLatest(tenantId: string, serviceId?: string): Promise<ResilienceScore | null> {
    let query = `SELECT * FROM resilience_scores WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (serviceId) {
      query += ` AND service_id = $${paramIndex}`;
      params.push(serviceId);
      paramIndex++;
    }

    query += ` ORDER BY calculated_at DESC LIMIT 1`;

    const result = await this.pool.query(query, params);
    return result.rows[0] || null;
  }

  async listHistory(tenantId: string, serviceId?: string, limit: number = 30): Promise<ResilienceHistory[]> {
    let query = `SELECT * FROM resilience_scores WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (serviceId) {
      query += ` AND service_id = $${paramIndex}`;
      params.push(serviceId);
      paramIndex++;
    }

    query += ` ORDER BY calculated_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows.map(row => ({
      date: row.calculated_at.toISOString().split('T')[0],
      score: row.score,
      mttr_ms: row.mttr_ms || 0,
      success_rate: row.success_rate || 0,
    }));
  }

  async create(score: ResilienceScore): Promise<ResilienceScore> {
    const result = await this.pool.query(
      `INSERT INTO resilience_scores 
        (tenant_id, service_id, score, mttr_ms, success_rate, error_budget, trend)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        score.tenant_id,
        score.service_id || null,
        score.score,
        score.mttr_ms,
        score.success_rate,
        score.error_budget,
        score.trend,
      ]
    );
    return result.rows[0];
  }

  async getServiceSummary(tenantId: string): Promise<ServiceResilienceSummary[]> {
    const result = await this.pool.query(
      `SELECT 
        service_id,
        AVG(score) as avg_score,
        MAX(calculated_at) as last_calculated,
        AVG(mttr_ms) as avg_mttr,
        AVG(success_rate) as avg_success_rate,
        COUNT(*) as total_records
       FROM resilience_scores
       WHERE tenant_id = $1 AND service_id IS NOT NULL
       GROUP BY service_id`,
      [tenantId]
    );

    return result.rows.map(row => ({
      service_id: row.service_id,
      current_score: Math.round(row.avg_score) || 0,
      trend: 'stable', // Would calculate from actual trend
      avg_mttr_ms: Math.round(row.avg_mttr) || 0,
      avg_success_rate: parseFloat(row.avg_success_rate) || 0,
      total_incidents: parseInt(row.total_records) || 0,
      recovered_incidents: parseInt(row.total_records) || 0,
    }));
  }
}

// ==================== Service ====================

export class ResilienceScoreCalculator {
  private repository: ResilienceScoreRepository;
  private pool: DatabasePool;

  // Scoring weights
  private readonly WEIGHTS = {
    mttr: 0.25,
    successRate: 0.30,
    errorBudget: 0.25,
    recovery: 0.20,
  };

  // Thresholds for scoring
  private readonly THRESHOLDS = {
    mttrExcellent: 60000,    // < 1 min
    mttrGood: 300000,        // < 5 min
    mttrAcceptable: 900000,  // < 15 min
    successRateExcellent: 0.99,
    successRateGood: 0.95,
    successRateAcceptable: 0.90,
  };

  constructor(pool: DatabasePool) {
    this.pool = pool;
    this.repository = new ResilienceScoreRepository(pool);
  }

  /**
   * Calculate resilience score for a tenant/service
   */
  async calculateScore(
    tenantId: string,
    serviceId?: string
  ): Promise<ResilienceScore> {
    // Get metrics from chaos runs
    const metrics = await this.getChaosMetrics(tenantId, serviceId);

    // Calculate individual scores
    const mttrScore = this.calculateMTTRScore(metrics.avgMttrMs);
    const successRateScore = this.calculateSuccessRateScore(metrics.successRate);
    const errorBudgetScore = this.calculateErrorBudgetScore(metrics.errorBudgetRemaining);
    const recoveryScore = this.calculateRecoveryScore(metrics.recoveryRate);

    // Calculate overall score
    const overallScore = Math.round(
      mttrScore * this.WEIGHTS.mttr +
      successRateScore * this.WEIGHTS.successRate +
      errorBudgetScore * this.WEIGHTS.errorBudget +
      recoveryScore * this.WEIGHTS.recovery
    );

    // Determine trend
    const trend = await this.calculateTrend(tenantId, serviceId, overallScore);

    // Create score record
    const score: ResilienceScore = {
      id: '',
      tenant_id: tenantId,
      service_id: serviceId || null,
      score: overallScore,
      mttr_ms: metrics.avgMttrMs,
      success_rate: metrics.successRate,
      error_budget: metrics.errorBudgetRemaining,
      trend,
      calculated_at: new Date(),
    };

    return this.repository.create(score);
  }

  /**
   * Get current resilience score
   */
  async getCurrentScore(tenantId: string, serviceId?: string): Promise<ResilienceScore | null> {
    return this.repository.findLatest(tenantId, serviceId);
  }

  /**
   * Get score history
   */
  async getHistory(tenantId: string, serviceId?: string, days: number = 30): Promise<{
    data: ResilienceHistory[];
    trend: 'improving' | 'stable' | 'degrading';
  }> {
    const history = await this.repository.listHistory(tenantId, serviceId, days);

    // Calculate trend from history
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (history.length >= 3) {
      const recent = history.slice(0, 3);
      const avgRecent = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
      const avgOlder = history.slice(3).reduce((sum, h) => sum + h.score, 0) / (history.length - 3);

      if (avgRecent > avgOlder + 5) {
        trend = 'improving';
      } else if (avgRecent < avgOlder - 5) {
        trend = 'degrading';
      }
    }

    return { data: history, trend };
  }

  /**
   * Get detailed score breakdown with recommendations
   */
  async getScoreBreakdown(tenantId: string, serviceId?: string): Promise<ScoreBreakdown> {
    const currentScore = await this.getCurrentScore(tenantId, serviceId);
    if (!currentScore) {
      // Calculate new score if none exists
      const newScore = await this.calculateScore(tenantId, serviceId);
      return this.buildBreakdown(newScore);
    }

    return this.buildBreakdown(currentScore);
  }

  /**
   * Get tenant-level resilience summary
   */
  async getTenantSummary(tenantId: string): Promise<{
    overall_score: number;
    services: ServiceResilienceSummary[];
    weakest_services: string[];
    recommendations: string[];
  }> {
    const services = await this.repository.getServiceSummary(tenantId);
    const overallScore = services.length > 0
      ? Math.round(services.reduce((sum, s) => sum + s.current_score, 0) / services.length)
      : 0;

    // Find weakest services
    const weakestServices = services
      .sort((a, b) => a.current_score - b.current_score)
      .slice(0, 3)
      .map(s => s.service_id);

    // Generate recommendations
    const recommendations = this.generateTenantRecommendations(services);

    return {
      overall_score: overallScore,
      services,
      weakest_services: weakestServices,
      recommendations,
    };
  }

  /**
   * Get chaos metrics from runs
   */
  private async getChaosMetrics(tenantId: string, serviceId?: string): Promise<{
    avgMttrMs: number;
    successRate: number;
    errorBudgetRemaining: number;
    recoveryRate: number;
    totalRuns: number;
    recoveredRuns: number;
  }> {
    const result = await this.pool.query(
      `SELECT 
        AVG((metrics->>'mttr_ms')::int) as avg_mttr,
        AVG((metrics->>'error_count')::int) as avg_errors,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_runs,
        COUNT(*) FILTER (WHERE status = 'rolled_back') as rolled_back_runs
       FROM chaos_runs cr
       JOIN chaos_experiments ce ON cr.experiment_id = ce.id
       WHERE ce.tenant_id = $1`,
      [tenantId]
    );

    const row = result.rows[0];
    const totalRuns = parseInt(row.total_runs) || 0;
    const completedRuns = parseInt(row.completed_runs) || 0;
    const rolledBackRuns = parseInt(row.rolled_back_runs) || 0;

    // Default values if no runs
    if (totalRuns === 0) {
      return {
        avgMttrMs: 300000, // Default 5 min
        successRate: 0.95,
        errorBudgetRemaining: 0.8,
        recoveryRate: 0.95,
        totalRuns: 0,
        recoveredRuns: 0,
      };
    }

    return {
      avgMttrMs: parseFloat(row.avg_mttr) || 300000,
      successRate: completedRuns / totalRuns,
      errorBudgetRemaining: 0.8, // Would calculate from actual error budget
      recoveryRate: (completedRuns + rolledBackRuns) / totalRuns,
      totalRuns,
      recoveredRuns: completedRuns + rolledBackRuns,
    };
  }

  /**
   * Calculate MTTR score (0-100)
   */
  private calculateMTTRScore(mttrMs: number): number {
    if (mttrMs <= this.THRESHOLDS.mttrExcellent) {
      return 100;
    } else if (mttrMs <= this.THRESHOLDS.mttrGood) {
      return 80;
    } else if (mttrMs <= this.THRESHOLDS.mttrAcceptable) {
      return 60;
    } else {
      return Math.max(20, 60 - (mttrMs - this.THRESHOLDS.mttrAcceptable) / 10000);
    }
  }

  /**
   * Calculate success rate score (0-100)
   */
  private calculateSuccessRateScore(successRate: number): number {
    if (successRate >= this.THRESHOLDS.successRateExcellent) {
      return 100;
    } else if (successRate >= this.THRESHOLDS.successRateGood) {
      return 80;
    } else if (successRate >= this.THRESHOLDS.successRateAcceptable) {
      return 60;
    } else {
      return Math.max(10, successRate * 100);
    }
  }

  /**
   * Calculate error budget score (0-100)
   */
  private calculateErrorBudgetScore(errorBudget: number): number {
    return Math.round(errorBudget * 100);
  }

  /**
   * Calculate recovery success score (0-100)
   */
  private calculateRecoveryScore(recoveryRate: number): number {
    return Math.round(recoveryRate * 100);
  }

  /**
   * Calculate trend from history
   */
  private async calculateTrend(
    tenantId: string,
    serviceId?: string,
    currentScore: number
  ): Promise<'improving' | 'stable' | 'degrading'> {
    const previous = await this.repository.findLatest(tenantId, serviceId);
    if (!previous) {
      return 'stable';
    }

    const diff = currentScore - previous.score;
    if (diff > 5) {
      return 'improving';
    } else if (diff < -5) {
      return 'degrading';
    }
    return 'stable';
  }

  /**
   * Build score breakdown with recommendations
   */
  private buildBreakdown(score: ResilienceScore): ScoreBreakdown {
    const mttrScore = this.calculateMTTRScore(score.mttr_ms);
    const successRateScore = this.calculateSuccessRateScore(score.success_rate);
    const errorBudgetScore = this.calculateErrorBudgetScore(score.error_budget);
    const recoveryScore = 80; // Would calculate from actual data

    const recommendations = this.generateRecommendations(score);

    return {
      overall_score: score.score,
      mttr_score: mttrScore,
      success_rate_score: successRateScore,
      error_budget_score: errorBudgetScore,
      recovery_score: recoveryScore,
      factors: {
        mttr_factor: this.WEIGHTS.mttr,
        success_rate_factor: this.WEIGHTS.successRate,
        error_budget_factor: this.WEIGHTS.errorBudget,
        recovery_success_factor: this.WEIGHTS.recovery,
      },
      recommendations,
    };
  }

  /**
   * Generate recommendations based on score
   */
  private generateRecommendations(score: ResilienceScore): string[] {
    const recommendations: string[] = [];

    if (score.mttr_ms > this.THRESHOLDS.mttrAcceptable) {
      recommendations.push('Reduce MTTR by implementing faster detection and automated recovery');
    }
    if (score.success_rate < this.THRESHOLDS.successRateGood) {
      recommendations.push('Improve success rate through better fault handling and graceful degradation');
    }
    if (score.error_budget < 0.5) {
      recommendations.push('Error budget is low - reduce incident frequency to regain budget');
    }
    if (score.score < 60) {
      recommendations.push('Overall resilience needs improvement - run more chaos experiments to identify weak points');
    }

    if (recommendations.length === 0) {
      recommendations.push('Resilience is healthy - continue regular chaos testing to maintain');
    }

    return recommendations;
  }

  /**
   * Generate tenant-level recommendations
   */
  private generateTenantRecommendations(services: ServiceResilienceSummary[]): string[] {
    const recommendations: string[] = [];

    const weakServices = services.filter(s => s.current_score < 70);
    if (weakServices.length > 0) {
      recommendations.push(`Focus on improving resilience for: ${weakServices.map(s => s.service_id).join(', ')}`);
    }

    const highMttrServices = services.filter(s => s.avg_mttr_ms > 600000);
    if (highMttrServices.length > 0) {
      recommendations.push('Investigate slow recovery times in affected services');
    }

    if (services.length === 0) {
      recommendations.push('Run chaos experiments to start building resilience scores');
    }

    return recommendations;
  }
}