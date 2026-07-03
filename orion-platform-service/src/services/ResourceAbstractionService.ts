/**
 * ResourceAbstractionService
 *
 * 统一资源抽象层服务
 * 提供跨云提供商的统一资源视图和多提供商部署能力
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import {
  UnifiedResourceRepository,
  UnifiedResourceEntity,
  DeploymentResultRepository,
  DeploymentResultEntity,
} from '../repositories/ResourceAbstractionRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface UnifiedResourceInput {
  tenantId: string;
  resourceType: string;
  name: string;
  provider: string;
  region?: string;
  spec?: Record<string, any>;
  tags?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DeploymentInput {
  tenantId: string;
  provider: string;
  serviceName: string;
  resources?: string[];
}

export class ResourceAbstractionService {
  private unifiedResourceRepo: UnifiedResourceRepository;
  private deploymentResultRepo: DeploymentResultRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.unifiedResourceRepo = new UnifiedResourceRepository(db);
    this.deploymentResultRepo = new DeploymentResultRepository(db);
  }

  // ==================== Unified Resources ====================

  /**
   * Create a unified resource
   */
  async createResource(input: UnifiedResourceInput): Promise<UnifiedResourceEntity> {
    logger.info(
      { tenantId: input.tenantId, name: input.name, provider: input.provider },
      'Creating unified resource'
    );

    const entity = await this.unifiedResourceRepo.createResource({
      id: uuidv4(),
      tenant_id: input.tenantId,
      resource_type: input.resourceType,
      name: input.name,
      provider: input.provider,
      region: input.region || 'unknown',
      status: 'running',
      spec: input.spec || {},
      tags: input.tags || {},
      metadata: input.metadata || {},
    });

    logger.info({ resourceId: entity.id }, 'Unified resource created');
    return entity;
  }

  /**
   * List resources by tenant
   */
  async listResources(tenantId: string): Promise<UnifiedResourceEntity[]> {
    return this.unifiedResourceRepo.findByTenant(tenantId);
  }

  /**
   * Delete a resource
   */
  async deleteResource(id: string, tenantId: string): Promise<boolean> {
    logger.info({ resourceId: id, tenantId }, 'Deleting unified resource');
    return this.unifiedResourceRepo.deleteResource(id, tenantId);
  }

  // ==================== Deployment Results ====================

  /**
   * Create a deployment record
   */
  async createDeployment(input: DeploymentInput): Promise<DeploymentResultEntity> {
    logger.info(
      { tenantId: input.tenantId, serviceName: input.serviceName, provider: input.provider },
      'Creating deployment record'
    );

    const entity = await this.deploymentResultRepo.createDeployment({
      id: uuidv4(),
      tenant_id: input.tenantId,
      provider: input.provider,
      service_name: input.serviceName,
      status: 'deploying',
      resources: input.resources || [],
      error_message: null,
    });

    logger.info({ deploymentId: entity.id }, 'Deployment record created');
    return entity;
  }

  /**
   * Get deployment by ID
   */
  async getDeployment(id: string): Promise<DeploymentResultEntity | undefined> {
    return this.deploymentResultRepo.findById(id);
  }

  /**
   * List deployments by tenant
   */
  async listDeployments(tenantId: string): Promise<DeploymentResultEntity[]> {
    return this.deploymentResultRepo.findByTenant(tenantId);
  }

  /**
   * Update deployment status
   */
  async updateDeploymentStatus(
    id: string,
    status: string,
    resources?: string[],
    errorMessage?: string
  ): Promise<DeploymentResultEntity | undefined> {
    logger.info({ deploymentId: id, status }, 'Updating deployment status');
    return this.deploymentResultRepo.updateStatus(id, status, resources, errorMessage);
  }
}

export default ResourceAbstractionService;