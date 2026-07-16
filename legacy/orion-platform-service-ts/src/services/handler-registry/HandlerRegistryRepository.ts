/**
 * HandlerRegistryRepository - PostgreSQL persistence for handler registration metadata
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../../db/base-repository';
import { HandlerRegistryEntity, HandlerStatus, HealthStatus } from './types';

export class HandlerRegistryRepository extends BaseRepository<HandlerRegistryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'handler_registry');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<HandlerRegistryEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findByDomainAndName(tenantId: string, domain: string, name: string): Promise<HandlerRegistryEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM handler_registry WHERE tenant_id = $1 AND domain = $2 AND name = $3`,
      [tenantId, domain, name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByDomain(tenantId: string, domain: string): Promise<HandlerRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM handler_registry WHERE tenant_id = $1 AND domain = $2 ORDER BY name`,
      [tenantId, domain],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findActive(tenantId: string, domain: string): Promise<HandlerRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM handler_registry WHERE tenant_id = $1 AND domain = $2 AND status = 'active' ORDER BY name`,
      [tenantId, domain],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: HandlerStatus): Promise<HandlerRegistryEntity | undefined> {
    const result = await this.db.query(
      `UPDATE handler_registry SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateHealth(
    id: string,
    healthStatus: HealthStatus,
    lastError?: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE handler_registry SET last_health_status = $2, last_health_check = NOW(), last_error = $3, updated_at = NOW() WHERE id = $1`,
      [id, healthStatus, lastError || null],
    );
  }

  async incrementInvokeCount(id: string): Promise<void> {
    await this.db.query(
      `UPDATE handler_registry SET updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async incrementErrorCount(id: string, lastError: string): Promise<void> {
    await this.db.query(
      `UPDATE handler_registry SET error_count = error_count + 1, last_error = $2, updated_at = NOW() WHERE id = $1`,
      [id, lastError],
    );
  }

  protected mapRowToEntity(row: any): HandlerRegistryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      domain: row.domain,
      name: row.name,
      displayName: row.display_name ?? null,
      description: row.description ?? null,
      version: row.version,
      status: row.status,
      config: row.config || {},
      metadata: row.metadata || {},
      healthCheck: row.health_check || {},
      lastHealthStatus: row.last_health_status || 'unknown',
      lastHealthCheck: row.last_health_check ?? null,
      lastError: row.last_error ?? null,
      errorCount: row.error_count || 0,
      registeredBy: row.registered_by || 'system',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
