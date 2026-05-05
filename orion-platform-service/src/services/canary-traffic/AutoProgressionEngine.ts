/**
 * AutoProgressionEngine - Canary traffic auto-progression engine
 *
 * Monitors canary metrics and automatically:
 * - Compares canary vs baseline using statistical tests
 * - Advances traffic stages if metrics are healthy
 * - Rolls back if metrics degrade beyond thresholds
 *
 * Phase 3 P3 Service
 */

import { DatabasePool } from '../database';

// ==================== Types ====================

export interface CanaryMetricSample {
  timestamp: Date;
  errorRate: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  cpuUsage: number;
  memoryUsage: number;
  requestRate: number;
}

export interface MetricComparison {
  metricName: string;
  baselineMean: number;
  canaryMean: number;
  baselineStdDev: number;
  canaryStdDev: number;
  pValue: number;
  effectSize: number;
  verdict: 'pass' | 'warn' | 'fail';
  threshold: number;
}

export interface CanaryProgressionResult {
  canaryId: string;
  action: 'advance' | 'rollback' | 'hold' | 'complete';
  confidence: number;
  metricComparisons: MetricComparison[];
  recommendation: string;
  currentPercent: number;
  nextPercent: number;
  triggeredAt: Date;
}

export interface ProgressionConfig {
  analysisWindowMinutes: number;
  minSamples: number;
  errorRateThreshold: number;
  latencyP95Threshold: number;
  cpuThreshold: number;
  confidenceThreshold: number;
  statisticalTest: 't-test' | 'mann-whitney' | 'ks-test';
}

export class AutoProgressionEngine {
  private pool: DatabasePool;

  private readonly DEFAULT_CONFIG: ProgressionConfig = {
    analysisWindowMinutes: 10,
    minSamples: 30,
    errorRateThreshold: 0.05,       // 5% error rate increase is failure
    latencyP95Threshold: 1.25,      // 25% latency increase is failure
    cpuThreshold: 1.30,             // 30% CPU increase is warning
    confidenceThreshold: 0.95,
    statisticalTest: 'mann-whitney',
  };

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Run auto-progression analysis for a canary deployment
   */
  async analyzeAndProgress(canaryId: string): Promise<CanaryProgressionResult> {
    const canary = await this.getCanaryDeployment(canaryId);
    if (!canary) {
      throw new Error(`Canary deployment ${canaryId} not found`);
    }

    if (canary.status !== 'running') {
      throw new Error(`Canary ${canaryId} is not in running state (current: ${canary.status})`);
    }

    // Collect metrics
    const baselineMetrics = await this.collectMetrics(canary.baseline_version, canary.service_name, 'baseline');
    const canaryMetrics = await this.collectMetrics(canary.canary_version, canary.service_name, 'canary');

    if (baselineMetrics.length < this.DEFAULT_CONFIG.minSamples) {
      return this.createResult(canaryId, 'hold', 0, canary.current_percent, canary.current_percent,
        'Insufficient baseline samples', []);
    }
    if (canaryMetrics.length < this.DEFAULT_CONFIG.minSamples) {
      return this.createResult(canaryId, 'hold', 0, canary.current_percent, canary.current_percent,
        'Insufficient canary samples', []);
    }

    // Compare metrics
    const comparisons = await this.compareMetrics(baselineMetrics, canaryMetrics);

    // Determine action
    const action = this.determineAction(comparisons, canary.current_percent, canary.max_percent);

    const nextPercent = action === 'advance'
      ? Math.min(canary.current_percent + (canary.increment_percent || 10), canary.max_percent)
      : action === 'rollback'
        ? 0
        : canary.current_percent;

    const confidence = this.calculateConfidence(comparisons);
    const recommendation = this.generateRecommendation(action, comparisons);

    // Apply action
    await this.applyAction(canaryId, action, nextPercent, comparisons);

    return this.createResult(canaryId, action, confidence, canary.current_percent, nextPercent, recommendation, comparisons);
  }

