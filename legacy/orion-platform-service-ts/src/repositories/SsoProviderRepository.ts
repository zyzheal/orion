/**
 * SSO Provider Repository
 *
 * Data access layer for sso_providers table.
 * Provides CRUD operations for SSO provider configurations.
 */

import { DatabasePool } from '../services/database';

export interface SsoProviderEntity {
  id: string;
  name: string;
  type: 'oidc' | 'ldap' | 'wechat' | 'cas' | 'saml';
  enabled: boolean;
  display_name: string;
  display_icon?: string;
  config: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSsoProviderInput {
  name: string;
  type: string;
  enabled?: boolean;
  display_name?: string;
  display_icon?: string;
  config?: Record<string, any>;
}

export interface UpdateSsoProviderInput {
  enabled?: boolean;
  display_name?: string;
  display_icon?: string;
  config?: Record<string, any>;
}

export class SsoProviderRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Find all SSO providers
   */
  async findAll(): Promise<SsoProviderEntity[]> {
    const result = await this.pool.query(
      'SELECT id, name, type, enabled, display_name, display_icon, config, created_at, updated_at FROM sso_providers ORDER BY name'
    );
    return result.rows as SsoProviderEntity[];
  }

  /**
   * Find enabled SSO providers (for public display on login page)
   */
  async findEnabled(): Promise<Pick<SsoProviderEntity, 'name' | 'type' | 'display_name' | 'display_icon'>[]> {
    const result = await this.pool.query(
      'SELECT name, type, display_name, display_icon FROM sso_providers WHERE enabled = true ORDER BY name'
    );
    return result.rows;
  }

  /**
   * Find SSO provider by name
   */
  async findByName(name: string): Promise<SsoProviderEntity | null> {
    const result = await this.pool.query(
      'SELECT id, name, type, enabled, display_name, display_icon, config, created_at, updated_at FROM sso_providers WHERE name = $1',
      [name]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new SSO provider
   */
  async create(input: CreateSsoProviderInput): Promise<SsoProviderEntity> {
    const result = await this.pool.query(
      `INSERT INTO sso_providers (name, type, enabled, display_name, display_icon, config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, type, enabled, display_name, display_icon, config, created_at, updated_at`,
      [
        input.name,
        input.type,
        input.enabled ?? true,
        input.display_name || input.name,
        input.display_icon || '',
        JSON.stringify(input.config || {}),
      ]
    );
    return result.rows[0];
  }

  /**
   * Update an existing SSO provider
   */
  async update(name: string, input: UpdateSsoProviderInput): Promise<SsoProviderEntity | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      params.push(input.enabled);
    }
    if (input.display_name !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      params.push(input.display_name);
    }
    if (input.display_icon !== undefined) {
      updates.push(`display_icon = $${paramIndex++}`);
      params.push(input.display_icon);
    }
    if (input.config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      params.push(JSON.stringify(input.config));
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push(`updated_at = NOW()`);
    params.push(name);

    const result = await this.pool.query(
      `UPDATE sso_providers SET ${updates.join(', ')} WHERE name = $${paramIndex}
       RETURNING id, name, type, enabled, display_name, display_icon, config, created_at, updated_at`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Delete an SSO provider by name
   */
  async delete(name: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM sso_providers WHERE name = $1', [name]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if an SSO provider exists
   */
  async exists(name: string): Promise<boolean> {
    const result = await this.pool.query('SELECT 1 FROM sso_providers WHERE name = $1', [name]);
    return result.rows.length > 0;
  }
}
