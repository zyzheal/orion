/**
 * ServiceRegistryRepository - PostgreSQL Repository for service registration
 *
 * Phase 6 Service Governance: persistent storage for service registry.
 * All operations are tenant-isolated via BaseRepository.
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

// ==================== Entities ====================

export interface ServiceRegistryEntity {
  id: string;
  tenantId: string;
  serviceId: string;
  serviceName: string;
  serviceUrl: string;
  protocol: 'http' | 'grpc' | 'tcp' | 'custom';
  version: string;
  status: 'registering' | 'registered' | 'deregistering' | 'deregistered';
  healthStatus: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  lastHeartbeatAt: Date | null;
  metadata: Record<string, any>;
  registeredAt: Date;
  deregisteredAt: Date | null;
  updatedAt: Date;
}

export interface RegisterServiceInput {
  id?: string;
  serviceId: string;
  serviceName: string;
  serviceUrl: string;
  protocol?: 'http' | 'grpc' | 'tcp' | 'custom';
  version?: string;
  metadata?: Record<string, any>;
}

// ==================== Repository ====================

export class ServiceRegistryRepository extends BaseRepository<ServiceRegistryEntity> {
  constructor(
    db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'service_registry');
  }

  protected mapRowToEntity(row: any): ServiceRegistryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      serviceId: row.service_id,
      serviceName: row.service_name,
      serviceUrl: row.service_url,
      protocol: row.protocol,
      version: row.version,
      status: row.status,
      healthStatus: row.health_status,
      lastHeartbeatAt: row.last_heartbeat_at,
      metadata: row.metadata || {},
      registeredAt: row.registered_at,
      deregisteredAt: row.deregistered_at,
      updatedAt: row.updated_at,
    };
  }

  // ==================== Registration ====================

  /**
   * Register a new service in the registry.
   * Throws if service_id already exists within the tenant.
   */
  async register(input: RegisterServiceInput): Promise<ServiceRegistryEntity> {
    const tenantId = this.getTenantId();
    const id = input.id || `svc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const result = await this.db.query(
      `INSERT INTO service_registry
       (id, tenant_id, service_id, service_name, service_url, protocol, version, status, health_status, metadata, registered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id,
        tenantId,
        input.serviceId,
        input.serviceName,
        input.serviceUrl,
        input.protocol || 'http',
        input.version || '1.0.0',
        'registered',
        'unknown',
        JSON.stringify(input.metadata || {}),
        now,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Deregister a service by service_id.
   * Marks the service as deregistered and records the timestamp.
   */
  async deregister(serviceId: string): Promise<void> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `UPDATE service_registry
       SET status = 'deregistered', deregistered_at = NOW(), updated_at = NOW()
       WHERE service_id = $1 AND tenant_id = $2 AND status != 'deregistered'`,
      [serviceId, tenantId],
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new OrionError(`Service not found or already deregistered: ${serviceId}`, ErrorCode.NOT_FOUND);
    }
  }

  // ==================== Queries ====================

  /**
   * Find service by service_id (within current tenant).
   */
  async findByServiceId(serviceId: string): Promise<ServiceRegistryEntity | undefined> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM service_registry WHERE service_id = $1 AND tenant_id = $2`,
      [serviceId, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find service by internal id (within current tenant).
   */
  async findById(id: string): Promise<ServiceRegistryEntity | null> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM service_registry WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all services for the current tenant.
   */
  async findByTenantId(tenantId: string, limit = 100, offset = 0): Promise<ServiceRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM service_registry WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all services (all tenants, for system-level views).
   */
  async findAll(options: { limit?: number; offset?: number } = {}): Promise<FindAllResult<ServiceRegistryEntity>> {
    const { limit = 100, offset = 0 } = options;
    const result = await this.db.query(
      `SELECT * FROM service_registry ORDER BY updated_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const entities = result.rows.map(row => this.mapRowToEntity(row));
    // For system-level view, count all records
    const countResult = await this.db.query(`SELECT COUNT(*) as count FROM service_registry`);
    const total = parseInt(countResult.rows[0].count, 10);
    return { entities, total };
  }

  // ==================== Health ====================

  /**
   * Update the health status and last heartbeat of a service.
   */
  async updateHealth(serviceId: string, healthStatus: 'healthy' | 'unhealthy' | 'degraded'): Promise<ServiceRegistryEntity> {
    const tenantId = this.getTenantId();
    const now = new Date();
    const result = await this.db.query(
      `UPDATE service_registry
       SET health_status = $1, last_heartbeat_at = $2, updated_at = $3
       WHERE service_id = $4 AND tenant_id = $5
       RETURNING *`,
      [healthStatus, now, now, serviceId, tenantId],
    );
    if (result.rows.length === 0) {
      throw new OrionError(`Service not found: ${serviceId}`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all healthy services within the current tenant.
   */
  async findHealthy(tenantId?: string): Promise<ServiceRegistryEntity[]> {
    const effectiveTenantId = tenantId || this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM service_registry
       WHERE tenant_id = $1 AND health_status = 'healthy' AND status = 'registered'
       ORDER BY updated_at DESC`,
      [effectiveTenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all unhealthy services within the current tenant.
   */
  async findUnhealthy(tenantId?: string): Promise<ServiceRegistryEntity[]> {
    const effectiveTenantId = tenantId || this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM service_registry
       WHERE tenant_id = $1 AND health_status IN ('unhealthy', 'degraded') AND status = 'registered'
       ORDER BY updated_at DESC`,
      [effectiveTenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Record a heartbeat for a service (updates last_heartbeat_at without changing health_status).
   */
  async recordHeartbeat(serviceId: string): Promise<void> {
    const tenantId = this.getTenantId();
    await this.db.query(
      `UPDATE service_registry
       SET last_heartbeat_at = NOW(), updated_at = NOW()
       WHERE service_id = $1 AND tenant_id = $2`,
      [serviceId, tenantId],
    );
  }

  // ==================== Metadata ====================

  /**
   * Update service metadata (partial update).
   */
  async updateMetadata(serviceId: string, metadata: Record<string, any>): Promise<ServiceRegistryEntity> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `UPDATE service_registry
       SET metadata = metadata || $1, updated_at = NOW()
       WHERE service_id = $2 AND tenant_id = $3
       RETURNING *`,
      [JSON.stringify(metadata), serviceId, tenantId],
    );
    if (result.rows.length === 0) {
      throw new OrionError(`Service not found: ${serviceId}`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }
}