  /**
   * Get metric comparison for a canary deployment
   */
  async getMetricComparison(canaryId: string): Promise<{
    canaryId: string;
    serviceName: string;
    baselineVersion: string;
    canaryVersion: string;
    currentPercent: number;
    comparisons: MetricComparison[];
    overallVerdict: 'pass' | 'warn' | 'fail';
    recommendation: string;
  }> {
    const canary = await this.getCanaryDeployment(canaryId);
    if (!canary) {
      throw new Error(`Canary deployment ${canaryId} not found`);
    }

    const baselineMetrics = await this.collectMetrics(canary.baseline_version, canary.service_name, 'baseline');
    const canaryMetrics = await this.collectMetrics(canary.canary_version, canary.service_name, 'canary');

    const comparisons = await this.compareMetrics(baselineMetrics, canaryMetrics);

    const failCount = comparisons.filter((c) => c.verdict === 'fail').length;
    const warnCount = comparisons.filter((c) => c.verdict === 'warn').length;

    let overallVerdict: 'pass' | 'warn' | 'fail';
    if (failCount > 0) overallVerdict = 'fail';
    else if (warnCount > 0) overallVerdict = 'warn';
    else overallVerdict = 'pass';

    return {
      canaryId,
      serviceName: canary.service_name,
      baselineVersion: canary.baseline_version,
      canaryVersion: canary.canary_version,
      currentPercent: canary.current_percent,
      comparisons,
      overallVerdict,
      recommendation: this.generateRecommendation(overallVerdict === 'fail' ? 'rollback' : overallVerdict === 'warn' ? 'hold' : 'advance', comparisons),
    };
  }

  // ==================== Private Methods ====================

  private async getCanaryDeployment(canaryId: string): Promise<{
    id: string;
    service_name: string;
    baseline_version: string;
    canary_version: string;
    current_percent: number;
    max_percent: number;
    increment_percent?: number;
    status: string;
  } | null> {
    const result = await this.pool.query(
      `SELECT id, service_name, baseline_version, canary_version, current_percent, max_percent,
              increment_percent, status
       FROM canary_deployments WHERE id = $1`,
      [canaryId]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      service_name: row.service_name,
      baseline_version: row.baseline_version,
      canary_version: row.canary_version,
      current_percent: parseInt(row.current_percent) || 0,
      max_percent: parseInt(row.max_percent) || 100,
      increment_percent: parseInt(row.increment_percent) || 10,
      status: row.status,
    };
  }

  private async collectMetrics(
    version: string,
    serviceName: string,
    role: 'baseline' | 'canary'
  ): Promise<CanaryMetricSample[]> {
    const result = await this.pool.query(
      `SELECT timestamp, error_rate, latency_p50, latency_p95, latency_p99,
              cpu_usage, memory_usage, request_rate
       FROM canary_metrics
       WHERE service_name = $1 AND version = $2 AND role = $3
         AND timestamp >= NOW() - INTERVAL '10 minutes'
       ORDER BY timestamp ASC`,
      [serviceName, version, role]
    );

    return result.rows.map((row: any) => ({
      timestamp: row.timestamp,
      errorRate: parseFloat(row.error_rate) || 0,
      latencyP50: parseFloat(row.latency_p50) || 0,
      latencyP95: parseFloat(row.latency_p95) || 0,
      latencyP99: parseFloat(row.latency_p99) || 0,
      cpuUsage: parseFloat(row.cpu_usage) || 0,
      memoryUsage: parseFloat(row.memory_usage) || 0,
      requestRate: parseFloat(row.request_rate) || 0,
    }));
  }

