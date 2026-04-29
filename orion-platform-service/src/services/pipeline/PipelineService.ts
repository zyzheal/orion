/**
 * PipelineService - Business logic layer for Pipeline operations
 *
 * Handles pipeline CRUD, execution, and management.
 * Uses PostgreSQL PipelineRepository for persistence.
 */

import {
  PipelineRepository,
  Pipeline,
  PipelineRun,
  PipelineStage,
  StageExecution,
  CreatePipelineInput,
  UpdatePipelineInput,
  CreatePipelineRunInput,
} from './PipelineRepository';

export interface ListPipelinesOptions {
  page?: number;
  limit?: number;
  tenantId?: string;
  projectId?: string;
  status?: string;
}

export interface ListRunsOptions {
  page?: number;
  limit?: number;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PipelineServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PipelineServiceError';
  }
}

export class PipelineService {
  private repository: PipelineRepository | null;

  constructor(repository: PipelineRepository | null) {
    this.repository = repository;
  }

  // ==================== Pipeline CRUD ====================

  /**
   * Create a new pipeline
   */
  async create(input: CreatePipelineInput): Promise<Pipeline> {
    if (!this.repository) {
      throw new PipelineServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }
    return this.repository.create(input);
  }

  /**
   * List pipelines by tenant (simple list)
   */
  async list(tenantId: string, projectId?: string): Promise<Pipeline[]> {
    if (!this.repository) {
      return [];
    }
    return this.repository.findAll({ tenantId, projectId });
  }

  /**
   * Get pipeline by ID
   */
  async getById(id: string): Promise<Pipeline | null> {
    if (!this.repository) {
      return null;
    }
    return this.repository.findById(id);
  }

  /**
   * Get pipeline by ID (throws if not found)
   */
  async getPipeline(id: string): Promise<Pipeline> {
    if (!this.repository) {
      throw new PipelineServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }
    const pipeline = await this.repository.findById(id);

    if (!pipeline) {
      throw new PipelineServiceError(`Pipeline not found: ${id}`, 'PIPELINE_NOT_FOUND');
    }

    return pipeline;
  }

  async getVersions(tenantId: string, pipelineId: string): Promise<Pipeline[]> {
    if (!this.repository) {
      return [];
    }
    return this.repository.findVersions(pipelineId);
  }

  /**
   * List pipelines with pagination
   */
  async listPipelines(options: ListPipelinesOptions = {}): Promise<PaginatedResult<Pipeline>> {
    if (!this.repository) {
      return { data: [], total: 0, page: options.page || 1, limit: options.limit || 20, totalPages: 0 };
    }
    const { page = 1, limit = 20, tenantId, projectId, status } = options;
    const offset = (page - 1) * limit;

    const [pipelines, total] = await Promise.all([
      this.repository.findAll({ tenantId, projectId, status, limit, offset }),
      this.repository.count({ tenantId, status }),
    ]);

    return {
      data: pipelines,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, input: UpdatePipelineInput): Promise<Pipeline | null> {
    if (!this.repository) {
      return null;
    }
    return this.repository.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    if (!this.repository) {
      return false;
    }
    return this.repository.delete(id);
  }

  /**
   * Create a new pipeline (legacy API - creates from CreatePipelineInput)
   */
  async createPipeline(input: CreatePipelineInput): Promise<Pipeline> {
    if (!this.repository) {
      throw new PipelineServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }

    // Validate required fields
    if (!input.tenant_id) {
      throw new PipelineServiceError('Tenant ID is required', 'INVALID_INPUT');
    }

    if (!input.name || input.name.trim().length === 0) {
      throw new PipelineServiceError('Pipeline name is required', 'INVALID_INPUT');
    }

    return this.repository.create({
      ...input,
      name: input.name.trim(),
      description: input.description?.trim(),
    });
  }

  /**
   * Update a pipeline
   */
  async updatePipeline(id: string, input: UpdatePipelineInput): Promise<Pipeline> {
    if (!this.repository) {
      throw new PipelineServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PipelineServiceError(`Pipeline not found: ${id}`, 'PIPELINE_NOT_FOUND');
    }

    const updated = await this.repository.update(id, input);

    if (!updated) {
      throw new PipelineServiceError(`Failed to update pipeline: ${id}`, 'UPDATE_FAILED');
    }

    return updated;
  }

  /**
   * Delete a pipeline (soft delete)
   */
  async deletePipeline(id: string): Promise<boolean> {
    if (!this.repository) {
      throw new PipelineServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PipelineServiceError(`Pipeline not found: ${id}`, 'PIPELINE_NOT_FOUND');
    }

    return this.repository.delete(id);
  }

  // ==================== Pipeline Stages ====================

  /**
   * Get pipeline stages
   */
  async getPipelineStages(pipelineId: string): Promise<PipelineStage[]> {
    if (!this.repository) {
      return [];
    }
    const pipeline = await this.repository.findById(pipelineId);
    if (!pipeline) {
      throw new PipelineServiceError(`Pipeline not found: ${pipelineId}`, 'PIPELINE_NOT_FOUND');
    }

    return this.repository.findStagesByPipeline(pipelineId);
  }

  /**
   * Add stage to pipeline
   */
  async addStage(pipelineId: string, stage: {
    name: string;
    type: string;
    config?: Record<string, any>;
    order_index: number;
    timeout?: number;
    retry_count?: number;
    parallel?: boolean;
    conditions?: Record<string, any>;
  }): Promise<PipelineStage> {
    if (!this.repository) {
      throw new PipelineServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }
    const pipeline = await this.repository.findById(pipelineId);
    if (!pipeline) {
      throw new PipelineServiceError(`Pipeline not found: ${pipelineId}`, 'PIPELINE_NOT_FOUND');
    }

    return this.repository.createStage(pipelineId, {
      name: stage.name,
      type: stage.type,
      config: stage.config || {},
      order_index: stage.order_index,
      timeout: stage.timeout || null,
      retry_count: stage.retry_count || 0,
      parallel: stage.parallel || false,
      conditions: stage.conditions || {},
    });
  }

  // ==================== Pipeline Runs ====================

  /**
   * Get pipeline run by ID
   */
  async getRun(id: string): Promise<PipelineRun> {
    if (!this.repository) {
      throw new PipelineServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }
    const run = await this.repository.findRunById(id);

    if (!run) {
      throw new PipelineServiceError(`Pipeline run not found: ${id}`, 'RUN_NOT_FOUND');
    }

    return run;
  }

  /**
   * List pipeline runs
   */
  async listRuns(pipelineId: string, options: ListRunsOptions = {}): Promise<PaginatedResult<PipelineRun>> {
    if (!this.repository) {
      return { data: [], total: 0, page: options.page || 1, limit: options.limit || 20, totalPages: 0 };
    }
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      this.repository.findRunsByPipeline(pipelineId, { limit, offset }),
      this.repository.countRuns(pipelineId, status),
    ]);

