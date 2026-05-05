/**
 * PerformanceBaselineService - Performance baseline management
 *
 * Provides baseline creation, evaluation, retrieval, and update
 * for service performance metrics with tenant isolation.
 * Uses in-memory Map storage (can migrate to Repository later).
 */
import { v4 as uuidv4 } from 'uuid';

export interface PerformanceBaseline {
  id: string;
  tenantId: string;
  service: string;
  environment?: string;
  metrics: Record<string, number>;
  thresholds: Record<string, { min: number; max: number }>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface EvaluationResult {
  baselineId: string;
  service: string;
  overall: 'healthy' | 'degraded' | 'critical';
  details: {
    metric: string;
    current: number;
    min: number;
    max: number;
    status: 'within' | 'below' | 'above';
    deviation: number;
  }[];
  evaluatedAt: Date;
}

export interface PerformanceTestResult {
  id: string;
  tenantId: string;
  service: string;
  baselineId?: string;
  testName: string;
  metrics: Record<string, number>;
  status: 'pass' | 'fail' | 'warn';
  failures?: { metric: string; expected: { min: number; max: number }; actual: number }[];
  duration: number;
  timestamp: Date;
}

export interface RegressionAnalysis {
  service: string;
  baselineId: string;
  currentEvaluationId: string;
  regressions: {
    metric: string;
    baselineValue: number;
    currentValue: number;
    deviation: number;
    deviationPercent: number;
    severity: 'minor' | 'moderate' | 'severe' | 'critical';
  }[];
  overallStatus: 'no_regression' | 'minor_regression' | 'major_regression';
  analyzedAt: Date;
}

export class PerformanceBaselineService {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private evaluations: Map<string, EvaluationResult> = new Map();
  private testResults: Map<string, PerformanceTestResult> = new Map();

