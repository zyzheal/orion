/**
 * BuildService - Business logic layer for Build operations
 * 
 * Handles build environment and build record management
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('LBuild-LService');
import {
  BuildRepository,
  Build,
  BuildEnvironment,
  CreateBuildInput,
  CreateBuildEnvironmentInput,
  UpdateBuildInput
} from './BuildRepository';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

export interface ListBuildsOptions {
  page?: number;
  limit?: number;
  tenantId?: string;
  projectId?: string;
  status?: string;
}

export interface ListEnvironmentsOptions {
  tenantId?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class BuildServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BuildServiceError';
  }
}

export class BuildService {
  private repository: BuildRepository;

  constructor(repository: BuildRepository) {
    this.repository = repository;
  }

  // ==================== Build Environments ====================

  /**
   * Get environment by ID
   */
  async getEnvironment(id: string): Promise<BuildEnvironment> {
    const env = await this.repository.findEnvironmentById(id);
    
    if (!env) {
      throw new BuildServiceError(`Build environment not found: ${id}`, 'ENV_NOT_FOUND');
    }
    
    return env;
  }

  /**
   * List all environments
   */
  async listEnvironments(options: ListEnvironmentsOptions = {}): Promise<BuildEnvironment[]> {
    return this.repository.findAllEnvironments(options.tenantId);
  }

  /**
   * Create build environment
   */
  async createEnvironment(input: CreateBuildEnvironmentInput): Promise<BuildEnvironment> {
    if (!input.tenant_id) {
      throw new BuildServiceError('Tenant ID is required', 'INVALID_INPUT');
    }

    if (!input.name || input.name.trim().length === 0) {
      throw new BuildServiceError('Environment name is required', 'INVALID_INPUT');
    }

    if (!input.image || input.image.trim().length === 0) {
      throw new BuildServiceError('Environment image is required', 'INVALID_INPUT');
    }

    return this.repository.createEnvironment({
      ...input,
      name: input.name.trim(),
      description: input.description?.trim(),
    });
  }

  /**
   * Update build environment
   */
  async updateEnvironment(id: string, input: Partial<CreateBuildEnvironmentInput>): Promise<BuildEnvironment> {
    const existing = await this.repository.findEnvironmentById(id);
    if (!existing) {
      throw new BuildServiceError(`Build environment not found: ${id}`, 'ENV_NOT_FOUND');
    }

    const updated = await this.repository.updateEnvironment(id, input);
    
    if (!updated) {
      throw new BuildServiceError(`Failed to update environment: ${id}`, 'UPDATE_FAILED');
    }
    
    return updated;
  }

  /**
   * Delete build environment
   */
  async deleteEnvironment(id: string): Promise<boolean> {
    const existing = await this.repository.findEnvironmentById(id);
    if (!existing) {
      throw new BuildServiceError(`Build environment not found: ${id}`, 'ENV_NOT_FOUND');
    }

    return this.repository.deleteEnvironment(id);
  }

  // ==================== Builds ====================

  /**
   * Get build by ID
   */
  async getBuild(id: string): Promise<Build> {
    const build = await this.repository.findById(id);
    
    if (!build) {
      throw new BuildServiceError(`Build not found: ${id}`, 'BUILD_NOT_FOUND');
    }
    
    return build;
  }

  /**
   * List builds with pagination
   */
  async listBuilds(options: ListBuildsOptions = {}): Promise<PaginatedResult<Build>> {
    const { page = 1, limit = 20, tenantId, projectId, status } = options;
    const offset = (page - 1) * limit;

    const [builds, total] = await Promise.all([
      this.repository.findAll({ tenantId, projectId, status, limit, offset }),
      this.repository.count({ tenantId, status }),
    ]);

    return {
      data: builds,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new build
   */
  async createBuild(input: CreateBuildInput): Promise<Build> {
    if (!input.tenant_id) {
      throw new BuildServiceError('Tenant ID is required', 'INVALID_INPUT');
    }

    return this.repository.create({
      ...input,
      build_args: input.build_args || {},
    });
  }

  /**
   * Start a build
   */
  async startBuild(id: string): Promise<Build> {
    const build = await this.repository.findById(id);
    
    if (!build) {
      throw new BuildServiceError(`Build not found: ${id}`, 'BUILD_NOT_FOUND');
    }

    if (build.status !== 'pending') {
      throw new BuildServiceError('Can only start pending builds', 'INVALID_STATE');
    }

    const updated = await this.repository.startBuild(id);
    
    if (!updated) {
      throw new BuildServiceError(`Failed to start build: ${id}`, 'START_FAILED');
    }

    // In real implementation, trigger actual build
    this.executeBuild(id).catch(err => {
      logger.error(`Build execution failed: ${err.message}`);
    });

    return updated;
  }

  /**
   * Execute build (internal method)
   */
  private async executeBuild(buildId: string): Promise<void> {
    // Get build
    const build = await this.repository.findById(buildId);
    if (!build) return;

    try {
      // In real implementation, this would:
      // 1. Clone source code from repository
      // 2. Build Docker image
      // 3. Push to registry
      // For now, just simulate
      
      // Simulate build time
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mark as success with generated image tag
      const imageTag = `${build.project_id || 'app'}:${build.id.substring(0, 8)}`;
      await this.repository.update(buildId, { 
        status: 'success',
        image: imageTag,
        tag: 'latest',
      } as UpdateBuildInput);
      
    } catch (error: any) {
      // Mark as failed
      await this.repository.completeBuild(buildId, 'failed', error.message);
    }
  }

  /**
   * Cancel a build
   */
  async cancelBuild(id: string): Promise<Build> {
    const build = await this.repository.findById(id);
    
    if (!build) {
      throw new BuildServiceError(`Build not found: ${id}`, 'BUILD_NOT_FOUND');
    }

    if (build.status !== 'pending' && build.status !== 'running') {
      throw new BuildServiceError('Can only cancel pending or running builds', 'INVALID_STATE');
    }

    const completed = await this.repository.completeBuild(id, 'cancelled', 'Cancelled by user');
    
    if (!completed) {
      throw new BuildServiceError(`Failed to cancel build: ${id}`, 'CANCEL_FAILED');
    }

    return completed;
  }

  /**
   * Get build by pipeline run
   */
  async getBuildByPipelineRun(pipelineRunId: string): Promise<Build | null> {
    return this.repository.findByPipelineRun(pipelineRunId);
  }

  /**
   * Get build statistics
   */
  async getBuildStats(tenantId?: string): Promise<{
    total: number;
    success: number;
    failed: number;
    running: number;
    pending: number;
    avgDuration: number;
  }> {
    return this.repository.getBuildStats(tenantId);
  }

  /**
   * Retry a failed build
   */
  async retryBuild(id: string): Promise<Build> {
    const build = await this.repository.findById(id);
    
    if (!build) {
      throw new BuildServiceError(`Build not found: ${id}`, 'BUILD_NOT_FOUND');
    }

    if (build.status !== 'failed' && build.status !== 'cancelled') {
      throw new BuildServiceError('Can only retry failed or cancelled builds', 'INVALID_STATE');
    }

    // Create a new build with same parameters
    const newBuild = await this.repository.create({
      tenant_id: build.tenant_id,
      project_id: build.project_id || undefined,
      pipeline_run_id: build.pipeline_run_id || undefined,
      source_ref: build.source_ref || undefined,
      build_args: build.build_args,
    });

    // Start the new build
    return this.startBuild(newBuild.id);
  }
}