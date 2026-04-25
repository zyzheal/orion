/**
 * EnvironmentService - Business logic layer for Environment management
 *
 * Manages deployment environments (dev, staging, prod, etc.) for projects.
 * Environments are scoped to a project and define cluster/namespace targets
 * for deployments and configurations.
 */
import { EnvironmentRepository, Environment } from './EnvironmentRepository';

export class EnvironmentServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'EnvironmentServiceError';
  }
}

/** Input for creating a new environment */
export interface CreateEnvironmentInput {
  projectId: string;
  name: string;
  type: string;
  cluster?: string;
  namespace?: string;
  config?: Record<string, any>;
}

/** Input for updating an environment */
export interface UpdateEnvironmentInput {
  name?: string;
  type?: string;
  config?: Record<string, any>;
  cluster?: string;
  namespace?: string;
  status?: string;
}

/** Valid environment types */
const VALID_ENV_TYPES = ['dev', 'staging', 'prod', 'testing', 'pre-prod', 'production', 'development'];

export class EnvironmentService {
  private repository: EnvironmentRepository;

  constructor(repository: EnvironmentRepository) {
    this.repository = repository;
  }

  /**
   * Create a new environment for a project
   */
  async createEnvironment(input: CreateEnvironmentInput): Promise<Environment> {
    const { projectId, name, type, cluster, namespace, config } = input;

    if (!projectId || !name || !type) {
      throw new EnvironmentServiceError('Project ID, name, and type are required', 'INVALID_INPUT');
    }

    if (!VALID_ENV_TYPES.includes(type)) {
      throw new EnvironmentServiceError(
        `Invalid environment type: ${type}. Must be one of: ${VALID_ENV_TYPES.join(', ')}`,
        'INVALID_INPUT'
      );
    }

    return this.repository.create(projectId, name, type, config || {}, cluster, namespace);
  }

  /**
   * List environments for a specific project
   */
  async listByProject(projectId: string): Promise<Environment[]> {
    if (!projectId) {
      throw new EnvironmentServiceError('Project ID is required', 'INVALID_INPUT');
    }
    return this.repository.findByProject(projectId);
  }

  /**
   * List all environments
   */
  async listAll(): Promise<Environment[]> {
    return this.repository.findAll();
  }

  /**
   * Get a single environment by ID
   */
  async getEnvironment(id: string): Promise<Environment> {
    const env = await this.repository.findById(id);
    if (!env) {
      throw new EnvironmentServiceError(`Environment not found: ${id}`, 'NOT_FOUND');
    }
    return env;
  }

  /**
   * Update an environment
   */
  async updateEnvironment(id: string, updates: UpdateEnvironmentInput): Promise<Environment> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new EnvironmentServiceError(`Environment not found: ${id}`, 'NOT_FOUND');
    }

    if (updates.type && !VALID_ENV_TYPES.includes(updates.type)) {
      throw new EnvironmentServiceError(
        `Invalid environment type: ${updates.type}. Must be one of: ${VALID_ENV_TYPES.join(', ')}`,
        'INVALID_INPUT'
      );
    }

    const result = await this.repository.update(id, updates);
    if (!result) {
      throw new EnvironmentServiceError(`Environment not found: ${id}`, 'NOT_FOUND');
    }
    return result;
  }

  /**
   * Delete an environment
   */
  async deleteEnvironment(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new EnvironmentServiceError(`Environment not found: ${id}`, 'NOT_FOUND');
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new EnvironmentServiceError(`Failed to delete environment: ${id}`, 'DELETE_FAILED');
    }
  }

  /**
   * Update environment status (e.g., active, inactive, maintenance)
   */
  async updateStatus(id: string, status: string): Promise<Environment> {
    const validStatuses = ['active', 'inactive', 'maintenance', 'deprecated'];
    if (!validStatuses.includes(status)) {
      throw new EnvironmentServiceError(
        `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`,
        'INVALID_INPUT'
      );
    }

    return this.updateEnvironment(id, { status });
  }
}
