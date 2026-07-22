import { createLogger } from '../../utils/logger';
const logger = createLogger('ChaosExperimentService');
import { DatabasePool } from '../database';
/**
 * ChaosExperimentService - Business logic for Chaos Engineering
 *
 * Implements chaos experiment management including:
 * - Experiment definition and execution
 * - Fault injection orchestration
 * - Pre-release verification
 * - Experiment result tracking
 *
 * Phase 3 P1 Service
 */

// ==================== Types ====================

export interface ChaosExperimentScope {
  tenant_id: string;
  service_id?: string;
  environment: 'staging' | 'production';
}

export interface ChaosFault {
  type: 'network_latency' | 'service_down' | 'cpu_stress' | 'memory_stress' | 'disk_full';
  target: string;
  config: Record<string, unknown>;
  duration_ms: number;
  delay_ms: number;
}

export interface ChaosExperiment {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  scope: ChaosExperimentScope;
  faults: ChaosFault[];
  steady_state_hypothesis: string | null;
  auto_rollback: boolean;
  status: 'draft' | 'active' | 'completed' | 'archived';
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChaosEvent {
  timestamp: Date;
  type: 'inject' | 'detect' | 'recover' | 'rollback';
  service: string;
  details: string;
}

export interface ChaosRunMetrics {
  mttr_ms: number;
  affected_services: string[];
  error_count: number;
  recovered: boolean;
}

export interface ChaosRun {
  id: string;
  experiment_id: string;
  status: 'running' | 'completed' | 'failed' | 'rolled_back';
  timeline: ChaosEvent[];
  metrics: ChaosRunMetrics;
  started_at: Date;
  ended_at: Date | null;
}

export interface CreateExperimentInput {
  tenant_id: string;
  name: string;
  description?: string;
  scope: ChaosExperimentScope;
  faults: ChaosFault[];
  steady_state_hypothesis?: string;
  auto_rollback?: boolean;
  created_by?: string;
}

export interface RunExperimentInput {
  dry_run?: boolean;
}

export interface PreReleaseVerifyInput {
  service_id: string;
  environment: 'staging' | 'production';
  pipeline_id?: string;
}

export class ChaosExperimentServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ChaosExperimentServiceError';
  }
}

// ==================== Repository ====================

