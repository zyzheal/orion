/**
 * DeployService - Business logic layer for Deploy operations
 * 
 * Handles deployment execution, rollback, and management
 */

import pino from 'pino';

const logger = pino({ name: 'LDeploy-LService' });
import {
  DeployRepository,
  Deployment,
  DeploymentEvent,
  CreateDeploymentInput,
  UpdateDeploymentInput,
  CreateDeploymentEventInput
} from './DeployRepository';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

export interface ListDeploymentsOptions {
  page?: number;
  limit?: number;
  tenantId?: string;
  projectId?: string;
  environment?: string;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class DeployServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DeployServiceError';
  }
}

export class DeployService {
  private repository: DeployRepository;

  constructor(repository: DeployRepository) {
    this.repository = repository;
  }

  // ==================== Deployment CRUD ====================

  /**
   * Get deployment by ID
   */
  async getDeployment(id: string): Promise<Deployment> {
    const deployment = await this.repository.findById(id);
    
    if (!deployment) {
      throw new DeployServiceError(`Deployment not found: ${id}`, 'DEPLOY_NOT_FOUND');
    }
    
    return deployment;
  }

  /**
   * List deployments with pagination
   */
  async listDeployments(options: ListDeploymentsOptions = {}): Promise<PaginatedResult<Deployment>> {
    const { page = 1, limit = 20, tenantId, projectId, environment, status } = options;
    const offset = (page - 1) * limit;

    const [deployments, total] = await Promise.all([
      this.repository.findAll({ tenantId, projectId, environment, status, limit, offset }),
      this.repository.count({ tenantId, environment, status }),
    ]);

    return {
      data: deployments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new deployment
   */
  async createDeployment(input: CreateDeploymentInput): Promise<Deployment> {
    if (!input.tenant_id) {
      throw new DeployServiceError('Tenant ID is required', 'INVALID_INPUT');
    }

    if (!input.environment || input.environment.trim().length === 0) {
      throw new DeployServiceError('Environment is required', 'INVALID_INPUT');
    }

    const deployment = await this.repository.create({
      ...input,
      environment: input.environment.trim(),
    });

    // Log creation event
    await this.logEvent(deployment.id, 'created', 'Deployment created', input.deployed_by);

    return deployment;
  }

  /**
   * Start deployment
   */
  async startDeployment(id: string, actorId?: string): Promise<Deployment> {
    const deployment = await this.repository.findById(id);
    
    if (!deployment) {
      throw new DeployServiceError(`Deployment not found: ${id}`, 'DEPLOY_NOT_FOUND');
    }

    if (deployment.status !== 'pending') {
      throw new DeployServiceError('Can only start pending deployments', 'INVALID_STATE');
    }

    const updated = await this.repository.startDeployment(id);
    
    if (!updated) {
      throw new DeployServiceError(`Failed to start deployment: ${id}`, 'START_FAILED');
    }

    // Log start event
    await this.logEvent(id, 'started', 'Deployment started', actorId);

    // Execute deployment asynchronously
    this.executeDeployment(id).catch(err => {
      logger.error(`Deployment execution failed: ${err.message}`);
    });

    return updated;
  }

  /**
   * Execute deployment (internal method)
   */
  private async executeDeployment(deploymentId: string): Promise<void> {
    const deployment = await this.repository.findById(deploymentId);
    if (!deployment) return;

    try {
      // Simulate deployment time based on strategy
      const delay = deployment.strategy === 'blue-green' ? 1000 : 500;
      await new Promise(resolve => setTimeout(resolve, delay));

      // In real implementation, this would:
      // 1. Pull the Docker image
      // 2. Update Kubernetes deployment
      // 3. Wait for rollout
      // 4. Run health checks

      const completed = await this.repository.completeDeployment(deploymentId, 'success');
      
      if (completed) {
        await this.logEvent(deploymentId, 'completed', 'Deployment completed successfully', deployment.deployed_by || undefined);
      }
      
    } catch (error: any) {
      await this.repository.completeDeployment(deploymentId, 'failed', error.message);
      await this.logEvent(deploymentId, 'failed', `Deployment failed: ${error.message}`, deployment.deployed_by || undefined);
    }
  }

  /**
   * Cancel a deployment
   */
  async cancelDeployment(id: string, actorId?: string): Promise<Deployment> {
    const deployment = await this.repository.findById(id);
    
    if (!deployment) {
      throw new DeployServiceError(`Deployment not found: ${id}`, 'DEPLOY_NOT_FOUND');
    }

    if (deployment.status !== 'pending' && deployment.status !== 'deploying') {
      throw new DeployServiceError('Can only cancel pending or deploying deployments', 'INVALID_STATE');
    }

    const completed = await this.repository.completeDeployment(id, 'cancelled', 'Cancelled by user');
    
    if (!completed) {
      throw new DeployServiceError(`Failed to cancel deployment: ${id}`, 'CANCEL_FAILED');
    }

    await this.logEvent(id, 'cancelled', 'Deployment cancelled', actorId);

    return completed;
  }

  /**
   * Rollback to previous deployment
   */
  async rollback(id: string, actorId?: string): Promise<Deployment> {
    const current = await this.repository.findById(id);
    
    if (!current) {
      throw new DeployServiceError(`Deployment not found: ${id}`, 'DEPLOY_NOT_FOUND');
    }

    if (current.status !== 'failed' && current.status !== 'success') {
      throw new DeployServiceError('Can only rollback completed deployments', 'INVALID_STATE');
    }

    // Find previous successful deployment
    const rollbackTarget = await this.repository.findRollbackTarget(
      current.tenant_id,
      current.environment,
      current.id
    );

    if (!rollbackTarget) {
      throw new DeployServiceError('No previous deployment to rollback to', 'NO_ROLLBACK_TARGET');
    }

    // Create new deployment as rollback
    const rollback = await this.repository.create({
      tenant_id: current.tenant_id,
      project_id: current.project_id || undefined,
      pipeline_run_id: current.pipeline_run_id || undefined,
      build_id: current.build_id || undefined,
      environment: current.environment,
      strategy: current.strategy,
      config: { ...current.config, isRollback: true, rollbackFrom: id },
      deployed_by: actorId,
    });

    // Log rollback event
    await this.logEvent(id, 'rollback_started', `Rolling back to deployment ${rollbackTarget.id}`, actorId);
    await this.logEvent(rollback.id, 'rollback_target', `Rollback target from deployment ${rollbackTarget.id}`, actorId);

    // Start the rollback deployment
    await this.startDeployment(rollback.id, actorId);

    // Update original deployment with rollback reference
    await this.repository.update(id, { rollback_to: rollback.id } as UpdateDeploymentInput);

    return rollback;
  }

  // ==================== Deployment Events ====================

  /**
   * Get deployment events
   */
  async getDeploymentEvents(deploymentId: string): Promise<DeploymentEvent[]> {
    return this.repository.findEvents(deploymentId);
  }

  /**
   * Log deployment event
   */
  private async logEvent(deploymentId: string, eventType: string, message: string, actorId?: string): Promise<void> {
    try {
      await this.repository.createEvent({
        deployment_id: deploymentId,
        event_type: eventType,
        message,
        actor_id: actorId,
      });
    } catch (err) {
      logger.error('Failed to log deployment event:', err);
    }
  }

  // ==================== Queries ====================

  /**
   * Get latest deployment by environment
   */
  async getLatestDeployment(tenantId: string, environment: string): Promise<Deployment | null> {
    return this.repository.findLatestByEnvironment(tenantId, environment);
  }

  /**
   * Get deployments by build
   */
  async getDeploymentsByBuild(buildId: string): Promise<Deployment[]> {
    return this.repository.findByBuild(buildId);
  }

  /**
   * Get environments
   */
  async getEnvironments(tenantId: string): Promise<string[]> {
    return this.repository.getEnvironments(tenantId);
  }

  /**
   * Get deployment statistics
   */
  async getDeployStats(tenantId?: string): Promise<{
    total: number;
    success: number;
    failed: number;
    deploying: number;
    avgDuration: number;
  }> {
    return this.repository.getDeployStats(tenantId);
  }
}