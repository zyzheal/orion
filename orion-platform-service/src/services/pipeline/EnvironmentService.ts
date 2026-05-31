/**
 * EnvironmentService
 * GAP-CN-02: Multi-environment management for pipeline deployments.
 *
 * Provides CRUD operations for environments, environment variable resolution,
 * and approval requirement checks.
 */

import pino from 'pino';
import { EnvironmentRepository, EnvironmentEntity } from '../../repositories/EnvironmentRepository';
import { createEnvironment, mergeVariables, type EnvironmentCreateInput, type EnvironmentUpdateInput } from '../../models/Environment';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface EnvironmentServiceOptions {
  repository: EnvironmentRepository;
}

export interface ResolvedVariables {
  /** Merged variables: pipeline-level overridden by environment-level */
  variables: Record<string, string>;
  /** Environment metadata used for resolution */
  environment: {
    name: string;
    approvalRequired: boolean;
    approvalCount: number;
  };
}

export class EnvironmentService {
  private repository: EnvironmentRepository;

  constructor(options: EnvironmentServiceOptions) {
    this.repository = options.repository;
  }

  // ==================== CRUD Operations ====================

  /**
   * Create a new environment for a tenant.
   */
  async createEnvironment(input: EnvironmentCreateInput, providedId?: string): Promise<EnvironmentEntity> {
    // Validate environment name format
    this.validateName(input.name);

    // Check for duplicate name within tenant
    const existing = await this.repository.findByTenantAndName(input.tenantId, input.name);
    if (existing) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Environment '${input.name}' already exists for tenant '${input.tenantId}'`);
    }

    // Validate approval count
    if ((input.approvalCount ?? 1) < 1) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'approvalCount must be at least 1');
    }

    const env = createEnvironment(input);
    const entity = {
      id: providedId || env.id,
      tenantId: env.tenantId,
      name: env.name,
      description: env.description ?? null,
      displayOrder: env.order,
      variables: env.variables,
      approvalRequired: env.approvalRequired,
      approvalCount: env.approvalCount,
    };

    const created = await this.repository.create(entity as Parameters<typeof this.repository.create>[0]);
    logger.info({ id: created.id, tenantId: created.tenantId, name: created.name }, 'Environment created');
    return created;
  }

  /**
   * Get an environment by ID.
   */
  async getEnvironment(id: string): Promise<EnvironmentEntity | undefined> {
    return this.repository.findById(id);
  }

  /**
   * Get an environment by tenant and name.
   */
  async getEnvironmentByName(tenantId: string, name: string): Promise<EnvironmentEntity | undefined> {
    return this.repository.findByTenantAndName(tenantId, name);
  }

  /**
   * List all environments for a tenant, ordered by display_order.
   */
  async listEnvironments(tenantId: string): Promise<EnvironmentEntity[]> {
    return this.repository.findByTenant(tenantId);
  }

  /**
   * Update an environment.
   */
  async updateEnvironment(id: string, input: EnvironmentUpdateInput): Promise<EnvironmentEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Environment '${id}' not found`);
    }

    // Validate name if being changed
    if (input.approvalCount !== undefined && input.approvalCount < 1) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'approvalCount must be at least 1');
    }

    const updates: Partial<EnvironmentEntity> = {};
    if (input.description !== undefined) updates.description = input.description;
    if (input.order !== undefined) updates.displayOrder = input.order;
    if (input.variables !== undefined) updates.variables = input.variables;
    if (input.approvalRequired !== undefined) updates.approvalRequired = input.approvalRequired;
    if (input.approvalCount !== undefined) updates.approvalCount = input.approvalCount;

    const updated = await this.repository.update(id, updates as any);
    logger.info({ id, ...input }, 'Environment updated');
    return updated;
  }

  /**
   * Delete an environment.
   */
  async deleteEnvironment(id: string): Promise<boolean> {
    const deleted = await this.repository.delete(id);
    if (deleted) {
      logger.info({ id }, 'Environment deleted');
    }
    return deleted;
  }

  // ==================== Variable Resolution ====================

  /**
   * Resolve environment variables for a pipeline run.
   * Environment variables override pipeline-level variables when both define the same key.
   *
   * @param tenantId - The tenant ID
   * @param environmentName - The environment name (e.g., 'development', 'staging', 'production')
   * @param pipelineVariables - Pipeline-level variables (lower priority)
   * @returns Resolved variables with environment metadata
   */
  async resolveVariables(
    tenantId: string,
    environmentName: string,
    pipelineVariables: Record<string, string> = {},
  ): Promise<ResolvedVariables> {
    const env = await this.repository.findByTenantAndName(tenantId, environmentName);
    if (!env) {
      // If environment not found, return pipeline variables as-is
      logger.warn({ tenantId, environmentName }, 'Environment not found, returning pipeline variables only');
      return {
        variables: pipelineVariables,
        environment: {
          name: environmentName,
          approvalRequired: false,
          approvalCount: 1,
        },
      };
    }

    const merged = mergeVariables(pipelineVariables, env.variables);
    return {
      variables: merged,
      environment: {
        name: env.name,
        approvalRequired: env.approvalRequired,
        approvalCount: env.approvalCount,
      },
    };
  }

  // ==================== Approval Checks ====================

  /**
   * Check if approval is required for deploying to an environment.
   *
   * @param tenantId - The tenant ID
   * @param environmentName - The environment name
   * @returns Whether approval is required and how many approvals needed
   */
  async checkApprovalRequired(
    tenantId: string,
    environmentName: string,
  ): Promise<{ required: boolean; approvalCount: number; environmentFound: boolean }> {
    const env = await this.repository.findByTenantAndName(tenantId, environmentName);
    if (!env) {
      return { required: false, approvalCount: 0, environmentFound: false };
    }
    return {
      required: env.approvalRequired,
      approvalCount: env.approvalCount,
      environmentFound: true,
    };
  }

  // ==================== Default Environments ====================

  /**
   * Create default environments for a new tenant.
   * Called during tenant onboarding to seed standard environments.
   */
  async createDefaultEnvironments(tenantId: string): Promise<EnvironmentEntity[]> {
    const defaults: EnvironmentCreateInput[] = [
      {
        tenantId,
        name: 'development',
        description: 'Development environment for active development and testing',
        order: 0,
        variables: { NODE_ENV: 'development', LOG_LEVEL: 'debug' },
        approvalRequired: false,
        approvalCount: 1,
      },
      {
        tenantId,
        name: 'staging',
        description: 'Staging environment for pre-production validation',
        order: 1,
        variables: { NODE_ENV: 'staging', LOG_LEVEL: 'info' },
        approvalRequired: true,
        approvalCount: 1,
      },
      {
        tenantId,
        name: 'production',
        description: 'Production environment for live traffic',
        order: 2,
        variables: { NODE_ENV: 'production', LOG_LEVEL: 'warn' },
        approvalRequired: true,
        approvalCount: 2,
      },
    ];

    const created: EnvironmentEntity[] = [];
    for (const def of defaults) {
      try {
        const env = await this.createEnvironment(def);
        created.push(env);
      } catch (err: any) {
        // Skip if already exists (idempotent)
        if (err.message?.includes('already exists')) {
          logger.debug({ tenantId, name: def.name }, 'Default environment already exists, skipping');
        } else {
          throw err;
        }
      }
    }
    return created;
  }

  // ==================== Validation ====================

  /**
   * Validate environment name format.
   * Must be lowercase alphanumeric with underscores, starting with a letter.
   */
  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Environment name cannot be empty');
    }
    const namePattern = /^[a-z][a-z0-9_]*$/;
    if (!namePattern.test(name)) {
      throw new OrionError('VALIDATION_ERROR', `Environment name '${name}' is invalid. Must be lowercase alphanumeric with underscores, starting with a letter.`)
    }
    if (name.length > 64) {
      throw new OrionError('OPERATION_FAILED', `Environment name '${name}' is too long (max 64 characters)`)
    }
  }
}
