/**
 * ApiMarketRepository - Database layer for API Marketplace operations
 *
 * Maps to migration 052: api_products, api_definitions, developer_apps,
 * api_credentials, api_subscriptions tables.
 */

import { DatabasePool } from '../database';

// ==================== Types ====================

export interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string | null;
  status: 'draft' | 'published' | 'deprecated';
  version: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ApiDefinition {
  id: string;
  product_id: string;
  version: string;
  openapi_spec: Record<string, any>;
  changelog: string | null;
  published_at: Date | null;
  is_current: boolean;
  created_at: Date;
}

export interface DeveloperApp {
  id: string;
  developer_id: string | null;
  name: string;
  description: string | null;
  redirect_uris: string[];
  status: 'active' | 'suspended';
  created_at: Date;
}

export interface ApiCredential {
  id: string;
  app_id: string;
  client_id: string;
  client_secret_hash: string;
  scopes: string[];
  rate_limit_per_min: number;
  expires_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
}

export interface ApiSubscription {
  id: string;
  app_id: string;
  product_id: string;
  plan: string;
  status: 'active' | 'suspended' | 'cancelled';
  quota_per_day: number;
  used_today: number;
  created_at: Date;
}

export interface CreateProductInput {
  name: string;
  slug: string;
  description?: string;
  ownerId?: string;
  version?: string;
}

export interface CreateAppInput {
  developerId: string;
  name: string;
  description?: string;
  redirectUris?: string[];
}

export interface CreateCredentialInput {
  appId: string;
  clientId: string;
  clientSecretHash: string;
  scopes?: string[];
  rateLimitPerMin?: number;
  expiresAt?: Date;
}

// ==================== Repository ====================

export class ApiMarketRepository {
  constructor(private pool: DatabasePool) {}

  // ==================== Products ====================

  async createProduct(input: CreateProductInput): Promise<ApiProduct> {
    const result = await this.pool.query(
      `INSERT INTO api_products (name, slug, description, owner_id, version)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [input.name, input.slug, input.description || null, input.ownerId || null, input.version || '1.0.0']
    );
    return result.rows[0];
  }

  async findProductById(id: string): Promise<ApiProduct | null> {
    const row = (await this.pool.query('SELECT * FROM api_products WHERE id = $1', [id])).rows[0];
    return row || null;
  }

  async findProductBySlug(slug: string): Promise<ApiProduct | null> {
    const row = (await this.pool.query('SELECT * FROM api_products WHERE slug = $1', [slug])).rows[0];
    return row || null;
  }

  async listProducts(): Promise<ApiProduct[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM api_products ORDER BY created_at DESC'
    )).rows;
    return rows;
  }

  async updateProduct(id: string, input: { status?: string; name?: string; description?: string }): Promise<ApiProduct | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) { params.push(input.status); updates.push(`status = $${paramIndex++}`); }
    if (input.name !== undefined) { params.push(input.name); updates.push(`name = $${paramIndex++}`); }
    if (input.description !== undefined) { params.push(input.description); updates.push(`description = $${paramIndex++}`); }

    if (updates.length === 0) return this.findProductById(id);

    params.push(id);
    const row = (await this.pool.query(
      `UPDATE api_products SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    )).rows[0];
    return row || null;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM api_products WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // ==================== API Definitions ====================

  async createApiDefinition(productId: string, version: string, openapiSpec: Record<string, any>, changelog?: string): Promise<ApiDefinition> {
    const result = await this.pool.query(
      `INSERT INTO api_definitions (product_id, version, openapi_spec, changelog, is_current)
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [productId, version, openapiSpec, changelog || null]
    );
    return result.rows[0];
  }

  async findApiDefinitionByProductAndVersion(productId: string, version: string): Promise<ApiDefinition | null> {
    const row = (await this.pool.query(
      'SELECT * FROM api_definitions WHERE product_id = $1 AND version = $2',
      [productId, version]
    )).rows[0];
    return row || null;
  }

  // ==================== Developer Apps ====================

  async createApp(input: CreateAppInput): Promise<DeveloperApp> {
    const result = await this.pool.query(
      `INSERT INTO developer_apps (developer_id, name, description, redirect_uris, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
      [input.developerId, input.name, input.description || null, input.redirectUris || []]
    );
    return result.rows[0];
  }

  async findAppById(id: string): Promise<DeveloperApp | null> {
    const row = (await this.pool.query('SELECT * FROM developer_apps WHERE id = $1', [id])).rows[0];
    return row || null;
  }

  async listAppsByDeveloper(developerId: string): Promise<DeveloperApp[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM developer_apps WHERE developer_id = $1 ORDER BY created_at DESC',
      [developerId]
    )).rows;
    return rows;
  }

  async updateApp(id: string, input: { name?: string; description?: string; status?: string }): Promise<DeveloperApp | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) { params.push(input.name); updates.push(`name = $${paramIndex++}`); }
    if (input.description !== undefined) { params.push(input.description); updates.push(`description = $${paramIndex++}`); }
    if (input.status !== undefined) { params.push(input.status); updates.push(`status = $${paramIndex++}`); }

    if (updates.length === 0) return this.findAppById(id);

    params.push(id);
    const row = (await this.pool.query(
      `UPDATE developer_apps SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    )).rows[0];
    return row || null;
  }

  // ==================== API Credentials ====================

  async createCredential(input: CreateCredentialInput): Promise<ApiCredential> {
    const result = await this.pool.query(
      `INSERT INTO api_credentials (app_id, client_id, client_secret_hash, scopes, rate_limit_per_min, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        input.appId,
        input.clientId,
        input.clientSecretHash,
        input.scopes || ['read'],
        input.rateLimitPerMin || 100,
        input.expiresAt || null,
      ]
    );
    return result.rows[0];
  }

  async findCredentialByClientId(clientId: string): Promise<ApiCredential | null> {
    const row = (await this.pool.query('SELECT * FROM api_credentials WHERE client_id = $1', [clientId])).rows[0];
    return row || null;
  }

  async findCredentialById(id: string): Promise<ApiCredential | null> {
    const row = (await this.pool.query('SELECT * FROM api_credentials WHERE id = $1', [id])).rows[0];
    return row || null;
  }

  async updateCredentialLastUsed(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE api_credentials SET last_used_at = NOW() WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  async listCredentialsByApp(appId: string): Promise<ApiCredential[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM api_credentials WHERE app_id = $1 ORDER BY created_at DESC',
      [appId]
    )).rows;
    return rows;
  }

  // ==================== Subscriptions ====================

  async createSubscription(appId: string, productId: string, plan: string, quotaPerDay?: number): Promise<ApiSubscription> {
    const result = await this.pool.query(
      `INSERT INTO api_subscriptions (app_id, product_id, plan, quota_per_day, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
      [appId, productId, plan, quotaPerDay || 1000]
    );
    return result.rows[0];
  }

  async findSubscription(appId: string, productId: string): Promise<ApiSubscription | null> {
    const row = (await this.pool.query(
      'SELECT * FROM api_subscriptions WHERE app_id = $1 AND product_id = $2',
      [appId, productId]
    )).rows[0];
    return row || null;
  }

  async listSubscriptionsByApp(appId: string): Promise<ApiSubscription[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM api_subscriptions WHERE app_id = $1',
      [appId]
    )).rows;
    return rows;
  }

  async updateSubscriptionUsage(id: string, usedToday: number): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE api_subscriptions SET used_today = $1 WHERE id = $2',
      [usedToday, id]
    );
    return (result.rowCount || 0) > 0;
  }
}