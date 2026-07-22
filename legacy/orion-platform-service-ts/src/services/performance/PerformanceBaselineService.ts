/**
 * PerformanceBaselineService - Performance baseline management
 *
 * Provides baseline creation, evaluation, retrieval, and update
 * for service performance metrics with tenant isolation.
 * Uses PostgreSQL Repository pattern for persistence.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  PerformanceBaselineRepository,
  PerformanceBaselineEntity,
  PerformanceEvaluationRepository,
  PerformanceEvaluationEntity,
  PerformanceTestResultRepository,
  PerformanceTestResultEntity,
} from '../../repositories/PerformanceRepository';
import { OrionError, ErrorCode } from '../../errors';

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
  private baselineRepo: PerformanceBaselineRepository;
  private evaluationRepo: PerformanceEvaluationRepository;
  private testResultRepo: PerformanceTestResultRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.baselineRepo = new PerformanceBaselineRepository(db);
    this.evaluationRepo = new PerformanceEvaluationRepository(db);
    this.testResultRepo = new PerformanceTestResultRepository(db);
  }

  /**
   * Create a performance baseline for a service
   */
  async createBaseline(
    tenantId: string,
    service: string,
    metrics: Record<string, number>,
    thresholds?: Record<string, { min: number; max: number }>
  ): Promise<PerformanceBaseline> {
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

    const entity = await this.baselineRepo.create({
      id,
      tenant_id: tenantId,
      service,
      environment: null,
      metrics,
      thresholds: computedThresholds,
      version: 1,
    });

    return this.mapEntityToBaseline(entity);
  }

  /**
   * Evaluate current performance against baseline
   */
  async evaluatePerformance(
    tenantId: string,
    service: string,
    currentMetrics: Record<string, number>
  ): Promise<EvaluationResult | null> {
    const baseline = await this.findByTenantAndService(tenantId, service);
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
    await this.saveEvaluation(result, tenantId);

    return result;
  }

  /**
   * Get baseline by tenant and service
   */
  async getBaseline(tenantId: string, service: string): Promise<PerformanceBaseline | null> {
    return this.findByTenantAndService(tenantId, service);
  }

  /**
   * Update baseline metrics and thresholds
   */
  async updateBaseline(
    tenantId: string,
    service: string,
    metrics: Record<string, number>,
    thresholds?: Record<string, { min: number; max: number }>
  ): Promise<PerformanceBaseline | null> {
    const baseline = await this.findByTenantAndService(tenantId, service);
    if (!baseline) {
      return null;
    }

    const entity = await this.baselineRepo.update(baseline.id, {
      metrics,
      ...(thresholds ? { thresholds } : {}),
      updated_at: new Date(),
      version: baseline.version + 1,
    });
    if (!entity) throw new OrionError('Failed to update performance baseline', ErrorCode.OPERATION_FAILED);
    return this.mapEntityToBaseline(entity);
  }

  /**
   * Delete baseline
   */
  async deleteBaseline(tenantId: string, service: string): Promise<boolean> {
    return this.baselineRepo.deleteByTenantAndService(tenantId, service);
  }

  /**
   * List all baselines for a tenant
   */
  async listBaselines(tenantId: string): Promise<PerformanceBaseline[]> {
    const entities = await this.baselineRepo.findByTenant(tenantId);
    return entities.map(e => this.mapEntityToBaseline(e));
  }

  /**
   * Find baseline by tenant and service
   */
  private async findByTenantAndService(
    tenantId: string,
    service: string
  ): Promise<PerformanceBaseline | null> {
    const entity = await this.baselineRepo.findByTenantAndService(tenantId, service);
    return entity ? this.mapEntityToBaseline(entity) : null;
  }

  // ========== Evaluation History ==========

  /**
   * Save an evaluation result for history
   */
  async saveEvaluation(result: EvaluationResult, tenantId: string): Promise<void> {
    await this.evaluationRepo.create({
      id: `eval-${result.baselineId}-${Date.now()}`,
      baseline_id: result.baselineId,
      tenant_id: tenantId,
      service: result.service,
      overall: result.overall,
      details: result.details,
      evaluated_at: result.evaluatedAt,
    });
  }

  /**
   * Get evaluation history for a baseline
   */
  async getEvaluationHistory(baselineId: string, limit?: number): Promise<EvaluationResult[]> {
    const entities = await this.evaluationRepo.findByBaselineId(baselineId, limit);
    return entities.map(e => ({
      baselineId: e.baseline_id,
      service: e.service,
      overall: e.overall,
      details: e.details as EvaluationResult['details'],
      evaluatedAt: e.evaluated_at,
    }));
  }

  // ========== Performance Test Results ==========

  /**
   * Record a performance test result
   */
  async recordTestResult(
    tenantId: string,
    service: string,
    input: {
      baselineId?: string;
      testName: string;
      metrics: Record<string, number>;
      duration: number;
    }
  ): Promise<PerformanceTestResult> {
    const id = uuidv4();
    let status: PerformanceTestResult['status'] = 'pass';
    let failures: PerformanceTestResult['failures'] | undefined;

    // Compare against baseline if available
    if (input.baselineId) {
      const baselineEntity = await this.baselineRepo.findById(input.baselineId);
      if (baselineEntity) {
        const baseline = this.mapEntityToBaseline(baselineEntity);
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

    const entity = await this.testResultRepo.create({
      id,
      tenant_id: tenantId,
      service,
      baseline_id: input.baselineId ?? null,
      test_name: input.testName,
      metrics: input.metrics,
      status,
      failures: failures ?? null,
      duration: input.duration,
      timestamp: new Date(),
    });

    return this.mapEntityToTestResult(entity);
  }

  /**
   * Get test results for a service
   */
  async getTestResults(service: string, limit?: number): Promise<PerformanceTestResult[]> {
    const entities = await this.testResultRepo.findByService(service, limit);
    return entities.map(e => this.mapEntityToTestResult(e));
  }

  /**
   * Get test result by ID
   */
  async getTestResultById(testId: string): Promise<PerformanceTestResult | null> {
    const entity = await this.testResultRepo.findById(testId);
    return entity ? this.mapEntityToTestResult(entity) : null;
  }

  // ========== Regression Detection ==========

  /**
   * Detect performance regression by comparing current metrics against baseline
   */
  async detectRegression(
    tenantId: string,
    service: string,
    currentMetrics: Record<string, number>
  ): Promise<RegressionAnalysis | null> {
    const baseline = await this.findByTenantAndService(tenantId, service);
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
  async getAllBaselines(): Promise<PerformanceBaseline[]> {
    // Note: BaseRepository.findAll requires a where clause for tenant isolation
    // This returns all across all tenants - use with caution
    const result = await this.baselineRepo.findAll({ limit: 1000 });
    return result.entities.map(e => this.mapEntityToBaseline(e));
  }

  /**
   * Get baseline by ID
   */
  async getBaselineById(id: string): Promise<PerformanceBaseline | null> {
    const entity = await this.baselineRepo.findById(id);
    return entity ? this.mapEntityToBaseline(entity) : null;
  }

  // ========== Entity Mapping ==========

  private mapEntityToBaseline(entity: PerformanceBaselineEntity): PerformanceBaseline {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      service: entity.service,
      environment: entity.environment ?? undefined,
      metrics: entity.metrics,
      thresholds: entity.thresholds,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
      version: entity.version,
    };
  }

  private mapEntityToTestResult(entity: PerformanceTestResultEntity): PerformanceTestResult {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      service: entity.service,
      baselineId: entity.baseline_id ?? undefined,
      testName: entity.test_name,
      metrics: entity.metrics,
      status: entity.status,
      failures: entity.failures as PerformanceTestResult['failures'] | undefined,
      duration: entity.duration,
      timestamp: entity.timestamp,
    };
  }
}

export default PerformanceBaselineService;
