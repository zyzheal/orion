/**
 * AuditRepository - Database layer for Audit operations
 */

import { DatabasePool } from '../database';

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  request_method: string | null;
  request_path: string | null;
  request_body: Record<string, any> | null;
  response_code: number | null;
  response_body: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  prev_hash: string | null;
  hash: string;
  created_at: Date;
}

export interface CreateAuditLogInput {
  tenant_id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  request_method?: string;
  request_path?: string;
  request_body?: Record<string, any>;
  response_code?: number;
  response_body?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export class AuditRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) { this.pool = pool; }

  async findById(id: string): Promise<AuditLog | null> {
    const result = await this.pool.query('SELECT * FROM audit_logs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(options?: { tenantId?: string; userId?: string; action?: string; resourceType?: string; resourceId?: string; limit?: number; offset?: number }): Promise<AuditLog[]> {
    let query = 'SELECT * FROM audit_logs';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) { params.push(options.tenantId); conditions.push(`tenant_id = $${params.length}`); }
    if (options?.userId) { params.push(options.userId); conditions.push(`user_id = $${params.length}`); }
    if (options?.action) { params.push(options.action); conditions.push(`action = $${params.length}`); }
    if (options?.resourceType) { params.push(options.resourceType); conditions.push(`resource_type = $${params.length}`); }
    if (options?.resourceId) { params.push(options.resourceId); conditions.push(`resource_id = $${params.length}`); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${params.length}`; }
    if (options?.offset) { params.push(options.offset); query += ` OFFSET $${params.length}`; }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async count(options?: { tenantId?: string; userId?: string; action?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM audit_logs';
    const params: any[] = [];
    
    if (options?.tenantId || options?.userId || options?.action) {
      const conditions: string[] = [];
      if (options?.tenantId) { params.push(options.tenantId); conditions.push(`tenant_id = $1`); }
      if (options?.userId) { params.push(options.userId); conditions.push(`user_id = $${params.length}`); }
      if (options?.action) { params.push(options.action); conditions.push(`action = $${params.length}`); }
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  async create(input: CreateAuditLogInput, prevHash?: string): Promise<AuditLog> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');
    const data = JSON.stringify({ ...input, timestamp: new Date().toISOString() });
    hash.update(data + (prevHash || ''));
    const hashResult = hash.digest('hex');

    const { tenant_id, user_id, action, resource_type, resource_id, request_method, request_path, request_body, response_code, response_body, ip_address, user_agent } = input;
    
    const result = await this.pool.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, request_method, request_path, request_body, response_code, response_body, ip_address, user_agent, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [tenant_id, user_id || null, action, resource_type, resource_id || null, request_method || null, request_path || null, request_body || null, response_code || null, response_body || null, ip_address || null, user_agent || null, prevHash || null, hashResult]
    );
    
    return result.rows[0];
  }

  async getLatestHash(tenantId: string): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT hash FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1',
      [tenantId]
    );
    return result.rows[0]?.hash || null;
  }

  async verifyChain(tenantId: string): Promise<{ valid: boolean; brokenAt?: Date }> {
    const logs = await this.findAll({ tenantId, limit: 1000 });
    
    for (let i = 0; i < logs.length - 1; i++) {
      if (logs[i].prev_hash !== logs[i + 1].hash) {
        return { valid: false, brokenAt: logs[i].created_at };
      }
    }
    
    return { valid: true };
  }

  async getActions(tenantId: string): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT DISTINCT action FROM audit_logs WHERE tenant_id = $1 ORDER BY action',
      [tenantId]
    );
    return result.rows.map(r => r.action);
  }

  async getResourceTypes(tenantId: string): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT DISTINCT resource_type FROM audit_logs WHERE tenant_id = $1 ORDER BY resource_type',
      [tenantId]
    );
    return result.rows.map(r => r.resource_type);
  }
}