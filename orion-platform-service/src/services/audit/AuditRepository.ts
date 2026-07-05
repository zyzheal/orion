import { DatabasePool } from '../database';
/**
 * AuditRepository - Database layer for Audit operations
 */


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
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<AuditLog | null> {
    const result = await this.pool.query('SELECT * FROM audit_logs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(options?: { tenantId?: string; userId?: string; action?: string; resourceType?: string; resourceId?: string; dateFrom?: string; dateTo?: string; limit?: number; offset?: number }): Promise<AuditLog[]> {
    let query = 'SELECT * FROM audit_logs';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) { params.push(options.tenantId); conditions.push(`tenant_id = $${params.length}`); }
    if (options?.userId) { params.push(options.userId); conditions.push(`user_id = $${params.length}`); }
    if (options?.action) { params.push(options.action); conditions.push(`action = $${params.length}`); }
    if (options?.resourceType) { params.push(options.resourceType); conditions.push(`resource_type = $${params.length}`); }
    if (options?.resourceId) { params.push(options.resourceId); conditions.push(`resource_id = $${params.length}`); }
    if (options?.dateFrom) { params.push(options.dateFrom); conditions.push(`created_at >= $${params.length}`); }
    if (options?.dateTo) { params.push(options.dateTo); conditions.push(`created_at <= $${params.length}`); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${params.length}`; }
    if (options?.offset) { params.push(options.offset); query += ` OFFSET $${params.length}`; }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async count(options?: { tenantId?: string; userId?: string; action?: string; resourceType?: string; resourceId?: string; dateFrom?: string; dateTo?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM audit_logs';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) { params.push(options.tenantId); conditions.push(`tenant_id = $${params.length}`); }
    if (options?.userId) { params.push(options.userId); conditions.push(`user_id = $${params.length}`); }
    if (options?.action) { params.push(options.action); conditions.push(`action = $${params.length}`); }
    if (options?.resourceType) { params.push(options.resourceType); conditions.push(`resource_type = $${params.length}`); }
    if (options?.resourceId) { params.push(options.resourceId); conditions.push(`resource_id = $${params.length}`); }
    if (options?.dateFrom) { params.push(options.dateFrom); conditions.push(`created_at >= $${params.length}`); }
    if (options?.dateTo) { params.push(options.dateTo); conditions.push(`created_at <= $${params.length}`); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');

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

  async verifyChain(tenantId: string): Promise<{ valid: boolean; brokenAt?: Date; totalVerified?: number }> {
    // Use cursor-based pagination to verify the FULL chain without memory limits
    // Fetch records in ASC order (oldest first) for correct chain verification
    const PAGE_SIZE = 5000;
    let lastId: string | null = null;
    let allLogs: AuditLog[] = [];
    let hasMore = true;

    while (hasMore) {
      let query = `SELECT * FROM audit_logs WHERE tenant_id = $1`;
      const params: any[] = [tenantId];

      if (lastId) {
        query += ` AND (created_at, id) > (SELECT created_at, id FROM audit_logs WHERE id = $${params.length + 1})`;
        params.push(lastId);
      }

      query += ` ORDER BY created_at ASC, id ASC LIMIT $${params.length + 1}`;
      params.push(PAGE_SIZE);

      const result = await this.pool.query(query, params);
      const page = result.rows;

      if (page.length === 0) {
        hasMore = false;
      } else {
        allLogs = allLogs.concat(page);
        lastId = page[page.length - 1].id;
        if (page.length < PAGE_SIZE) {
          hasMore = false;
        }
      }
    }

    // Verify chain: oldest first, each entry's prev_hash should match the previous entry's hash
    for (let i = 1; i < allLogs.length; i++) {
      // Recompute hash for entry[i-1] to verify it hasn't been tampered
      const crypto = await import('crypto');
      const prevEntry = allLogs[i - 1];
      const prevData = JSON.stringify({
        tenant_id: prevEntry.tenant_id,
        user_id: prevEntry.user_id,
        action: prevEntry.action,
        resource_type: prevEntry.resource_type,
        resource_id: prevEntry.resource_id,
        request_method: prevEntry.request_method,
        request_path: prevEntry.request_path,
        request_body: prevEntry.request_body,
        response_code: prevEntry.response_code,
        response_body: prevEntry.response_body,
        ip_address: prevEntry.ip_address,
        user_agent: prevEntry.user_agent,
        timestamp: prevEntry.created_at.toISOString(),
      });
      const expectedHash = crypto.createHash('sha256').update(prevData + (prevEntry.prev_hash || '')).digest('hex');

      // Check if the stored hash matches the recomputed hash
      if (prevEntry.hash !== expectedHash) {
        return { valid: false, brokenAt: prevEntry.created_at, totalVerified: i };
      }

      // Check chain continuity: current entry's prev_hash should match previous entry's hash
      if (allLogs[i].prev_hash !== prevEntry.hash) {
        return { valid: false, brokenAt: allLogs[i].created_at, totalVerified: i };
      }
    }

    return { valid: true, totalVerified: allLogs.length };
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