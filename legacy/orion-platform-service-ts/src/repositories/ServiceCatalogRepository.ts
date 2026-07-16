/**
 * ServiceCatalogRepository - PostgreSQL persistence for Service Catalog entries
 *
 * Manages catalog_services table with CRUD and query operations.
 * Extends BaseRepository for common CRUD operations.
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';

export interface CatalogServiceEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  owner: string | null;
  support_team: string | null;
  sla_tier: string;
  availability_target: number | null;
  response_time_target: number | null;
  related_systems: string[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CatalogServiceCreateInput {
  id?: string;
  tenantId: string;
  name: string;
  description?: string;
  category?: string;
  status?: string;
  owner?: string;
  supportTeam?: string;
  slaTier?: string;
  availabilityTarget?: number;
  responseTimeTarget?: number;
  relatedSystems?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface CatalogServiceUpdateInput {
  name?: string;
  description?: string;
  category?: string;
  status?: string;
  owner?: string;
  supportTeam?: string;
  slaTier?: string;
  availabilityTarget?: number;
  responseTimeTarget?: number;
  relatedSystems?: string[];
  metadata?: Record<string, unknown>;
}

export class ServiceCatalogRepository extends BaseRepository<CatalogServiceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'catalog_services');
  }

  /**
   * Create a new catalog service
   */
  async createService(input: CatalogServiceCreateInput): Promise<CatalogServiceEntity> {
    const result = await this.db.query(
      `INSERT INTO catalog_services (id, tenant_id, name, description, category, status, owner, support_team, sla_tier, availability_target, response_time_target, related_systems, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        input.id || crypto.randomUUID(),
        input.tenantId,
        input.name,
        input.description || null,
        input.category || 'general',
        input.status || 'active',
        input.owner || null,
        input.supportTeam || null,
        input.slaTier || 'bronze',
        input.availabilityTarget || null,
        input.responseTimeTarget || null,
        input.relatedSystems || [],
        JSON.stringify(input.metadata || {}),
        input.createdBy || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update a catalog service
   */
  async updateService(id: string, input: CatalogServiceUpdateInput): Promise<CatalogServiceEntity | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(input.category);
    }
    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.owner !== undefined) {
      fields.push(`owner = $${paramIndex++}`);
      values.push(input.owner);
    }
    if (input.supportTeam !== undefined) {
      fields.push(`support_team = $${paramIndex++}`);
      values.push(input.supportTeam);
    }
    if (input.slaTier !== undefined) {
      fields.push(`sla_tier = $${paramIndex++}`);
      values.push(input.slaTier);
    }
    if (input.availabilityTarget !== undefined) {
      fields.push(`availability_target = $${paramIndex++}`);
      values.push(input.availabilityTarget);
    }
    if (input.responseTimeTarget !== undefined) {
      fields.push(`response_time_target = $${paramIndex++}`);
      values.push(input.responseTimeTarget);
    }
    if (input.relatedSystems !== undefined) {
      fields.push(`related_systems = $${paramIndex++}`);
      values.push(input.relatedSystems);
    }
    if (input.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(input.metadata));
    }

    if (fields.length === 0) {
      return this.findById(id) ?? null;
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.db.query(
      `UPDATE catalog_services SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find services by tenant
   */
  async findByTenant(tenantId: string, options?: { limit?: number; offset?: number }): Promise<FindAllResult<CatalogServiceEntity>> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM catalog_services WHERE tenant_id = $1`,
      [tenantId],
    );

    const result = await this.db.query(
      `SELECT * FROM catalog_services WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Find services by category
   */
  async findByCategory(tenantId: string, category: string): Promise<CatalogServiceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM catalog_services WHERE tenant_id = $1 AND category = $2 ORDER BY name ASC`,
      [tenantId, category],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find services by status
   */
  async findByStatus(tenantId: string, status: string): Promise<CatalogServiceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM catalog_services WHERE tenant_id = $1 AND status = $2 ORDER BY name ASC`,
      [tenantId, status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find services by owner
   */
  async findByOwner(tenantId: string, owner: string): Promise<CatalogServiceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM catalog_services WHERE tenant_id = $1 AND owner = $2 ORDER BY name ASC`,
      [tenantId, owner],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): CatalogServiceEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      category: row.category ?? 'general',
      status: row.status ?? 'active',
      owner: row.owner,
      support_team: row.support_team,
      sla_tier: row.sla_tier ?? 'bronze',
      availability_target: row.availability_target ? parseFloat(row.availability_target) : null,
      response_time_target: row.response_time_target,
      related_systems: row.related_systems ?? [],
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
