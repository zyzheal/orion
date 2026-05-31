/**
 * DevPortalMockRuleRepository
 * Data access layer for developer portal mock rules.
 * Replaces in-memory Map<string, MockRule> in MockServiceManager.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

export interface DevPortalMockRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  method: string;
  path: string;
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  delay: number;
  enabled: boolean;
  priority: number;
  matchType: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DevPortalMockRuleRepository extends BaseRepository<DevPortalMockRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'devportal_mock_rules');
  }

  async create(data: Omit<DevPortalMockRuleEntity, 'createdAt' | 'updatedAt'> & Partial<Pick<DevPortalMockRuleEntity, 'id'>>): Promise<DevPortalMockRuleEntity> {
    const columns = ['id', 'tenant_id', 'name', 'description', 'method', 'path', 'status_code', 'headers', 'body', 'delay', 'enabled', 'priority', 'match_type'];
    const values = [data.id, data.tenantId, data.name, data.description, data.method, data.path, data.statusCode, JSON.stringify(data.headers), JSON.stringify(data.body), data.delay, data.enabled, data.priority, data.matchType];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', `INSERT into ${this.tableName} returned no rows`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, options?: { enabled?: boolean; method?: string }): Promise<DevPortalMockRuleEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (options?.enabled !== undefined) {
      query += ` AND enabled = $${paramIdx++}`;
      params.push(options.enabled);
    }
    if (options?.method) {
      query += ` AND method = $${paramIdx++}`;
      params.push(options.method.toUpperCase());
    }

    query += ` ORDER BY priority DESC, created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabledByTenant(tenantId: string, method: string): Promise<DevPortalMockRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND enabled = true AND method = $2 ORDER BY priority DESC`,
      [tenantId, method.toUpperCase()],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async toggleEnabled(id: string): Promise<DevPortalMockRuleEntity> {
    const result = await this.db.query(
      `UPDATE ${this.tableName} SET enabled = NOT enabled, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', `Mock rule not found: ${id}`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): DevPortalMockRuleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? '',
      method: row.method,
      path: row.path,
      statusCode: row.status_code,
      headers: row.headers ?? {},
      body: row.body ?? {},
      delay: row.delay,
      enabled: row.enabled,
      priority: row.priority,
      matchType: row.match_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
