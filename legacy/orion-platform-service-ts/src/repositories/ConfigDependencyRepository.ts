/**
 * ConfigDependencyRepository - Database layer for Config Dependency operations
 *
 * Provides CRUD for configuration dependency graph.
 * Supports multi-tenant isolation via tenant_id.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';
import { ConfigDependency, CreateConfigDependencyInput, DependencyType, DependencyGraphNode } from '../services/config-mgmt/types';

export interface ConfigDependencyEntity {
  id: string;
  tenant_id: string;
  configId: string;
  dependsOnConfigId: string;
  dependencyType: string;
  description?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ConfigDependencyRepository extends BaseRepository<ConfigDependencyEntity> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'config_dependencies');
  }

  /**
   * Create a new dependency relationship.
   */
  async createDependency(tenantId: string, input: CreateConfigDependencyInput): Promise<ConfigDependencyEntity> {
    // Check for duplicate
    const existing = await this.findByConfigId(input.configId, tenantId);
    const duplicate = existing.find(d => d.dependsOnConfigId === input.dependsOnConfigId);
    if (duplicate) {
      throw new OrionError(
        `Dependency from config ${input.configId} to ${input.dependsOnConfigId} already exists`,
        ErrorCode.ALREADY_EXISTS
      );
    }

    const id = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO config_dependencies (id, tenant_id, config_id, depends_on_config_id, dependency_type, description, is_active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW())
       RETURNING *`,
      [
        id,
        tenantId,
        input.configId,
        input.dependsOnConfigId,
        input.dependencyType || 'hard',
        input.description ?? null,
        input.createdBy,
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all dependencies for a config (config depends on others).
   */
  async findByConfigId(configId: string, tenantId: string): Promise<ConfigDependencyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM config_dependencies WHERE config_id = $1 AND tenant_id = $2 AND is_active = true`,
      [configId, tenantId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all dependencies in a tenant.
   */
  async findByTenant(tenantId: string): Promise<ConfigDependencyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM config_dependencies WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Delete a dependency relationship (tenant-scoped).
   */
  async deleteDependency(configId: string, dependsOnConfigId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM config_dependencies WHERE config_id = $1 AND depends_on_config_id = $2 AND tenant_id = $3`,
      [configId, dependsOnConfigId, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Validate that all dependencies for a config are satisfied.
   * Returns list of unsatisfied dependency IDs.
   */
  async validate(tenantId: string, configId: string): Promise<{ valid: boolean; unsatisfied: string[] }> {
    const dependencies = await this.findByConfigId(configId, tenantId);
    const unsatisfied: string[] = [];

    for (const dep of dependencies) {
      // Check if the depended-on config exists and is active
      const dependedOnResult = await this.db.query(
        `SELECT id, status FROM configs WHERE id = $1 AND tenant_id = $2`,
        [dep.dependsOnConfigId, tenantId]
      );

      if (dependedOnResult.rows.length === 0) {
        unsatisfied.push(dep.dependsOnConfigId);
        continue;
      }

      const dependedOn = dependedOnResult.rows[0];
      // 'hard' dependencies require the target to be 'active'
      if (dep.dependencyType === 'hard' && dependedOn.status !== 'active') {
        unsatisfied.push(dep.dependsOnConfigId);
      }
    }

    return {
      valid: unsatisfied.length === 0,
      unsatisfied,
    };
  }

  // ---- Helpers ----

  protected mapRowToEntity(row: any): ConfigDependencyEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      configId: row.config_id,
      dependsOnConfigId: row.depends_on_config_id,
      dependencyType: row.dependency_type,
      description: row.description,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
