/**
 * GlobalParamService - Cross-pipeline shared parameters
 *
 * Provides tenant-scoped, pipeline-scoped, or globally-scoped parameters
 * accessible across pipelines within a tenant. Mirrors NeatLogic's global
 * parameter pattern.
 *
 * P2 feature from neatlogic-autoexec comparison analysis.
 */

import { createLogger } from '../utils/logger';
import { GlobalParamRepository } from '../../repositories/GlobalParamRepository';
import { OrionError, ErrorCode } from '../../errors';
import type {
  GlobalParam, CreateGlobalParam, UpdateGlobalParam, GlobalParamScope, GlobalParamEntity,
} from '../../models/GlobalParam';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class GlobalParamServiceError extends Error {
  constructor(message: string, public code: string) {
    super(`[${code}] ${message}`);
    this.name = 'GlobalParamServiceError';
  }
}

export interface GlobalParamServiceOptions {
  db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
}

export class GlobalParamService {
  private repository: GlobalParamRepository | null = null;

  constructor(options?: GlobalParamServiceOptions) {
    if (options?.db) {
      this.repository = new GlobalParamRepository(options.db);
    }
  }

  // ==================== CRUD ====================

  /**
   * Create a global parameter.
   */
  async create(input: CreateGlobalParam): Promise<GlobalParam> {
    if (!this.repository) {
      throw new GlobalParamServiceError('No repository configured', 'NO_REPOSITORY');
    }

    if (!input.tenantId || !input.key || input.value === undefined) {
      throw new GlobalParamServiceError('Missing required fields: tenantId, key, value', 'INVALID_INPUT');
    }

    // Check for duplicate key within tenant
    const existing = await this.repository.findByTenantAndKey(input.tenantId, input.key);
    if (existing) {
      throw new GlobalParamServiceError(
        `Global param key already exists: ${input.key}`,
        'DUPLICATE_KEY'
      );
    }

    const entity = await this.repository.create({
      id: this.generateId('gp'),
      tenant_id: input.tenantId,
      key: input.key,
      value: input.value,
      description: input.description ?? undefined,
      is_secret: input.isSecret ?? false,
      scope: input.scope ?? 'tenant',
      expires_at: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });

    return this.mapEntityToParam(entity);
  }

  /**
   * Get a global parameter by key.
   */
  async get(tenantId: string, key: string): Promise<GlobalParam | null> {
    if (!this.repository) {
      throw new GlobalParamServiceError('No repository configured', 'NO_REPOSITORY');
    }

    // Check tenant-scoped first
    const tenantParam = await this.repository.findByTenantAndKey(tenantId, key);
    if (tenantParam) return this.mapEntityToParam(tenantParam);

    // Fall back to global-scoped
    const globalParams = await this.repository.findGlobalParams();
    const globalParam = globalParams.find(p => p.key === key);
    if (globalParam) return this.mapEntityToParam(globalParam);

    return null;
  }

  /**
   * Get a global parameter by ID with tenant ownership validation.
   */
  async getById(id: string, tenantId: string): Promise<GlobalParam | null> {
    if (!this.repository) {
      throw new GlobalParamServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entity = await this.repository.findById(id);
    if (!entity) return null;

    // Validate tenant ownership to prevent cross-tenant access
    if (entity.tenant_id !== tenantId) {
      return null;
    }

    return this.mapEntityToParam(entity);
  }

  /**
   * Get multiple parameters by keys. Returns map of key -> value.
   */
  async getBatch(tenantId: string, keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    for (const key of keys) {
      const param = await this.get(tenantId, key);
      if (param) {
        result[key] = param.value;
      }
    }

    return result;
  }

  /**
   * Resolve parameter values from a set of keys, with optional defaults.
   */
  async resolve(tenantId: string, keys: Record<string, string>): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    for (const [key, defaultValue] of Object.entries(keys)) {
      const param = await this.get(tenantId, key);
      result[key] = param ? param.value : defaultValue;
    }

    return result;
  }

  /**
   * List all parameters for a tenant.
   */
  async list(tenantId: string, scope?: GlobalParamScope): Promise<GlobalParam[]> {
    if (!this.repository) {
      throw new GlobalParamServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entities = await this.repository.findByTenant(tenantId, scope);
    return entities.map(e => this.mapEntityToParam(e));
  }

  /**
   * Update a global parameter.
   */
  async update(id: string, input: UpdateGlobalParam): Promise<GlobalParam> {
    if (!this.repository) {
      throw new GlobalParamServiceError('No repository configured', 'NO_REPOSITORY');
    }

    const entity = await this.repository.update(id, {
      value: input.value,
      description: input.description,
      is_secret: input.isSecret,
      scope: input.scope,
      expires_at: input.expiresAt,
    });

    return this.mapEntityToParam(entity);
  }

  /**
   * Delete a global parameter.
   */
  async delete(id: string): Promise<void> {
    if (!this.repository) {
      throw new GlobalParamServiceError('No repository configured', 'NO_REPOSITORY');
    }

    await this.repository.delete(id);
  }

  // ==================== Maintenance ====================

  /**
   * Delete expired parameters.
   */
  async cleanupExpired(): Promise<number> {
    if (!this.repository) {
      throw new GlobalParamServiceError('No repository configured', 'NO_REPOSITORY');
    }

    return this.repository.deleteExpired();
  }

  // ==================== Private Helpers ====================

  private mapEntityToParam(entity: GlobalParamEntity): GlobalParam {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      key: entity.key,
      value: entity.is_secret ? this.maskSecret(entity.value) : entity.value,
      description: entity.description ?? undefined,
      isSecret: entity.is_secret,
      scope: entity.scope as GlobalParamScope,
      expiresAt: entity.expires_at ?? undefined,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  private maskSecret(value: string): string {
    if (value.length <= 4) return '****';
    return value.slice(0, 4) + '****';
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
