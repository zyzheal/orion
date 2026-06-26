import { BaseRepository } from '../db/base-repository';

// ============================================================================
// Entities
// ============================================================================

export interface SqlOrderEntity {
  id: string;
  tenantId: string;
  userId: string;
  databaseName: string;
  sqlText: string;
  comment: string;
  orderType: string;
  status: string;
  result: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  executedAt: Date | null;
  createdAt: Date;
}

export interface DataSourceEntity {
  id: string;
  tenantId: string;
  name: string;
  sourceType: string;
  host: string;
  port: number;
  databaseName: string;
  username: string | null;
  passwordEncrypted: string | null;
  status: string;
  lastChecked: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  pattern: string;
  severity: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Repositories
// ============================================================================

export class SqlOrderRepository extends BaseRepository<SqlOrderEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'dba_sql_orders');
  }

  async findByTenant(tenantId: string, filters?: { status?: string; page?: number; limit?: number }): Promise<{ data: SqlOrderEntity[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (filters?.status) {
      whereClause += ` AND status = $${idx++}`;
      params.push(filters.status);
    }

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM dba_sql_orders ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    const result = await this.db.query(
      `SELECT * FROM dba_sql_orders ${whereClause} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    return { data: result.rows.map(row => this.mapRowToEntity(row)), total };
  }

  async updateStatus(id: string, status: string, extra?: { approvedBy?: string; result?: string }): Promise<SqlOrderEntity | undefined> {
    const sets: string[] = ['status = $2'];
    const params: unknown[] = [id, status];
    let idx = 3;

    if (extra?.approvedBy) {
      sets.push(`approved_by = $${idx++}`);
      params.push(extra.approvedBy);
      sets.push(`approved_at = NOW()`);
    }
    if (extra?.result) {
      sets.push(`result = $${idx++}`);
      params.push(extra.result);
    }
    if (status === 'completed') {
      sets.push('executed_at = NOW()');
    }

    const result = await this.db.query(
      `UPDATE dba_sql_orders SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : undefined;
  }

  protected mapRowToEntity(row: any): SqlOrderEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      databaseName: row.database_name,
      sqlText: row.sql_text,
      comment: row.comment ?? '',
      orderType: row.order_type,
      status: row.status,
      result: row.result ?? null,
      approvedBy: row.approved_by ?? null,
      approvedAt: row.approved_at ?? null,
      executedAt: row.executed_at ?? null,
      createdAt: row.created_at,
    };
  }
}

export class DataSourceRepository extends BaseRepository<DataSourceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'dba_data_sources');
  }

  async findByTenant(tenantId: string): Promise<DataSourceEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM dba_data_sources WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.query(
      'UPDATE dba_data_sources SET status = $2, last_checked = NOW(), updated_at = NOW() WHERE id = $1',
      [id, status],
    );
  }

  protected mapRowToEntity(row: any): DataSourceEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      sourceType: row.source_type,
      host: row.host,
      port: row.port,
      databaseName: row.database_name,
      username: row.username ?? null,
      passwordEncrypted: row.password_encrypted ?? null,
      status: row.status,
      lastChecked: row.last_checked ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class AuditRuleRepository extends BaseRepository<AuditRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'dba_audit_rules');
  }

  async findByTenant(tenantId: string): Promise<AuditRuleEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM dba_audit_rules WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): AuditRuleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      pattern: row.pattern,
      severity: row.severity,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
