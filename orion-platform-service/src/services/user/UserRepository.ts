/**
 * UserRepository - Database layer for User operations
 * 
 * Handles all PostgreSQL database operations for users table
 */

import { DatabasePool } from '../database';

export interface User {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  last_login_at: Date | null;
  last_login_ip: string | null;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

export interface CreateUserInput {
  username: string;
  email?: string;
  passwordHash: string;
  name?: string;
  avatar_url?: string;
  role?: string;
  tenantId?: string;
  created_by?: string;
}

export interface UpdateUserInput {
  username?: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  role?: string;
  status?: string;
  settings?: Record<string, any>;
}

interface FindAllOptions {
  tenantId?: string;
  status?: string;
  role?: string;
  limit?: number;
  offset?: number;
}

export class UserRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all users with optional filtering and pagination
   */
  async findAll(options?: FindAllOptions): Promise<User[]> {
    let query = 'SELECT DISTINCT u.* FROM users u';
    const params: any[] = [];
    const conditions: string[] = [];
    let joinClause = '';

    // Filter by tenant if specified
    if (options?.tenantId) {
      joinClause = ' LEFT JOIN tenant_users tu ON u.id = tu.user_id';
      conditions.push(`tu.tenant_id = $${params.length + 1}`);
      params.push(options.tenantId);
    }

    if (options?.status) {
      params.push(options.status);
      conditions.push(`u.status = $${params.length}`);
    }

    if (options?.role) {
      params.push(options.role);
      conditions.push(`u.role = $${params.length}`);
    }

    if (joinClause) {
      query += joinClause;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY u.created_at DESC';

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
   * Count total users
   */
  async count(options?: { tenantId?: string; status?: string }): Promise<number> {
    let query = 'SELECT COUNT(DISTINCT u.id) as count FROM users u';
    const params: any[] = [];
    const conditions: string[] = [];
    let joinClause = '';

    if (options?.tenantId) {
      joinClause = ' LEFT JOIN tenant_users tu ON u.id = tu.user_id';
      conditions.push(`tu.tenant_id = $${params.length + 1}`);
      params.push(options.tenantId);
    }

    if (options?.status) {
      params.push(options.status);
      conditions.push(`u.status = $${params.length}`);
    }

    if (joinClause || conditions.length > 0) {
      query += joinClause;
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<User> {
    const { username, email, passwordHash, name, avatar_url, role, created_by } = input;
    
    const result = await this.pool.query(
      `INSERT INTO users (username, email, password_hash, name, avatar_url, role, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING *`,
      [username, email || null, passwordHash, name || null, avatar_url || null, role || 'user', created_by || null]
    );

    // If tenantId provided, create tenant-user mapping
    if (input.tenantId) {
      await this.pool.query(
        `INSERT INTO tenant_users (tenant_id, user_id, role)
         VALUES ($1, $2, 'member')`,
        [input.tenantId, result.rows[0].id]
      );
    }
    
    return result.rows[0];
  }

  /**
   * Update an existing user
   */
  async update(id: string, input: UpdateUserInput): Promise<User | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.username !== undefined) {
      params.push(input.username);
      updates.push(`username = $${paramIndex++}`);
    }

    if (input.email !== undefined) {
      params.push(input.email);
      updates.push(`email = $${paramIndex++}`);
    }

    if (input.name !== undefined) {
      params.push(input.name);
      updates.push(`name = $${paramIndex++}`);
    }

    if (input.avatar_url !== undefined) {
      params.push(input.avatar_url);
      updates.push(`avatar_url = $${paramIndex++}`);
    }

    if (input.role !== undefined) {
      params.push(input.role);
      updates.push(`role = $${paramIndex++}`);
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
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Soft delete a user (set status to deleted)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE users SET status = 'deleted', updated_at = NOW() WHERE id = $1",
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Hard delete a user (use with caution)
   */
  async hardDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Update last login time and IP
   */
  async updateLastLogin(id: string, ip: string): Promise<void> {
    await this.pool.query(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
      [ip, id]
    );
  }

  /**
   * Check if username exists (excluding deleted)
   */
  async existsByUsername(username: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM users WHERE username = $1 AND status != \'deleted\'',
      [username]
    );
    return result.rowCount > 0;
  }

  /**
   * Check if email exists (excluding deleted)
   */
  async existsByEmail(email: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM users WHERE email = $1 AND status != \'deleted\'',
      [email]
    );
    return result.rowCount > 0;
  }

  /**
   * Get users by tenant
   */
  async findByTenant(tenantId: string): Promise<User[]> {
    const result = await this.pool.query(
      `SELECT u.* FROM users u
       INNER JOIN tenant_users tu ON u.id = tu.user_id
       WHERE tu.tenant_id = $1
       ORDER BY u.created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  /**
   * Add user to tenant
   */
  async addToTenant(userId: string, tenantId: string, role: string = 'member'): Promise<void> {
    await this.pool.query(
      `INSERT INTO tenant_users (tenant_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = $3`,
      [tenantId, userId, role]
    );
  }

  /**
   * Remove user from tenant
   */
  async removeFromTenant(userId: string, tenantId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM tenant_users WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    );
  }
}