export class ChaosExperimentRepository {

  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<ChaosExperiment | null> {
    const result = await this.pool.query(
      'SELECT * FROM chaos_experiments WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(options: { tenant_id?: string; status?: string }): Promise<ChaosExperiment[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.tenant_id) {
      conditions.push(`tenant_id = $${paramIndex}`);
      params.push(options.tenant_id);
      paramIndex++;
    }

    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.pool.query(
      `SELECT * FROM chaos_experiments ${whereClause} ORDER BY created_at DESC`
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async create(input: CreateExperimentInput): Promise<ChaosExperiment> {
    const result = await this.pool.query(
      `INSERT INTO chaos_experiments 
        (tenant_id, name, description, scope, faults, steady_state_hypothesis, auto_rollback, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8)
       RETURNING *`,
      [
        input.tenant_id,
        input.name,
        input.description || null,
        JSON.stringify(input.scope),
        JSON.stringify(input.faults),
        input.steady_state_hypothesis || null,
        input.auto_rollback ?? true,
        input.created_by || null,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, updates: Partial<CreateExperimentInput>): Promise<ChaosExperiment | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      fields.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }
    if (updates.description) {
      fields.push(`description = $${paramIndex}`);
      values.push(updates.description);
      paramIndex++;
    }
    if (updates.scope) {
      fields.push(`scope = $${paramIndex}`);
      values.push(JSON.stringify(updates.scope));
      paramIndex++;
    }
    if (updates.faults) {
      fields.push(`faults = $${paramIndex}`);
      values.push(JSON.stringify(updates.faults));
      paramIndex++;
    }
    if (updates.steady_state_hypothesis) {
      fields.push(`steady_state_hypothesis = $${paramIndex}`);
      values.push(updates.steady_state_hypothesis);
      paramIndex++;
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = now()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE chaos_experiments SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE chaos_experiments SET status = $2, updated_at = now() WHERE id = $1`,
      [id, status]
    );
    return result.rowCount > 0;
  }

  async findRunById(runId: string): Promise<ChaosRun | null> {
    const result = await this.pool.query(
      'SELECT * FROM chaos_runs WHERE id = $1',
      [runId]
    );
    return result.rows[0] ? this.mapRunRow(result.rows[0]) : null;
  }

  async createRun(experimentId: string): Promise<ChaosRun> {
    const result = await this.pool.query(
      `INSERT INTO chaos_runs 
        (experiment_id, status, timeline, metrics)
       VALUES ($1, 'running', '[]', '{}')
       RETURNING *`,
      [experimentId]
    );
    return this.mapRunRow(result.rows[0]);
  }

  async updateRun(runId: string, updates: Partial<ChaosRun>): Promise<ChaosRun | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status) {
      fields.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }
    if (updates.timeline) {
      fields.push(`timeline = $${paramIndex}`);
      values.push(JSON.stringify(updates.timeline));
      paramIndex++;
    }
    if (updates.metrics) {
      fields.push(`metrics = $${paramIndex}`);
      values.push(JSON.stringify(updates.metrics));
      paramIndex++;
    }
    if (updates.ended_at) {
      fields.push(`ended_at = $${paramIndex}`);
      values.push(updates.ended_at);
      paramIndex++;
    }

    if (fields.length === 0) return this.findRunById(runId);

    const result = await this.pool.query(
      `UPDATE chaos_runs SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      [...values, runId]
    );
    return result.rows[0] ? this.mapRunRow(result.rows[0]) : null;
  }

  async listRuns(experimentId: string): Promise<ChaosRun[]> {
    const result = await this.pool.query(
      `SELECT * FROM chaos_runs WHERE experiment_id = $1 ORDER BY started_at DESC`,
      [experimentId]
    );
    return result.rows.map(row => this.mapRunRow(row));
  }

  private mapRow(row: any): ChaosExperiment {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      scope: row.scope || {},
      faults: row.faults || [],
      steady_state_hypothesis: row.steady_state_hypothesis,
      auto_rollback: row.auto_rollback ?? true,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapRunRow(row: any): ChaosRun {
    return {
      id: row.id,
      experiment_id: row.experiment_id,
      status: row.status,
      timeline: row.timeline || [],
      metrics: row.metrics || { mttr_ms: 0, affected_services: [], error_count: 0, recovered: false },
      started_at: row.started_at,
      ended_at: row.ended_at,
    };
  }
}

// ==================== Service ====================

export class ChaosExperimentService {
  private repository: ChaosExperimentRepository;

  constructor(private pool: DatabasePool) {
    this.repository = new ChaosExperimentRepository(this.pool);
  }

  /**
   * Create a new chaos experiment
   */
  async createExperiment(input: CreateExperimentInput): Promise<ChaosExperiment> {
    // Validate faults
    for (const fault of input.faults) {
      if (!this.validateFault(fault)) {
        throw new ChaosExperimentServiceError(
          `Invalid fault configuration: ${fault.type}`,
          'INVALID_FAULT'
        );
      }
    }

    // Check production safety guard
    if (input.scope.environment === 'production') {
      // Would require additional confirmation in production
      logger.warn(`[ChaosExperiment] Production experiment created: ${input.name}`);
    }

    return this.repository.create(input);
  }

  /**
   * Get experiment by ID
   */
  async getExperiment(experimentId: string): Promise<ChaosExperiment> {
    const experiment = await this.repository.findById(experimentId);
    if (!experiment) {
      throw new ChaosExperimentServiceError(
        `Experiment not found: ${experimentId}`,
        'EXPERIMENT_NOT_FOUND'
      );
    }
    return experiment;
  }

  /**
   * List experiments
   */
  async listExperiments(options: { tenant_id?: string; status?: string }): Promise<{
    data: ChaosExperiment[];
  }> {
    const experiments = await this.repository.list(options);
    return { data: experiments };
  }

  /**
   * Update experiment
   */
  async updateExperiment(
    experimentId: string,
    updates: Partial<CreateExperimentInput>
  ): Promise<ChaosExperiment> {
    const experiment = await this.getExperiment(experimentId);

    if (experiment.status !== 'draft') {
      throw new ChaosExperimentServiceError(
        'Cannot update non-draft experiment',
        'INVALID_STATUS'
      );
    }

    const updated = await this.repository.update(experimentId, updates);
    return updated!;
  }

  /**
   * Activate experiment (ready for execution)
   */
  async activateExperiment(experimentId: string): Promise<ChaosExperiment> {
    const experiment = await this.getExperiment(experimentId);

    if (experiment.status !== 'draft') {
      throw new ChaosExperimentServiceError(
        'Only draft experiments can be activated',
        'INVALID_STATUS'
      );
    }

    await this.repository.updateStatus(experimentId, 'active');
    return this.getExperiment(experimentId);
  }

  /**
   * Execute experiment
   */
  async runExperiment(experimentId: string, input: RunExperimentInput): Promise<{
    run_id: string;
    status: string;
    started_at: Date;
    dry_run: boolean;
  }> {
    const experiment = await this.getExperiment(experimentId);

    if (experiment.status !== 'active') {
      throw new ChaosExperimentServiceError(
        'Only active experiments can be run',
        'INVALID_STATUS'
      );
    }

    // Production safety guard
    if (experiment.scope.environment === 'production' && !input.dry_run) {
      // In real implementation, would require explicit confirmation
      logger.warn(`[ChaosExperiment] Production execution initiated: ${experiment.name}`);
    }

    const run = await this.repository.createRun(experimentId);

    return {
      run_id: run.id,
      status: run.status,
      started_at: run.started_at,
      dry_run: input.dry_run || false,
    };
  }

  /**
   * Get run status
   */
  async getRun(runId: string): Promise<ChaosRun> {
    const run = await this.repository.findRunById(runId);
    if (!run) {
      throw new ChaosExperimentServiceError(
        `Run not found: ${runId}`,
        'RUN_NOT_FOUND'
      );
    }
    return run;
  }

  /**
   * Add event to run timeline
   */
  async addRunEvent(runId: string, event: ChaosEvent): Promise<void> {
    const run = await this.getRun(runId);
    const timeline = [...run.timeline, event];
    await this.repository.updateRun(runId, { timeline });
  }

  /**
   * Complete run
   */
  async completeRun(runId: string, metrics: ChaosRunMetrics): Promise<ChaosRun> {
    const run = await this.repository.updateRun(runId, {
      status: 'completed',
      ended_at: new Date(),
      metrics,
    });
    return run!;
  }

  /**
   * Manual rollback
   */
  async rollbackRun(runId: string, reason?: string): Promise<{ success: boolean }> {
    const run = await this.getRun(runId);

    if (run.status !== 'running') {
      throw new ChaosExperimentServiceError(
        'Can only rollback running experiments',
        'INVALID_STATUS'
      );
    }

    // Add rollback event
    await this.addRunEvent(runId, {
      timestamp: new Date(),
      type: 'rollback',
      service: 'all',
      details: reason || 'Manual rollback requested',
    });

    await this.repository.updateRun(runId, {
      status: 'rolled_back',
      ended_at: new Date(),
    });

    return { success: true };
  }

  /**
   * Pre-release verification
   */
  async preReleaseVerify(input: PreReleaseVerifyInput): Promise<{
    verification_id: string;
    status: string;
    result?: Record<string, unknown>;
  }> {
    // Create a standard verification experiment
    const experiment = await this.repository.create({
      tenant_id: 'verification',
      name: `pre-release-${input.service_id}`,
      description: 'Automated pre-release chaos verification',
      scope: {
        tenant_id: 'verification',
        service_id: input.service_id,
        environment: input.environment,
      },
      faults: [
        {
          type: 'network_latency',
          target: input.service_id,
          config: { latency_ms: 100 },
          duration_ms: 60000,
          delay_ms: 0,
        },
        {
          type: 'cpu_stress',
          target: input.service_id,
          config: { stress_percent: 50 },
          duration_ms: 30000,
          delay_ms: 60000,
        },
      ],
      auto_rollback: true,
      created_by: 'system',
    });

    // Activate and run
    await this.repository.updateStatus(experiment.id, 'active');
    const run = await this.repository.createRun(experiment.id);

    return {
      verification_id: experiment.id,
      status: run.status,
      result: undefined, // Would be populated after execution
    };
  }

  /**
   * Archive experiment
   */
  async archiveExperiment(experimentId: string): Promise<{ success: boolean }> {
    const experiment = await this.getExperiment(experimentId);
    const archived = await this.repository.updateStatus(experimentId, 'archived');
    return { success: archived };
  }

  /**
   * Validate fault configuration
   */
  private validateFault(fault: ChaosFault): boolean {
    const validTypes = ['network_latency', 'service_down', 'cpu_stress', 'memory_stress', 'disk_full'];

    if (!validTypes.includes(fault.type)) {
      return false;
    }

    if (!fault.target || fault.duration_ms <= 0) {
      return false;
    }

    return true;
  }
}