    return {
      data: runs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Trigger a new pipeline run
   */
  async triggerRun(pipelineId: string, input?: {
    trigger_type?: string;
    trigger_by?: string;
  }): Promise<PipelineRun> {
    if (!this.repository) {
      throw new PipelineServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }
    const pipeline = await this.repository.findById(pipelineId);

    if (!pipeline) {
      throw new PipelineServiceError(`Pipeline not found: ${pipelineId}`, 'PIPELINE_NOT_FOUND');
    }

    if (pipeline.status !== 'active') {
      throw new PipelineServiceError('Pipeline is not active', 'PIPELINE_INACTIVE');
    }

    // Get pipeline config as snapshot
    const configSnapshot = pipeline.config;

    const runInput: CreatePipelineRunInput = {
      tenant_id: pipeline.tenant_id,
      pipeline_id: pipelineId,
      trigger_type: input?.trigger_type || 'manual',
      trigger_by: input?.trigger_by,
      config_snapshot: configSnapshot,
    };

    const run = await this.repository.createRun(runInput);

    // Start async execution (in real implementation, this would be handled by a worker)
    this.executePipeline(run.id, pipelineId).catch(err => {
      console.error(`Pipeline execution failed: ${err.message}`);
    });

    return run;
  }

  /**
   * Execute pipeline (internal method)
   */
  private async executePipeline(runId: string, pipelineId: string): Promise<void> {
    if (!this.repository) return;

    // Update run status to running
    const startedAt = new Date();
    await this.repository.updateRunStatus(runId, 'running', startedAt);

    try {
      // Get stages
      const stages = await this.repository.findStagesByPipeline(pipelineId);

      // Execute each stage sequentially
      for (const stage of stages) {
        await this.executeStage(runId, stage);
      }

      // All stages completed successfully
      const completedAt = new Date();
      await this.repository.updateRunStatus(runId, 'success', startedAt, completedAt);

    } catch (error: any) {
      // Pipeline failed
      const completedAt = new Date();
      await this.repository.updateRunStatus(runId, 'failed', startedAt, completedAt, error.message);
    }
  }

  /**
   * Execute a single stage
   */
  private async executeStage(runId: string, stage: PipelineStage): Promise<void> {
    if (!this.repository) return;

    const startedAt = new Date();

    // Create stage execution record
    const execution = await this.repository.createStageExecution(runId, stage.id, stage.name);

    // Update status to running
    await this.repository.updateStageExecutionStatus(execution.id, 'running', startedAt);

    try {
      // Simulate stage execution (in real implementation, this would run the actual stage)
      // For now, we'll just mark it as success after a short delay
      await new Promise(resolve => setTimeout(resolve, 100));

      const completedAt = new Date();
      await this.repository.updateStageExecutionStatus(
        execution.id,
        'success',
        startedAt,
        completedAt
      );

    } catch (error: any) {
      const completedAt = new Date();
      await this.repository.updateStageExecutionStatus(
        execution.id,
        'failed',
        startedAt,
        completedAt,
        error.message
      );

      // If stage failed and not configured for retry, propagate error
      if (stage.retry_count <= 0) {
        throw error;
      }
    }
  }

  /**
   * Cancel a running pipeline
   */
  async cancelRun(runId: string): Promise<PipelineRun> {
    if (!this.repository) {
      throw new PipelineServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }
    const run = await this.repository.findRunById(runId);

    if (!run) {
      throw new PipelineServiceError(`Pipeline run not found: ${runId}`, 'RUN_NOT_FOUND');
    }

    if (run.status !== 'running' && run.status !== 'pending') {
      throw new PipelineServiceError('Cannot cancel a pipeline that is not running', 'INVALID_STATE');
    }

    const completedAt = new Date();
    const updated = await this.repository.updateRunStatus(
      runId,
      'cancelled',
      run.started_at || undefined,
      completedAt,
      'Cancelled by user'
    );

    if (!updated) {
      throw new PipelineServiceError(`Failed to cancel run: ${runId}`, 'CANCEL_FAILED');
    }

    return updated;
  }

  /**
   * Get stage executions for a run
   */
  async getStageExecutions(runId: string): Promise<StageExecution[]> {
    if (!this.repository) {
      return [];
    }
    const run = await this.repository.findRunById(runId);
    if (!run) {
      throw new PipelineServiceError(`Pipeline run not found: ${runId}`, 'RUN_NOT_FOUND');
    }

    return this.repository.findStageExecutions(runId);
  }

  /**
   * Get pipeline statistics
   */
  async getPipelineStats(pipelineId: string): Promise<{
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    runningRuns: number;
    avgDuration: number;
  }> {
    if (!this.repository) {
      return { totalRuns: 0, successRuns: 0, failedRuns: 0, runningRuns: 0, avgDuration: 0 };
    }
    return this.repository.getPipelineStats(pipelineId);
  }

  /**
   * Retry a failed pipeline run
   */
  async retryRun(originalRunId: string): Promise<PipelineRun> {
    if (!this.repository) {
      throw new PipelineServiceError('Database not available', 'SERVICE_UNAVAILABLE');
    }
    const originalRun = await this.repository.findRunById(originalRunId);

    if (!originalRun) {
      throw new PipelineServiceError(`Pipeline run not found: ${originalRunId}`, 'RUN_NOT_FOUND');
    }

    if (originalRun.status !== 'failed' && originalRun.status !== 'cancelled') {
      throw new PipelineServiceError('Can only retry failed or cancelled runs', 'INVALID_STATE');
    }

    // Trigger a new run with same config
    return this.triggerRun(originalRun.pipeline_id, {
      trigger_type: 'retry',
      trigger_by: originalRun.trigger_by || undefined,
    });
  }

  // ==================== YAML Validation ====================

  /**
   * Validate pipeline YAML definition
   */
  async validate(yamlDefinition: string): Promise<{ valid: boolean; errors: string[] }> {
    try {
      // Basic validation - check required fields
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const yamlModule = require('js-yaml');
      const parsed = yamlModule.load(yamlDefinition) as any;

      const errors: string[] = [];

      if (!parsed.apiVersion) {
        errors.push('Missing apiVersion');
      }
      if (!parsed.kind || parsed.kind !== 'Pipeline') {
        errors.push(`Expected kind 'Pipeline', got '${parsed.kind}'`);
      }
      if (!parsed.metadata || !parsed.metadata.name) {
        errors.push('Missing metadata.name');
      }
      if (!parsed.spec || !parsed.spec.stages || !Array.isArray(parsed.spec.stages)) {
        errors.push('Missing or invalid spec.stages');
      }

      // Validate stage dependencies
      if (parsed.spec?.stages && Array.isArray(parsed.spec.stages)) {
        const stageNames = parsed.spec.stages.map((s: any) => s.name);
        for (const stage of parsed.spec.stages) {
          if (stage.dependsOn && Array.isArray(stage.dependsOn)) {
            for (const dep of stage.dependsOn) {
              if (!stageNames.includes(dep)) {
                errors.push(`Stage "${stage.name}" depends on unknown stage "${dep}"`);
              }
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message || 'Invalid YAML format'],
      };
    }
  }
}
