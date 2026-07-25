/**
 * SqlAuditRepository — Inception SQL 审计数据访问层
 *
 * 负责 sql_audit_logs 表的 CRUD 操作，记录 SQL 审计、解析、执行历史。
 */

import type { IDbAdapter } from '../db/database';
import type { SqlAuditResult, SqlError, SqlWarning } from '../types/inception';

export interface SqlAuditLog {
  id: string;
  tenantId: string;
  db: string;
  sql: string;
  action: 'audit' | 'parse' | 'execute';
  dryRun: boolean;
  result: SqlAuditResult;
  status: 'success' | 'error' | 'warning';
  affectedRows?: number;
  execTime?: number;
  createdAt: string;
  createdBy?: string;
}

export interface SqlAuditLogCreate {
  tenantId: string;
  db: string;
  sql: string;
  action: 'audit' | 'parse' | 'execute';
  dryRun?: boolean;
  result: SqlAuditResult;
  createdBy?: string;
}

export class SqlAuditRepository {
  constructor(private pool: IDbAdapter) {}

  async create(input: SqlAuditLogCreate): Promise<SqlAuditLog> {
    const id = crypto.randomUUID();
    const status = input.result.success
      ? (input.result.warnings.length > 0 ? 'warning' : 'success')
      : 'error';

    const result = await this.pool.query(
      `INSERT INTO sql_audit_logs
       (id, tenant_id, db, sql, action, dry_run, result, status, affected_rows, exec_time, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING *`,
      [
        id,
        input.tenantId,
        input.db,
        input.sql,
        input.action,
        input.dryRun ?? false,
        JSON.stringify(input.result),
        status,
        input.result.affectedRows ?? null,
        input.result.execTime ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.rowToLog(result.rows[0]);
  }

  async findById(id: string): Promise<SqlAuditLog | null> {
    const result = await this.pool.query('SELECT * FROM sql_audit_logs WHERE id = $1', [id]);
    return result.rows[0] ? this.rowToLog(result.rows[0]) : null;
  }

  async findByTenant(tenantId: string, limit = 50): Promise<SqlAuditLog[]> {
    const result = await this.pool.query(
      'SELECT * FROM sql_audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [tenantId, limit],
    );
    return result.rows.map(r => this.rowToLog(r));
  }

  async findByDb(tenantId: string, db: string, limit = 50): Promise<SqlAuditLog[]> {
    const result = await this.pool.query(
      'SELECT * FROM sql_audit_logs WHERE tenant_id = $1 AND db = $2 ORDER BY created_at DESC LIMIT $3',
      [tenantId, db, limit],
    );
    return result.rows.map(r => this.rowToLog(r));
  }

  async findByAction(tenantId: string, action: string, limit = 50): Promise<SqlAuditLog[]> {
    const result = await this.pool.query(
      'SELECT * FROM sql_audit_logs WHERE tenant_id = $1 AND action = $2 ORDER BY created_at DESC LIMIT $3',
      [tenantId, action, limit],
    );
    return result.rows.map(r => this.rowToLog(r));
  }

  async findByStatus(tenantId: string, status: string, limit = 50): Promise<SqlAuditLog[]> {
    const result = await this.pool.query(
      'SELECT * FROM sql_audit_logs WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3',
      [tenantId, status, limit],
    );
    return result.rows.map(r => this.rowToLog(r));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM sql_audit_logs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async countByTenant(tenantId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) FROM sql_audit_logs WHERE tenant_id = $1',
      [tenantId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  private rowToLog(row: any): SqlAuditLog {
    const resultData = typeof row.result === 'string' ? JSON.parse(row.result) : row.result;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      db: row.db,
      sql: row.sql,
      action: row.action,
      dryRun: row.dry_run,
      result: resultData as SqlAuditResult,
      status: row.status,
      affectedRows: row.affected_rows ?? undefined,
      execTime: row.exec_time ?? undefined,
      createdAt: row.created_at.toISOString(),
      createdBy: row.created_by,
    };
  }
}
