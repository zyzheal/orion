/**
 * EnvProfileService - Environment-specific configuration profiles
 *
 * Provides named variable sets per deployment environment.
 * Mirrors NeatLogic's Profile management pattern.
 *
 * P2 feature from neatlogic-autoexec comparison analysis.
 */

import pino from 'pino';
import { EnvProfileRepository } from '../../repositories/EnvProfileRepository';
import { OrionError, ErrorCode } from '../../errors';
import type {
  EnvProfile, CreateEnvProfile, UpdateEnvProfile, EnvProfileEntity,
} from '../../models/EnvProfile';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class EnvProfileServiceError extends Error {
  constructor(message: string, public code: string) {
    super(`[${code}] ${message}`);
    this.name = 'EnvProfileServiceError';
  }
}

export interface EnvProfileServiceOptions {
  db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
}

export class EnvProfileService {
  private repository: EnvProfileRepository | null = null;

  constructor(options?: EnvProfileServiceOptions) {
    if (options?.db) {
      this.repository = new EnvProfileRepository(options.db);
    }
  }

  // ==================== CRUD ====================

  /**
   * Create an environment profile.
   */
  async createProfile(input: CreateEnvProfile): Promise<EnvProfile> {
    if (!this.repository) {
      throw new EnvProfileServiceError('No repository configured', 'NO_REPOSITORY');
    }

    if (!input.tenantId || !input.name || !input.environment) {
      throw new EnvProfileServiceError('Missing required fields: tenantId, name, environment', 'INVALID_INPUT');
    }

    // Check for duplicate (tenant + name + environment)
    const existing = await this.repository.findByTenantNameAndEnv(
      input.tenantId,
      input.name,
      input.environment,
    );
    if (existing) {
      throw new EnvProfileServiceError(
        `Profile already exists: ${input.name}/${input.environment}`,
        'DUPLICATE_PROFILE',
      );
    }

    const entity = await this.repository.create({
      id: this.generateId('env'),
      tenant_id: input.tenantId,
      name: input.name,
      environment: input.environment,
      variables: input.variables ?? {},
      description: input.description ?? undefined,
    });

    return this.mapEntityToProfile(entity);
  }

  /**
   * Get a profile by name and environment.
   */
  async getProfile(tenantId: string, name: string, environment: string): Promise<EnvProfile | null> {
    if (!this.repository) {
      throw new EnvProfileServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entity = await this.repository.findByTenantNameAndEnv(tenantId, name, environment);
    return entity ? this.mapEntityToProfile(entity) : null;
  }

  /**
   * Get a profile by ID with tenant ownership validation.
   */
  async getById(id: string, tenantId: string): Promise<EnvProfile | null> {
    if (!this.repository) {
      throw new EnvProfileServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entity = await this.repository.findById(id);
    if (!entity) return null;

    // Validate tenant ownership to prevent cross-tenant access
    if (entity.tenant_id !== tenantId) {
      return null;
    }

    return this.mapEntityToProfile(entity);
  }

  /**
   * Find profiles by filter criteria.
   */
  async findProfiles(filter: {
    tenantId: string;
    name?: string;
    environment?: string;
  }): Promise<EnvProfile[]> {
    if (!this.repository) {
      throw new EnvProfileServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entities = await this.repository.findByFilter({
      tenantId: filter.tenantId,
      name: filter.name,
      environment: filter.environment,
    });
    return entities.map(e => this.mapEntityToProfile(e));
  }

  /**
   * Find all environment names for a given profile name.
   */
  async findEnvironmentsForProfile(tenantId: string, name: string): Promise<string[]> {
    if (!this.repository) {
      throw new EnvProfileServiceError('No repository configured', 'NO_REPOSITORY');
    }

    return this.repository.findEnvironmentsForProfile(tenantId, name);
  }

  /**
   * Resolve variables for a profile.
   * Merges profile variables with optional overrides.
   */
  async resolveVariables(
    tenantId: string,
    name: string,
    environment: string,
    overrides?: Record<string, string>,
  ): Promise<Record<string, string>> {
    const profile = await this.getProfile(tenantId, name, environment);
    if (!profile) {
      throw new EnvProfileServiceError(
        `Profile not found: ${name}/${environment}`,
        'PROFILE_NOT_FOUND',
      );
    }

    const variables = { ...profile.variables };

    if (overrides) {
      Object.assign(variables, overrides);
    }

    return variables;
  }

  /**
   * Update a profile.
   */
  async updateProfile(id: string, input: UpdateEnvProfile): Promise<EnvProfile> {
    if (!this.repository) {
      throw new EnvProfileServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entity = await this.repository.update(id, {
      name: input.name,
      environment: input.environment,
      variables: input.variables,
      description: input.description,
    });

    return this.mapEntityToProfile(entity);
  }

  /**
   * Delete a profile.
   */
  async deleteProfile(id: string): Promise<void> {
    if (!this.repository) {
      throw new EnvProfileServiceError('No repository configured', 'NO_REPOSITORY');
    }

    await this.repository.delete(id);
  }

  // ==================== Private Helpers ====================

  private mapEntityToProfile(entity: EnvProfileEntity): EnvProfile {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      name: entity.name,
      environment: entity.environment,
      variables: entity.variables ?? {},
      description: entity.description ?? undefined,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
