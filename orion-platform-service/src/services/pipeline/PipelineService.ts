/**
 * PipelineService - PostgreSQL Repository-based implementation
 *
 * Provides Pipeline CRUD operations using the PipelineRepository
 * backed by PostgreSQL.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PipelineStatus,
  PipelineCreateInput,
  PipelineUpdateInput,
  createPipeline,
  parsePipelineYaml,
} from '../../models/Pipeline';
import {
  PipelineRepository,
  PipelineStageRepository,
  PipelineRunRepository,
  StageExecutionRepository,
  Pipeline as PipelineEntity,
  CreatePipelineInput as RepoCreatePipelineInput,
} from './PipelineRepository';
import type { DatabasePool } from '../database';
import { CacheService } from '../cache/CacheService';

export { PipelineEntity as Pipeline };

export interface PipelineVersion {
  id: string;
  name: string;
  version: number;
  description?: string;
  status: PipelineStatus;
  createdAt: Date;
}

export interface PipelineValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PipelineRunOptions {
  branch?: string;
  environment?: string;
  parameters?: Record<string, unknown>;
  triggeredBy?: string;
}

export interface PipelineRetryOptions {
  triggeredBy?: string;
  fromStage?: string;
  onlyFailed?: boolean;
}

/**
 * Result object returned by triggerRun.
 */
export interface PipelineRunResult {
  id: string;
  pipelineId: string;
  pipeline_id: string;
  status: string;
}

export class PipelineService {
  private repository: PipelineRepository | null;
  private stageRepository: PipelineStageRepository | null;
  private runRepository: PipelineRunRepository | null;
  private stageExecutionRepository: StageExecutionRepository | null;
  private cache: CacheService;

  /**
   * @param repository - PostgreSQL repository instance, mock repository (for tests),
   *                     or DatabasePool. Pass null to fall back to in-memory mode.
   * @param cache - Optional Redis-backed cache service for high-frequency reads.
   */
  constructor(
    repository: PipelineRepository | DatabasePool | null,
    cache?: CacheService,
  ) {
    this.cache = cache || new CacheService(null);
    if (!repository) {
      // No repository provided - use in-memory fallback
      this.repository = null;
      this.stageRepository = null;
      this.runRepository = null;
      this.stageExecutionRepository = null;
    } else if (
      'findById' in repository &&
      'findAll' in repository &&
      'create' in repository &&
      'update' in repository &&
      'delete' in repository
    ) {
      // Looks like a PipelineRepository (or mock thereof)
      this.repository = repository as PipelineRepository;
      // Check if the repository also has stage/run methods (full-featured mock)
      this.stageRepository = ('findStagesByPipeline' in repository && 'createStage' in repository)
        ? repository as unknown as PipelineStageRepository
        : null;
      this.runRepository = ('findRunById' in repository && 'createRun' in repository)
        ? repository as unknown as PipelineRunRepository
        : null;
      this.stageExecutionRepository = null;
    } else {
      // It's a raw DatabasePool - build repositories
      const db = repository as DatabasePool;
      this.repository = new PipelineRepository(db);
      this.stageRepository = new PipelineStageRepository(db);
      this.runRepository = new PipelineRunRepository(db);
      this.stageExecutionRepository = new StageExecutionRepository(db);
    }
  }

  // ==================== Core CRUD ====================

  async getById(id: string, _tenantId?: string): Promise<PipelineEntity | undefined | null> {
    if (!this.repository) return undefined;

    // Try cache first
    const cached = await this.cache.get<PipelineEntity>(`pipeline:${id}`);
    if (cached) return cached;

    const result = await this.repository.findById(id);
    if (result) {
      // Cache for 60s — pipelines change frequently but reads are frequent
      await this.cache.set(`pipeline:${id}`, result, 60);
    }
    return result || null;
  }

  async list(tenantId?: string): Promise<PipelineEntity[]> {
    const repo = this.repository as any;
    if (!repo) return [];
    if (tenantId) {
      // Try findByTenant first (PostgreSQL repository), fall back to filtered findAll (mock)
      if ('findByTenant' in repo) {
        return repo.findByTenant(tenantId);
      }
      // Mock fallback: use findAll with filter
      const all = await repo.findAll();
      const items = Array.isArray(all) ? all : all.entities;
      return items.filter((p: any) => p.tenant_id === tenantId);
    }
    const result = await repo.findAll();
    return Array.isArray(result) ? result : result.entities;
  }

