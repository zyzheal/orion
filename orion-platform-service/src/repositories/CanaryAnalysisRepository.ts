import { BaseRepository } from '../db/base-repository';

// Entity types
export interface CanaryAnalysisRunEntity {
  id: string;
  deploymentId: string;
  runNumber: number;
  trafficSplit: Record<string, number>;
  status: string;
  confidence: number | null;
  decision: string | null;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
}

export interface CanaryMetricResultEntity {
  id: string;
  runId: string;
  metricName: string;
  baselineValue: number | null;
  canaryValue: number | null;
  mannWhitneyP: number | null;
  ksStatistic: number | null;
  cliffDelta: number | null;
  verdict: string | null;
  category: string | null;
}

export interface CanaryMLResultEntity {
  id: string;
  runId: string;
  modelName: string;
  prediction: string | null;
  confidence: number | null;
  shapExplanation: Record<string, number> | null;
  clusterId: number | null;
}

export interface CanaryAnalysisConfigEntity {
  id: string;
  serviceName: string;
  environment: string;
  analysisIntervalSec: number;
  maxRounds: number;
  warmupPeriodSec: number;
  promoteThreshold: number;
  rollbackThreshold: number;
  trafficStep: number;
  metricWeights: Record<string, number> | null;
  excludedMetrics: string[];
  sloMetrics: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CanaryDecisionEntity {
  id: string;
  runId: string;
  decision: string;
  reason: string | null;
  overriddenBy: string | null;
  overrideReason: string | null;
  decidedAt: Date;
}

// Main Repository
export class CanaryAnalysisRepository extends BaseRepository<CanaryAnalysisRunEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'canary_analysis_runs');
  }

  async findByDeployment(deploymentId: string): Promise<CanaryAnalysisRunEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM canary_analysis_runs WHERE deployment_id = $1 ORDER BY started_at DESC`,
      [deploymentId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<CanaryAnalysisRunEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM canary_analysis_runs WHERE status = $1 ORDER BY started_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateRunStatus(id: string, status: string, decision: string, confidence: number, completedAt: Date): Promise<CanaryAnalysisRunEntity | null> {
    const result = await this.db.query(
      `UPDATE canary_analysis_runs SET status = $1, decision = $2, confidence = $3, completed_at = $4, duration_ms = EXTRACT(EPOCH FROM ($4 - started_at)) * 1000 WHERE id = $5 RETURNING *`,
      [status, decision, confidence, completedAt, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): CanaryAnalysisRunEntity {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      runNumber: row.run_number ?? 0,
      trafficSplit: row.traffic_split ?? { canary: 10, baseline: 90 },
      status: row.status ?? 'running',
      confidence: row.confidence,
      decision: row.decision,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationMs: row.duration_ms,
    };
  }
}

// Metric Results Repository
export class CanaryMetricResultRepository extends BaseRepository<CanaryMetricResultEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'canary_metric_results');
  }

  async findByRun(runId: string): Promise<CanaryMetricResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM canary_metric_results WHERE run_id = $1 ORDER BY category, metric_name`,
      [runId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async batchCreate(metrics: Omit<CanaryMetricResultEntity, 'id'>[]): Promise<CanaryMetricResultEntity[]> {
    const results: CanaryMetricResultEntity[] = [];
    for (const metric of metrics) {
      const result = await this.db.query(
        `INSERT INTO canary_metric_results (run_id, metric_name, baseline_value, canary_value, mann_whitney_p, ks_statistic, cliff_delta, verdict, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [metric.runId, metric.metricName, metric.baselineValue, metric.canaryValue, metric.mannWhitneyP, metric.ksStatistic, metric.cliffDelta, metric.verdict, metric.category],
      );
      results.push(this.mapRowToEntity(result.rows[0]));
    }
    return results;
  }

  protected mapRowToEntity(row: any): CanaryMetricResultEntity {
    return {
      id: row.id,
      runId: row.run_id,
      metricName: row.metric_name,
      baselineValue: row.baseline_value,
      canaryValue: row.canary_value,
      mannWhitneyP: row.mann_whitney_p,
      ksStatistic: row.ks_statistic,
      cliffDelta: row.cliff_delta,
      verdict: row.verdict,
      category: row.category,
    };
  }
}

// ML Results Repository
export class CanaryMLResultRepository extends BaseRepository<CanaryMLResultEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'canary_ml_results');
  }

  async findByRun(runId: string): Promise<CanaryMLResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM canary_ml_results WHERE run_id = $1 ORDER BY model_name`,
      [runId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async batchCreate(mlResults: Omit<CanaryMLResultEntity, 'id'>[]): Promise<CanaryMLResultEntity[]> {
    const results: CanaryMLResultEntity[] = [];
    for (const ml of mlResults) {
      const result = await this.db.query(
        `INSERT INTO canary_ml_results (run_id, model_name, prediction, confidence, shap_explanation, cluster_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [ml.runId, ml.modelName, ml.prediction, ml.confidence, ml.shapExplanation ? JSON.stringify(ml.shapExplanation) : null, ml.clusterId],
      );
      results.push(this.mapRowToEntity(result.rows[0]));
    }
    return results;
  }

  protected mapRowToEntity(row: any): CanaryMLResultEntity {
    return {
      id: row.id,
      runId: row.run_id,
      modelName: row.model_name,
      prediction: row.prediction,
      confidence: row.confidence,
      shapExplanation: row.shap_explanation,
      clusterId: row.cluster_id,
    };
  }
}

// Config Repository
export class CanaryAnalysisConfigRepository extends BaseRepository<CanaryAnalysisConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'canary_analysis_configs');
  }

  async findByServiceEnv(serviceName: string, environment: string): Promise<CanaryAnalysisConfigEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM canary_analysis_configs WHERE service_name = $1 AND environment = $2`,
      [serviceName, environment],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAll(): Promise<{ entities: CanaryAnalysisConfigEntity[]; total: number }> {
    const result = await this.db.query(
      `SELECT * FROM canary_analysis_configs ORDER BY service_name, environment`,
    );
    const entities = result.rows.map(row => this.mapRowToEntity(row));
    return { entities, total: entities.length };
  }

  async updateConfig(id: string, updates: Partial<CanaryAnalysisConfigEntity>): Promise<CanaryAnalysisConfigEntity | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ['analysisIntervalSec', 'maxRounds', 'warmupPeriodSec', 'promoteThreshold', 'rollbackThreshold', 'trafficStep', 'metricWeights', 'excludedMetrics', 'sloMetrics'];
    for (const field of allowedFields) {
      if (updates[field as keyof CanaryAnalysisConfigEntity] !== undefined) {
        const dbField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        fields.push(`${dbField} = $${paramIndex}`);
        const value = updates[field as keyof CanaryAnalysisConfigEntity];
        values.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    values.push(id);

    const result = await this.db.query(
      `UPDATE canary_analysis_configs SET ${fields.join(', ')} WHERE id = $${paramIndex + 1} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): CanaryAnalysisConfigEntity {
    return {
      id: row.id,
      serviceName: row.service_name,
      environment: row.environment,
      analysisIntervalSec: row.analysis_interval_sec ?? 300,
      maxRounds: row.max_rounds ?? 5,
      warmupPeriodSec: row.warmup_period_sec ?? 600,
      promoteThreshold: row.promote_threshold ?? 0.75,
      rollbackThreshold: row.rollback_threshold ?? 0.60,
      trafficStep: row.traffic_step ?? 20,
      metricWeights: row.metric_weights,
      excludedMetrics: row.excluded_metrics ?? [],
      sloMetrics: row.slo_metrics ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Decision Repository
export class CanaryDecisionRepository extends BaseRepository<CanaryDecisionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'canary_decisions');
  }

  async findByRun(runId: string): Promise<CanaryDecisionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM canary_decisions WHERE run_id = $1 ORDER BY decided_at`,
      [runId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): CanaryDecisionEntity {
    return {
      id: row.id,
      runId: row.run_id,
      decision: row.decision,
      reason: row.reason,
      overriddenBy: row.overridden_by,
      overrideReason: row.override_reason,
      decidedAt: row.decided_at,
    };
  }
}