  private async compareMetrics(
    baseline: CanaryMetricSample[],
    canary: CanaryMetricSample[]
  ): Promise<MetricComparison[]> {
    const comparisons: MetricComparison[] = [];

    // Error rate comparison
    comparisons.push(this.compareSingleMetric(
      'error_rate',
      baseline.map((m) => m.errorRate),
      canary.map((m) => m.errorRate),
      this.DEFAULT_CONFIG.errorRateThreshold,
      'lower-is-better'
    ));

    // Latency P95 comparison
    comparisons.push(this.compareSingleMetric(
      'latency_p95',
      baseline.map((m) => m.latencyP95),
      canary.map((m) => m.latencyP95),
      this.DEFAULT_CONFIG.latencyP95Threshold,
      'lower-is-better'
    ));

    // Latency P99 comparison
    comparisons.push(this.compareSingleMetric(
      'latency_p99',
      baseline.map((m) => m.latencyP99),
      canary.map((m) => m.latencyP99),
      1.5,  // 50% threshold for P99
      'lower-is-better'
    ));

    // CPU usage comparison
    comparisons.push(this.compareSingleMetric(
      'cpu_usage',
      baseline.map((m) => m.cpuUsage),
      canary.map((m) => m.cpuUsage),
      this.DEFAULT_CONFIG.cpuThreshold,
      'lower-is-better'
    ));

    // Memory usage comparison
    comparisons.push(this.compareSingleMetric(
      'memory_usage',
      baseline.map((m) => m.memoryUsage),
      canary.map((m) => m.memoryUsage),
      1.20,  // 20% increase is warning
      'lower-is-better'
    ));

    // Request rate comparison (should be stable)
    comparisons.push(this.compareSingleMetric(
      'request_rate',
      baseline.map((m) => m.requestRate),
      canary.map((m) => m.requestRate),
      0.3,  // 30% deviation is warning
      'stability'
    ));

    return comparisons;
  }

  private compareSingleMetric(
    name: string,
    baselineValues: number[],
    canaryValues: number[],
    threshold: number,
    direction: 'lower-is-better' | 'higher-is-better' | 'stability'
  ): MetricComparison {
    const baselineMean = this.mean(baselineValues);
    const canaryMean = this.mean(canaryValues);
    const baselineStdDev = this.stdDev(baselineValues);
    const canaryStdDev = this.stdDev(canaryValues);

    // Mann-Whitney U test approximation
    const pValue = this.mannWhitneyUTest(baselineValues, canaryValues);

    // Effect size (Cohen's d approximation)
    const pooledStdDev = Math.sqrt((baselineStdDev ** 2 + canaryStdDev ** 2) / 2);
    const effectSize = pooledStdDev > 0 ? (canaryMean - baselineMean) / pooledStdDev : 0;

    // Determine verdict
    let verdict: 'pass' | 'warn' | 'fail';
    if (direction === 'stability') {
      const ratio = baselineMean > 0 ? Math.abs(canaryMean - baselineMean) / baselineMean : 0;
      if (ratio < threshold * 0.5) verdict = 'pass';
      else if (ratio < threshold) verdict = 'warn';
      else verdict = 'fail';
    } else {
      const ratio = baselineMean > 0 ? canaryMean / baselineMean : 0;
      if (ratio < 1 + threshold * 0.5) verdict = 'pass';
      else if (ratio < 1 + threshold) verdict = 'warn';
      else verdict = 'fail';
    }

    return {
      metricName: name,
      baselineMean,
      canaryMean,
      baselineStdDev,
      canaryStdDev,
      pValue,
      effectSize,
      verdict,
      threshold,
    };
  }

  private determineAction(
    comparisons: MetricComparison[],
    currentPercent: number,
    maxPercent: number
  ): 'advance' | 'rollback' | 'hold' | 'complete' {
    const failCount = comparisons.filter((c) => c.verdict === 'fail').length;
    const warnCount = comparisons.filter((c) => c.verdict === 'warn').length;

    // Any critical failure -> rollback
    if (failCount >= 2) return 'rollback';
    if (failCount === 1 && comparisons.some((c) => c.metricName === 'error_rate')) return 'rollback';

    // Already at max -> complete
    if (currentPercent >= maxPercent) return 'complete';

    // Warnings but no failures -> hold and monitor
    if (warnCount > 0) return 'hold';

    // All passing -> advance
    return 'advance';
  }

  private calculateConfidence(comparisons: MetricComparison[]): number {
    if (comparisons.length === 0) return 0;

    const passCount = comparisons.filter((c) => c.verdict === 'pass').length;
    const avgPValue = comparisons.reduce((s, c) => s + (1 - c.pValue), 0) / comparisons.length;

    return Math.round(((passCount / comparisons.length) * 0.6 + avgPValue * 0.4) * 100) / 100;
  }