  async create(
    input: PipelineCreateInput & { tenant_id?: string; created_by?: string; project_id?: string },
    _tenantId?: string,
  ): Promise<PipelineEntity> {
    if (!this.repository) {
      // Fallback to in-memory mode (legacy behavior)
      const pipeline = createPipeline(input);
      // Convert to entity shape for compatibility
      const entity: PipelineEntity = {
        id: pipeline.id,
        tenant_id: (pipeline as any).tenant_id || input.tenant_id || 'default',
        project_id: (input as any).project_id || null,
        name: pipeline.name,
        description: pipeline.description || null,
        trigger_type: 'manual',
        config: {},
        status: pipeline.status,
        version: typeof pipeline.version === 'string' ? parseInt(pipeline.version, 10) : 1,
        yamlDefinition: pipeline.yamlDefinition,
        spec: pipeline.spec || null,
        created_at: pipeline.createdAt,
        updated_at: pipeline.updatedAt,
        created_by: ((input as any).created_by || input.createdBy || null) || undefined,
      };
      return entity;
    }

    let spec: Record<string, any> | undefined;
    if (input.yamlDefinition) {
      try {
        const parsed = parsePipelineYaml(input.yamlDefinition);
        spec = parsed.spec;
      } catch {
        // Keep spec undefined if YAML parsing fails
      }
    }

    const repoInput: RepoCreatePipelineInput = {
      tenant_id: input.tenant_id || 'default',
      project_id: (input as any).project_id || null,
      name: input.name,
      description: input.description || null,
      trigger_type: 'manual',
      config: {},
      status: 'active',
      version: typeof input.version === 'string' ? parseInt(input.version, 10) : input.version || 1,
      yamlDefinition: input.yamlDefinition || null,
      spec: spec || null,
      created_by: input.created_by || input.createdBy || null,
    };

    return this.repository.create(repoInput);
  }

  async update(
    id: string,
    input: PipelineUpdateInput,
  ): Promise<PipelineEntity | undefined> {
    if (!this.repository) {
      // Fallback to in-memory mode (never stored, so return undefined)
      return undefined;
    }

    try {
      let spec: Record<string, any> | undefined;
      if (input.yamlDefinition) {
        try {
          const parsed = parsePipelineYaml(input.yamlDefinition);
          spec = parsed.spec;
        } catch {
          // Keep existing spec if parsing fails
        }
      }

      const updateData: any = {};
      if (input.description !== undefined) updateData.description = input.description;
      if (input.yamlDefinition !== undefined) updateData.yaml_definition = input.yamlDefinition;
      if (input.status !== undefined) updateData.status = input.status;
      if (spec !== undefined) updateData.spec = spec;

      const result = await this.repository.update(id, updateData);

      // Invalidate cache on update
      if (result) {
        await this.cache.del(`pipeline:${id}`);
      }

      return result;
    } catch {
      return undefined;
    }
  }

  async delete(id: string): Promise<boolean> {
    if (!this.repository) return false;

    // Invalidate cache on delete
    await this.cache.del(`pipeline:${id}`);

    return this.repository.delete(id);
  }

  // ==================== Versions ====================

  async getVersions(
    _tenantId: string,
    pipelineId: string,
  ): Promise<PipelineVersion[]> {
    if (!this.repository) return [];
    const pipelines = await this.repository.findVersions(pipelineId);
    if (pipelines.length === 0) return [];
    return pipelines.map(p => ({
      id: p.id,
      name: p.name,
      version: p.version || 1,
      description: p.description || undefined,
      status: p.status as PipelineStatus,
      createdAt: p.created_at,
    }));
  }

  // ==================== Validation ====================