  /**
   * Create a performance baseline for a service
   */
  createBaseline(
    tenantId: string,
    service: string,
    metrics: Record<string, number>,
    thresholds?: Record<string, { min: number; max: number }>
  ): PerformanceBaseline {
    const id = uuidv4();
    const now = new Date();

    // Auto-generate thresholds if not provided (+/- 20% of metric value)
    const computedThresholds = thresholds ?? {};
    for (const [key, value] of Object.entries(metrics)) {
      if (!computedThresholds[key]) {
        computedThresholds[key] = {
          min: Math.round(value * 0.8 * 100) / 100,
          max: Math.round(value * 1.2 * 100) / 100,
        };
      }
    }

    const baseline: PerformanceBaseline = {
      id,
      tenantId,
      service,
      metrics,
      thresholds: computedThresholds,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    this.baselines.set(id, baseline);
    return baseline;
  }

  /**
   * Evaluate current performance against baseline
   */
  evaluatePerformance(
    tenantId: string,
    service: string,
    currentMetrics: Record<string, number>
  ): EvaluationResult | null {
    const baseline = this.findByTenantAndService(tenantId, service);
    if (!baseline) {
      return null;
    }

    const details: EvaluationResult['details'] = [];
    let degradedCount = 0;
    let criticalCount = 0;

    for (const [metric, value] of Object.entries(currentMetrics)) {
      const threshold = baseline.thresholds[metric];
      if (!threshold) {
        details.push({ metric, current: value, min: 0, max: Infinity, status: 'within', deviation: 0 });
        continue;
      }

      let status: 'within' | 'below' | 'above';
      if (value < threshold.min) {
        status = 'below';
        degradedCount++;
      } else if (value > threshold.max) {
        status = 'above';
        degradedCount++;
      } else {
        status = 'within';
      }

      // Critical if deviation > 50%
      const deviation = Math.abs(value - (threshold.min + threshold.max) / 2);
      const midRange = (threshold.max - threshold.min) / 2;
      if (midRange > 0 && deviation > midRange * 2.5) {
        criticalCount++;
      }

      details.push({ metric, current: value, min: threshold.min, max: threshold.max, status, deviation: 0 });
    }

    const overall: EvaluationResult['overall'] =
      criticalCount > 0 ? 'critical' : degradedCount > 0 ? 'degraded' : 'healthy';

    const result: EvaluationResult = {
      baselineId: baseline.id,
      service,
      overall,
      details,
      evaluatedAt: new Date(),
    };

    // Save evaluation for history
    this.saveEvaluation(result);

    return result;
  }

  /**
   * Get baseline by tenant and service
   */
  getBaseline(tenantId: string, service: string): PerformanceBaseline | null {
    return this.findByTenantAndService(tenantId, service);
  }

  /**
   * Update baseline metrics and thresholds
   */
  updateBaseline(
    tenantId: string,
    service: string,
    metrics: Record<string, number>,
    thresholds?: Record<string, { min: number; max: number }>
  ): PerformanceBaseline | null {
    const baseline = this.findByTenantAndService(tenantId, service);
    if (!baseline) {
      return null;
    }

    baseline.metrics = metrics;
    if (thresholds) {
      baseline.thresholds = thresholds;
    }
    baseline.updatedAt = new Date();
    baseline.version += 1;

    return baseline;
  }

  /**
   * Delete baseline
   */
  deleteBaseline(tenantId: string, service: string): boolean {
    for (const [id, baseline] of this.baselines.entries()) {
      if (baseline.tenantId === tenantId && baseline.service === service) {
        this.baselines.delete(id);
        return true;
      }
    }
    return false;
  }

  /**
   * List all baselines for a tenant
   */
  listBaselines(tenantId: string): PerformanceBaseline[] {
    return Array.from(this.baselines.values()).filter((b) => b.tenantId === tenantId);
  }

  /**
   * Find baseline by tenant and service
   */
  private findByTenantAndService(
    tenantId: string,
    service: string
  ): PerformanceBaseline | null {
    for (const baseline of this.baselines.values()) {
      if (baseline.tenantId === tenantId && baseline.service === service) {
        return baseline;
      }
    }
    return null;
  }

  // ========== Evaluation History ==========

  /**
   * Save an evaluation result for history
   */
  saveEvaluation(result: EvaluationResult): void {
    const id = `eval-${result.baselineId}-${Date.now()}`;
    this.evaluations.set(id, result);
  }

  /**
   * Get evaluation history for a baseline
   */
  getEvaluationHistory(baselineId: string, limit?: number): EvaluationResult[] {
    const history = Array.from(this.evaluations.values())
      .filter(e => e.baselineId === baselineId)
      .sort((a, b) => b.evaluatedAt.getTime() - a.evaluatedAt.getTime());
    return limit ? history.slice(0, limit) : history;
  }

  // ========== Performance Test Results ==========

  /**
   * Record a performance test result
   */
  recordTestResult(
    tenantId: string,
    service: string,
    input: {
      baselineId?: string;
      testName: string;
      metrics: Record<string, number>;
      duration: number;
    }
  ): PerformanceTestResult {
    const id = uuidv4();
    let status: PerformanceTestResult['status'] = 'pass';
    let failures: PerformanceTestResult['failures'] | undefined;

    // Compare against baseline if available
    if (input.baselineId) {
      const baseline = this.baselines.get(input.baselineId);
      if (baseline) {
        const testFailures: { metric: string; expected: { min: number; max: number }; actual: number }[] = [];
        for (const [metric, value] of Object.entries(input.metrics)) {
          const threshold = baseline.thresholds[metric];
          if (threshold && (value < threshold.min || value > threshold.max)) {
            testFailures.push({ metric, expected: threshold, actual: value });
          }
        }
        if (testFailures.length > 0) {
          status = testFailures.length > 2 ? 'fail' : 'warn';
          failures = testFailures;
        }
      }
    }

    const result: PerformanceTestResult = {
      id,
      tenantId,
      service,
      baselineId: input.baselineId,
      testName: input.testName,
      metrics: input.metrics,
      status,
      failures,
      duration: input.duration,
      timestamp: new Date(),
    };

    this.testResults.set(id, result);
    return result;
  }

  /**
   * Get test results for a service
   */
  getTestResults(service: string, limit?: number): PerformanceTestResult[] {
    const results = Array.from(this.testResults.values())
      .filter(r => r.service === service)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Get test result by ID
   */
  getTestResultById(testId: string): PerformanceTestResult | null {
    return this.testResults.get(testId) || null;
  }

  // ========== Regression Detection ==========

  /**
   * Detect performance regression by comparing current metrics against baseline
   */
  detectRegression(
    tenantId: string,
    service: string,
    currentMetrics: Record<string, number>
  ): RegressionAnalysis | null {
    const baseline = this.findByTenantAndService(tenantId, service);
    if (!baseline) return null;

    const regressions: RegressionAnalysis['regressions'] = [];

    for (const [metric, currentValue] of Object.entries(currentMetrics)) {
      const baselineValue = baseline.metrics[metric];
      if (baselineValue === undefined) continue;

      const threshold = baseline.thresholds[metric];
      if (!threshold) continue;

      // Check if current value exceeds threshold
      if (currentValue > threshold.max) {
        const deviation = currentValue - baselineValue;
        const deviationPercent = baselineValue > 0 ? Math.round((deviation / baselineValue) * 10000) / 100 : 0;

        let severity: RegressionAnalysis['regressions'][number]['severity'];
        if (deviationPercent > 50) severity = 'critical';
        else if (deviationPercent > 30) severity = 'severe';
        else if (deviationPercent > 15) severity = 'moderate';
        else severity = 'minor';

        regressions.push({
          metric,
          baselineValue,
          currentValue,
          deviation,
          deviationPercent,
          severity,
        });
      }
    }

    let overallStatus: RegressionAnalysis['overallStatus'];
    const maxSeverity = regressions.length > 0 ? Math.max(...regressions.map(r =>
      r.severity === 'critical' ? 4 : r.severity === 'severe' ? 3 : r.severity === 'moderate' ? 2 : 1
    )) : 0;

    if (maxSeverity >= 3) overallStatus = 'major_regression';
    else if (maxSeverity >= 1) overallStatus = 'minor_regression';
    else overallStatus = 'no_regression';

    return {
      service,
      baselineId: baseline.id,
      currentEvaluationId: `current-${Date.now()}`,
      regressions,
      overallStatus,
      analyzedAt: new Date(),
    };
  }

  /**
   * Get all baselines (for admin/listing)
   */
  getAllBaselines(): PerformanceBaseline[] {
    return Array.from(this.baselines.values());
  }

  /**
   * Get baseline by ID
   */
  getBaselineById(id: string): PerformanceBaseline | null {
    return this.baselines.get(id) || null;
  }
}

export default PerformanceBaselineService;