  private generateRecommendation(action: string, comparisons: MetricComparison[]): string {
    switch (action) {
      case 'advance':
        return 'All metrics within acceptable range - proceeding to next traffic stage';
      case 'rollback':
        const failingMetrics = comparisons.filter((c) => c.verdict === 'fail').map((c) => c.metricName);
        return `Metrics degraded (${failingMetrics.join(', ')}) - initiating rollback`;
      case 'hold':
        const warningMetrics = comparisons.filter((c) => c.verdict === 'warn').map((c) => c.metricName);
        return `Minor anomalies detected (${warningMetrics.join(', ')}) - holding for further observation`;
      case 'complete':
        return 'Canary has reached full traffic - deployment complete';
      default:
        return 'Awaiting analysis';
    }
  }

  private async applyAction(
    canaryId: string,
    action: string,
    nextPercent: number,
    comparisons: MetricComparison[]
  ): Promise<void> {
    switch (action) {
      case 'advance':
        await this.pool.query(
          `UPDATE canary_deployments
           SET current_percent = $2, updated_at = NOW()
           WHERE id = $1`,
          [canaryId, nextPercent]
        );
        break;
      case 'rollback':
        await this.pool.query(
          `UPDATE canary_deployments
           SET current_percent = 0, status = 'rolled_back', updated_at = NOW()
           WHERE id = $1`,
          [canaryId]
        );
        break;
      case 'complete':
        await this.pool.query(
          `UPDATE canary_deployments
           SET status = 'promoted', current_percent = 100, updated_at = NOW()
           WHERE id = $1`,
          [canaryId]
        );
        break;
      case 'hold':
        // No state change, just record analysis
        break;
    }

    // Record analysis result
    await this.pool.query(
      `INSERT INTO canary_analysis_results
        (canary_id, action, confidence, metric_comparisons, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [canaryId, action, this.calculateConfidence(comparisons), JSON.stringify(comparisons)]
    );
  }

  private createResult(
    canaryId: string,
    action: 'advance' | 'rollback' | 'hold' | 'complete',
    confidence: number,
    currentPercent: number,
    nextPercent: number,
    recommendation: string,
    comparisons: MetricComparison[]
  ): CanaryProgressionResult {
    return {
      canaryId,
      action,
      confidence,
      metricComparisons: comparisons,
      recommendation,
      currentPercent,
      nextPercent,
      triggeredAt: new Date(),
    };
  }

  // ==================== Statistical Helpers ====================

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  private stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const m = this.mean(values);
    const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  /**
   * Mann-Whitney U test - non-parametric test for comparing two samples
   * Returns approximate p-value
   */
  private mannWhitneyUTest(sampleA: number[], sampleB: number[]): number {
    const n1 = sampleA.length;
    const n2 = sampleB.length;

    if (n1 < 2 || n2 < 2) return 1.0;

    // Combine and rank
    const combined = (sampleA as any).map((v: any, i: number) => ({ value: v, group: 'A' as const, index: i }))
      .concat((sampleB as any).map((v: any, i: number) => ({ value: v, group: 'B' as const, index: i })))
      .sort((a: any, b: any) => a.value - b.value);

    // Assign ranks (with tie handling)
    const ranks: Map<string, number> = new Map();
    let i = 0;
    while (i < combined.length) {
      let j = i;
      while (j < combined.length && combined[j].value === combined[i].value) j++;
      const avgRank = (i + j + 1) / 2;
      for (let k = i; k < j; k++) {
        ranks.set(`${combined[k].group}-${combined[k].index}`, avgRank);
      }
      i = j;
    }

    // Sum of ranks for group A
    const rankSumA = sampleA.reduce((sum, _, idx) => sum + (ranks.get(`A-${idx}`) || 0), 0);
    const uA = rankSumA - (n1 * (n1 + 1)) / 2;
    const uB = n1 * n2 - uA;
    const u = Math.min(uA, uB);

    // Normal approximation for large samples
    const mu = (n1 * n2) / 2;
    const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);

    if (sigma === 0) return 1.0;

    const z = (u - mu) / sigma;
    // Approximate p-value from standard normal
    return 2 * (1 - this.normalCDF(Math.abs(z)));
  }

  /**
   * Approximation of standard normal CDF
   */
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }
}