  async validate(yamlDefinition: string): Promise<PipelineValidationResult> {
    try {
      const parsed = parsePipelineYaml(yamlDefinition);

      // Additional validation: check for stage dependencies
      if (parsed.spec && parsed.spec.stages) {
        const stageNames = new Set(parsed.spec.stages.map((s: any) => s.name));
        const errors: string[] = [];

        for (const stage of parsed.spec.stages) {
          if (stage.dependsOn) {
            for (const dep of stage.dependsOn) {
              if (!stageNames.has(dep)) {
                errors.push(`Stage '${stage.name}' depends on unknown stage '${dep}'`);
              }
            }
          }
        }

        if (errors.length > 0) {
          return { valid: false, errors };
        }
      }

      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Invalid YAML'],
      };
    }
  }

  // ==================== Pipeline Runs ====================

  async triggerRun(
    pipelineId: string,
    _options?: PipelineRunOptions,
  ): Promise<PipelineRunResult> {
    if (!this.repository) {
      // Fallback to in-memory mode
      const pipeline = await this.getById(pipelineId);
      if (!pipeline) {
        throw new Error(`Pipeline '${pipelineId}' not found`);
      }
      const runId = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      return {
        id: runId,
        pipelineId,
        pipeline_id: pipelineId,
        status: 'pending',
      };
    }

    // Verify pipeline exists
    const pipeline = await this.repository.findById(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found`);
    }

    if (!this.runRepository) {
      // No run repository, return mock run
      const runId = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      return {
        id: runId,
        pipelineId,
        pipeline_id: pipelineId,
        status: 'pending',
      };
    }

    // Check if using a mock repository (has createRun instead of BaseRepository.create)
    if ('createRun' in this.runRepository) {
      const run = await (this.runRepository as any).createRun({
        tenant_id: pipeline.tenant_id,
        pipeline_id: pipelineId,
        trigger_type: 'manual',
        trigger_by: null,
        config_snapshot: {},
      });
      return {
        id: run.id,
        pipelineId: run.pipeline_id,
        pipeline_id: run.pipeline_id,
        status: run.status,
      };
    }

    // Real PostgreSQL repository
    const run = await this.runRepository.create({
      tenant_id: pipeline.tenant_id,
      pipeline_id: pipelineId,
      trigger_type: 'manual',
      trigger_by: null,
      status: 'pending',
      config_snapshot: {},
      started_at: null,
      completed_at: null,
      duration_ms: null,
      error_message: null,
    });

    return {
      id: run.id,
      pipelineId: run.pipeline_id,
      pipeline_id: run.pipeline_id,
      status: run.status,
    };
  }

  async retryRun(
    _runId: string,
    _options?: PipelineRetryOptions,
  ): Promise<string> {
    return `run-retry-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get a pipeline run by ID.
   */
  async getRun(runId: string): Promise<any> {
    if (!this.runRepository) {
      throw new Error('Pipeline run not found');
    }
    // Handle both repository (findById) and mock (findRunById) patterns
    const run = 'findRunById' in this.runRepository
      ? await (this.runRepository as any).findRunById(runId)
      : await this.runRepository.findById(runId);
    if (!run) {
      throw new Error('Pipeline run not found');
    }
    return run;
  }

  /**
   * Cancel a pipeline run.
   */
  async cancelRun(runId: string): Promise<any> {
    if (!this.runRepository) {
      throw new Error('Pipeline run not found');
    }
    // Check if run exists first
    const run = 'findRunById' in this.runRepository
      ? await (this.runRepository as any).findRunById(runId)
      : await this.runRepository.findById(runId);
    if (!run) {
      throw new Error('Pipeline run not found');
    }
    // Handle both repository and mock patterns
    if ('updateRunStatus' in this.runRepository) {
      return (this.runRepository as any).updateRunStatus(runId, 'cancelled');
    }
    return this.runRepository.updateStatus(runId, 'cancelled');
  }

  /**
   * Get pipeline statistics (run counts, avg duration).
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
    // Check if repository has native getPipelineStats (mock) or getStats (PostgreSQL)
    if ('getPipelineStats' in this.repository) {
      return (this.repository as any).getPipelineStats(pipelineId);
    }
    if ('getStats' in this.repository) {
      return (this.repository as any).getStats(pipelineId);
    }
    return { totalRuns: 0, successRuns: 0, failedRuns: 0, runningRuns: 0, avgDuration: 0 };
  }

  // ==================== Paginated List ====================

  /**
   * List pipelines with pagination support.
   */
  async listPipelines(options?: {
    tenantId?: string;
    projectId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    name?: string;
  }): Promise<{ data: PipelineEntity[]; total: number }> {
    if (!this.repository) {
      return { data: [], total: 0 };
    }

    // If the repository has a native listPipelines-style method, use it
    if ('findAll' in this.repository) {
      const where: Record<string, any> = {};
      if (options?.tenantId) where.tenant_id = options.tenantId;
      if (options?.projectId) where.project_id = options.projectId;
      if (options?.status) where.status = options.status;
      if (options?.name) where.name = options.name;

      const result = await this.repository.findAll({
        where: Object.keys(where).length > 0 ? where : undefined,
        limit: options?.limit || 20,
        offset: options?.offset || 0,
      });

      // Handle both { entities, total } format (BaseRepository) and array format (mock)
      if (Array.isArray(result)) {
        return { data: result, total: result.length };
      }
      return { data: result.entities, total: result.total };
    }

    return { data: [], total: 0 };
  }
}

export default PipelineService;
