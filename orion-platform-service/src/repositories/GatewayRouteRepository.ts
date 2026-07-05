/**
 * GatewayRouteRepository - PostgreSQL Repository for API Gateway routes
 *
 * Phase 6 Service Governance: persistent storage for gateway route configuration.
 * All operations are tenant-isolated via BaseRepository.
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

// ==================== Entities ====================

export interface GatewayRouteEntity {
  id: string;
  tenantId: string;
  path: string;
  methods: string[];
  upstreamUrl: string | null;
  plugins: Record<string, any>;
  enabled: boolean;
  priority: number;
  middleware: any[];
  metadata: Record<string, any>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGatewayRouteInput {
  id?: string;
  path: string;
  methods?: string[];
  upstreamUrl?: string;
  plugins?: Record<string, any>;
  enabled?: boolean;
  priority?: number;
  middleware?: any[];
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface UpdateGatewayRouteInput {
  path?: string;
  methods?: string[];
  upstreamUrl?: string;
  plugins?: Record<string, any>;
  enabled?: boolean;
  priority?: number;
  middleware?: any[];
  metadata?: Record<string, any>;
  updatedBy?: string;
}

// ==================== Repository ====================

export class GatewayRouteRepository extends BaseRepository<GatewayRouteEntity> {
  constructor(
    db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'gateway_routes');
  }

  protected mapRowToEntity(row: any): GatewayRouteEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      path: row.path,
      methods: row.methods || [],
      upstreamUrl: row.upstream_url,
      plugins: row.plugins || {},
      enabled: row.enabled,
      priority: row.priority,
      middleware: row.middleware || [],
      metadata: row.metadata || {},
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ==================== CRUD ====================

  async create(input: CreateGatewayRouteInput): Promise<GatewayRouteEntity> {
    const tenantId = this.getTenantId();
    const id = input.id || `gw-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const result = await this.db.query(
      `INSERT INTO gateway_routes (id, tenant_id, path, methods, upstream_url, plugins, enabled, priority, middleware, metadata, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id,
        tenantId,
        input.path,
        JSON.stringify(input.methods || []),
        input.upstreamUrl || null,
        JSON.stringify(input.plugins || {}),
        input.enabled ?? true,
        input.priority ?? 0,
        JSON.stringify(input.middleware || []),
        JSON.stringify(input.metadata || {}),
        input.createdBy || null,
        now,
        now,
      ],
    );

    if (result.rows.length === 0) {
      throw new OrionError('Failed to create gateway route', ErrorCode.INTERNAL_ERROR);
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id: string, input: UpdateGatewayRouteInput): Promise<GatewayRouteEntity | null> {
    const tenantId = this.getTenantId();

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.path !== undefined) {
      updates.push(`path = $${paramIndex++}`);
      params.push(input.path);
    }
    if (input.methods !== undefined) {
      updates.push(`methods = $${paramIndex++}`);
      params.push(JSON.stringify(input.methods));
    }
    if (input.upstreamUrl !== undefined) {
      updates.push(`upstream_url = $${paramIndex++}`);
      params.push(input.upstreamUrl);
    }
    if (input.plugins !== undefined) {
      updates.push(`plugins = $${paramIndex++}`);
      params.push(JSON.stringify(input.plugins));
    }
    if (input.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      params.push(input.enabled);
    }
    if (input.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(input.priority);
    }
    if (input.middleware !== undefined) {
      updates.push(`middleware = $${paramIndex++}`);
      params.push(JSON.stringify(input.middleware));
    }
    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(input.metadata));
    }
    if (input.updatedBy !== undefined) {
      updates.push(`updated_by = $${paramIndex++}`);
      params.push(input.updatedBy);
    }

    if (updates.length === 0) {
      const found = await this.findById(id);
      return found ?? null;
    }

    updates.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());

    params.push(id, tenantId);

    const result = await this.db.query(
      `UPDATE gateway_routes SET ${updates.join(', ')} WHERE id = $${paramIndex - 1} AND tenant_id = $${paramIndex} RETURNING *`,
      params,
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'DELETE FROM gateway_routes WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Stats ====================

  async getStats(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    byMethod: Record<string, number>;
    byService: Record<string, number>;
  }> {
    const tenantId = this.getTenantId();

    const totalResult = await this.db.query(
      'SELECT COUNT(*) as count FROM gateway_routes WHERE tenant_id = $1',
      [tenantId],
    );

    const enabledResult = await this.db.query(
      'SELECT COUNT(*) as count FROM gateway_routes WHERE tenant_id = $1 AND enabled = true',
      [tenantId],
    );

    const methodResult = await this.db.query(
      `SELECT method, COUNT(*) as count
       FROM gateway_routes, jsonb_array_elements_text(methods) as method
       WHERE tenant_id = $1
       GROUP BY method`,
      [tenantId],
    );

    const byMethod: Record<string, number> = {};
    for (const row of methodResult.rows) {
      byMethod[row.method] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(totalResult.rows[0]?.count || '0', 10),
      enabled: parseInt(enabledResult.rows[0]?.count || '0', 10),
      disabled: parseInt(totalResult.rows[0]?.count || '0', 10) - parseInt(enabledResult.rows[0]?.count || '0', 10),
      byMethod,
      byService: {},
    };
  }
}
