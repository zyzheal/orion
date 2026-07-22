import { DatabasePool } from '../database';
/**
 * TenantRepository - Database layer for Tenant operations
 * 
 * Handles all PostgreSQL database operations for tenants table
 */


export interface Tenant {
  id: string;
  name: string;
  display_name: string | null;
  status: string;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTenantInput {
  name: string;
  display_name?: string;
  settings?: Record<string, any>;
}

export interface UpdateTenantInput {
  name?: string;
  display_name?: string;
  status?: string;
  settings?: Record<string, any>;
}

interface FindAllOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

export class TenantRepository {
  constructor(private pool: DatabasePool) {}


  /**
   * Find tenant by ID
   */
  async findById(id: string): Promise<Tenant | null> {
    const result = await this.pool.query(
      'SELECT * FROM tenants WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find tenant by name
   */
  async findByName(name: string): Promise<Tenant | null> {
    const result = await this.pool.query(
      'SELECT * FROM tenants WHERE name = $1',
      [name]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all tenants with optional filtering and pagination
   */
  async findAll(options?: FindAllOptions): Promise<Tenant[]> {
    let query = 'SELECT * FROM tenants';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }

    if (options?.offset) {
      params.push(options.offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Count total tenants
   */
  async count(status?: string): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM tenants';
    const params: any[] = [];

    if (status) {
      params.push(status);
      query += ' WHERE status = $1';
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create a new tenant
   */
  async create(input: CreateTenantInput): Promise<Tenant> {
    const { name, display_name, settings } = input;
    
    const result = await this.pool.query(
      `INSERT INTO tenants (name, display_name, settings, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [name, display_name || null, settings || {}]
    );
    
    return result.rows[0];
  }

  /**
   * Update an existing tenant
   */
  async update(id: string, input: UpdateTenantInput): Promise<Tenant | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      updates.push(`name = $${paramIndex++}`);
    }

    if (input.display_name !== undefined) {
      params.push(input.display_name);
      updates.push(`display_name = $${paramIndex++}`);
    }

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramIndex++}`);
    }

    if (input.settings !== undefined) {
      params.push(JSON.stringify(input.settings));
      updates.push(`settings = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    
    const result = await this.pool.query(
      `UPDATE tenants SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Soft delete a tenant (set status to deleted)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE tenants SET status = 'deleted', updated_at = NOW() WHERE id = $1",
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Hard delete a tenant (use with caution)
   */
  async hardDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM tenants WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Check if tenant name exists (excluding deleted)
   */
  async existsByName(name: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM tenants WHERE name = $1 AND status != \'deleted\'',
      [name]
    );
    return result.rowCount > 0;
  }
}