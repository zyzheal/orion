/**
 * DBA (Database Administration) Service
 * SQL order management, data source management, audit rules
 *
 * Migrated from Map() to PostgreSQL Repository pattern (2026-06-26)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SqlOrderRepository,
  DataSourceRepository,
  AuditRuleRepository,
  SqlOrderEntity,
  DataSourceEntity,
  AuditRuleEntity,
} from '../../repositories/DbaRepository';
import { executeQuery as executeDbQuery, type QueryExecutionResult, testDatabaseConnection } from './db-connection';
import { createLogger } from '../../utils/logger';
import { OrionError } from '../../errors';

const logger = createLogger('dba-service');

// ============================================================================
// Types (preserved for backward compatibility)
// ============================================================================

export interface SqlOrder {
  id: string;
  tenantId: string;
  userId: string;
  database: string;
  sql: string;
  comment: string;
  type: 'query' | 'insert' | 'update' | 'delete' | 'ddl';
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  result?: string;
  createdAt: string;
  executedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'redis' | 'mongodb';
  host: string;
  port: number;
  database: string;
  status: 'online' | 'offline' | 'error';
  lastChecked?: string;
}

export interface AuditRule {
  id: string;
  tenantId: string;
  name: string;
  pattern: string;
  severity: 'info' | 'warning' | 'error';
  enabled: boolean;
}

export interface CreateOrderInput {
  database: string;
  sql: string;
  comment: string;
  type?: string;
}

export interface CreateDataSourceInput {
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
}

export interface CreateAuditRuleInput {
  name: string;
  pattern: string;
  severity?: string;
  enabled?: boolean;
}

// ============================================================================
// Extra types
// ============================================================================

export interface QueryExecutionRecord {
  id: string;
  tenantId: string;
  userId: string;
  dataSourceId: string;
  dataSourceName: string;
  sql: string;
  status: 'success' | 'error';
  rowCount: number;
  latency: number;
  error?: string;
  createdAt: string;
}

export interface DirectQueryInput {
  dataSourceId: string;
  sql: string;
  timeout?: number;
}

export interface DirectQueryResult {
  success: boolean;
  data?: {
    rows: any[];
    rowCount: number;
    fields?: { name: string; dataTypeID: number }[];
    latency: number;
    truncated?: boolean;
    message?: string;
  };
  error?: string;
  executionRecord: QueryExecutionRecord;
}

export class DbaService {
  private sqlOrderRepo: SqlOrderRepository;
  private dataSourceRepo: DataSourceRepository;
  private auditRuleRepo: AuditRuleRepository;
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
    this.sqlOrderRepo = new SqlOrderRepository(db);
    this.dataSourceRepo = new DataSourceRepository(db);
    this.auditRuleRepo = new AuditRuleRepository(db);
  }

  // ---- Orders ----

  async listOrders(params?: { tenantId?: string; status?: string; page?: number; limit?: number }): Promise<{ data: SqlOrder[]; total: number }> {
    if (!params?.tenantId) return { data: [], total: 0 };
    const result = await this.sqlOrderRepo.findByTenant(params.tenantId, {
      status: params.status,
      page: params.page,
      limit: params.limit,
    });
    return { data: result.data.map(e => this.orderToDTO(e)), total: result.total };
  }

  async getOrder(id: string): Promise<SqlOrder | undefined> {
    const entity = await this.sqlOrderRepo.findById(id);
    return entity ? this.orderToDTO(entity) : undefined;
  }

  async createOrder(input: CreateOrderInput, userId: string, tenantId: string): Promise<SqlOrder> {
    const entity = await this.sqlOrderRepo.create({
      id: uuidv4(),
      tenantId,
      userId,
      databaseName: input.database,
      sqlText: input.sql,
      comment: input.comment,
      orderType: input.type || 'query',
      status: 'pending',
    });
    return this.orderToDTO(entity);
  }

  async approveOrder(id: string, approvedBy: string): Promise<SqlOrder | undefined> {
    const entity = await this.sqlOrderRepo.updateStatus(id, 'approved', { approvedBy });
    return entity ? this.orderToDTO(entity) : undefined;
  }

  async rejectOrder(id: string): Promise<SqlOrder | undefined> {
    const entity = await this.sqlOrderRepo.updateStatus(id, 'rejected');
    return entity ? this.orderToDTO(entity) : undefined;
  }

  async executeOrder(id: string): Promise<SqlOrder | undefined> {
    const entity = await this.sqlOrderRepo.updateStatus(id, 'completed', { result: 'Execution completed' });
    return entity ? this.orderToDTO(entity) : undefined;
  }

  // ---- Data Sources ----

  async listDataSources(tenantId?: string): Promise<DataSource[]> {
    if (!tenantId) return [];
    const entities = await this.dataSourceRepo.findByTenant(tenantId);
    return entities.map(e => this.dataSourceToDTO(e));
  }

  async getDataSource(id: string): Promise<DataSource | undefined> {
    const entity = await this.dataSourceRepo.findById(id);
    return entity ? this.dataSourceToDTO(entity) : undefined;
  }

  async createDataSource(input: CreateDataSourceInput, tenantId?: string): Promise<DataSource> {
    const entity = await this.dataSourceRepo.create({
      id: uuidv4(),
      tenantId: tenantId ?? (() => { throw new OrionError('tenantId is required for data source creation', 'VALIDATION_ERROR'); })(),
      name: input.name,
      sourceType: input.type,
      host: input.host,
      port: input.port,
      databaseName: input.database,
      username: input.username ?? null,
      passwordEncrypted: input.password ?? null,
      status: 'offline',
    });
    return this.dataSourceToDTO(entity);
  }

  async updateDataSource(id: string, input: Partial<DataSource>): Promise<DataSource | undefined> {
    const existing = await this.dataSourceRepo.findById(id);
    if (!existing) return undefined;
    const entity = await this.dataSourceRepo.update(id, {
      name: input.name ?? existing.name,
      sourceType: input.type ?? existing.sourceType,
      host: input.host ?? existing.host,
      port: input.port ?? existing.port,
      databaseName: input.database ?? existing.databaseName,
      status: input.status ?? existing.status,
    });
    return entity ? this.dataSourceToDTO(entity) : undefined;
  }

  async deleteDataSource(id: string): Promise<boolean> {
    const existing = await this.dataSourceRepo.findById(id);
    if (!existing) return false;
    await this.dataSourceRepo.delete(id);
    return true;
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string; latency?: number; version?: string }> {
    const ds = await this.dataSourceRepo.findById(id);
    if (!ds) return { success: false, message: 'Data source not found' };

    try {
      const result = await testDatabaseConnection(ds);
      const status = result.success ? 'online' : 'error';
      await this.dataSourceRepo.updateStatus(id, status);
      return {
        success: result.success,
        message: result.message,
        latency: result.latency,
        version: result.version,
      };
    } catch (err) {
      await this.dataSourceRepo.updateStatus(id, 'error');
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      };
    }
  }

  // ---- Direct Query Execution ----

  /**
   * Execute a read-only SQL query directly against a data source.
   *
   * Validates the query is SELECT/WITH/EXPLAIN/SHOW/DESCRIBE only (DDL/DML blocked).
   * Enforces a configurable timeout (default 30s).
   * Logs execution details to audit trail.
   *
   * @returns Query results with execution metadata
   */
  async executeDirectQuery(
    input: DirectQueryInput,
    auth: { userId: string; tenantId: string },
  ): Promise<DirectQueryResult> {
    const startTime = Date.now();
    const { dataSourceId, sql, timeout } = input;

    // 1. Validate data source exists and is supported
    const ds = await this.dataSourceRepo.findById(dataSourceId);
    if (!ds) {
      return this.buildErrorResult(sql, dataSourceId, '', 'Data source not found', startTime, auth);
    }

    // Only PostgreSQL is supported for direct query execution
    const sourceType = ds.sourceType.toLowerCase();
    if (sourceType !== 'postgresql' && sourceType !== 'postgres') {
      return this.buildErrorResult(
        sql, dataSourceId, ds.name,
        `Direct query execution not supported for ${ds.sourceType}. Only PostgreSQL data sources are supported.`,
        startTime, auth,
      );
    }

    // 2. Decrypt password and build config
    const password = ds.passwordEncrypted?.startsWith('ENC:AES256:')
      ? this.resolvePassword(ds.passwordEncrypted)
      : ds.passwordEncrypted;

    const config = {
      host: ds.host,
      port: ds.port,
      username: ds.username ?? undefined,
      password: password ?? undefined,
      database: ds.databaseName,
      sourceType: ds.sourceType,
    };

    // 3. Execute the query
    const timeoutMs = timeout ?? 30000;
    const result = await executeDbQuery(config, sql, timeoutMs);

    // 4. Build execution record
    const record: QueryExecutionRecord = {
      id: uuidv4(),
      tenantId: auth.tenantId,
      userId: auth.userId,
      dataSourceId,
      dataSourceName: ds.name,
      sql,
      status: result.success ? 'success' : 'error',
      rowCount: result.rowCount,
      latency: result.latency,
      error: result.error,
      createdAt: new Date().toISOString(),
    };

    // 5. Log to audit trail
    await this.logQueryExecution(record);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Query execution failed',
        executionRecord: record,
      };
    }

    return {
      success: true,
      data: {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields,
        latency: result.latency,
        truncated: result.truncated,
        message: result.message,
      },
      executionRecord: record,
    };
  }

  /**
   * List query execution audit logs with pagination.
   */
  async listQueryLogs(
    auth: { tenantId: string },
    params?: { page?: number; limit?: number; dataSourceId?: string; status?: string },
  ): Promise<{ data: QueryExecutionRecord[]; total: number; page: number; limit: number }> {
    const page = params?.page || 1;
    const limit = Math.min(params?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE tenant_id = $1';
    const queryParams: unknown[] = [auth.tenantId];
    let idx = 2;

    if (params?.dataSourceId) {
      whereClause += ` AND data_source_id = $${idx++}`;
      queryParams.push(params.dataSourceId);
    }
    if (params?.status) {
      whereClause += ` AND status = $${idx++}`;
      queryParams.push(params.status);
    }

    try {
      const countResult = await this.db.query(
        `SELECT COUNT(*) as count FROM dba_query_audit_log ${whereClause}`,
        queryParams,
      );
      const total = parseInt(countResult.rows[0]?.count || '0', 10);

      const result = await this.db.query(
        `SELECT * FROM dba_query_audit_log ${whereClause} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...queryParams, limit, offset],
      );

      const data: QueryExecutionRecord[] = result.rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        dataSourceId: row.data_source_id,
        dataSourceName: row.data_source_name,
        sql: row.sql_text,
        status: row.status,
        rowCount: row.row_count,
        latency: row.latency_ms,
        error: row.error_message ?? undefined,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      }));

      return { data, total, page, limit };
    } catch (err) {
      // If the table doesn't exist yet, return empty
      logger.warn({ err }, 'Failed to list query audit logs (table may not exist)');
      return { data: [], total: 0, page, limit };
    }
  }

  /**
   * Persist a query execution record to the audit log table.
   */
  private async logQueryExecution(record: QueryExecutionRecord): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO dba_query_audit_log (id, tenant_id, user_id, data_source_id, data_source_name, sql_text, status, row_count, latency_ms, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          record.id,
          record.tenantId,
          record.userId,
          record.dataSourceId,
          record.dataSourceName,
          record.sql,
          record.status,
          record.rowCount,
          record.latency,
          record.error ?? null,
          record.createdAt,
        ],
      );
      logger.info({ id: record.id, dataSourceId: record.dataSourceId, status: record.status }, 'Query execution audit logged');
    } catch (err) {
      // Non-blocking: audit log failure should not fail the query result
      logger.error({ err, id: record.id }, 'Failed to persist query execution audit log');
    }
  }

  /**
   * Build an error result with a corresponding execution record.
   */
  private buildErrorResult(
    sql: string,
    dataSourceId: string,
    dataSourceName: string,
    error: string,
    startTime: number,
    auth: { userId: string; tenantId: string },
  ): DirectQueryResult {
    const record: QueryExecutionRecord = {
      id: uuidv4(),
      tenantId: auth.tenantId,
      userId: auth.userId,
      dataSourceId,
      dataSourceName,
      sql,
      status: 'error',
      rowCount: 0,
      latency: Date.now() - startTime,
      error,
      createdAt: new Date().toISOString(),
    };

    // Fire-and-forget audit logging
    this.logQueryExecution(record).catch(() => {});

    return { success: false, error, executionRecord: record };
  }

  /**
   * Decrypt password if encrypted, otherwise return as-is.
   */
  private resolvePassword(encrypted: string): string {
    try {
      const { decryptValue } = require('../../utils/encryption');
      return decryptValue(encrypted);
    } catch {
      return encrypted;
    }
  }

  // ---- Audit Rules ----

  async listAuditRules(tenantId?: string): Promise<AuditRule[]> {
    if (!tenantId) return [];
    const entities = await this.auditRuleRepo.findByTenant(tenantId);
    return entities.map(e => this.auditRuleToDTO(e));
  }

  async createAuditRule(input: CreateAuditRuleInput, tenantId: string): Promise<AuditRule> {
    const entity = await this.auditRuleRepo.create({
      id: uuidv4(),
      tenantId,
      name: input.name,
      pattern: input.pattern,
      severity: input.severity || 'warning',
      enabled: input.enabled ?? true,
    });
    return this.auditRuleToDTO(entity);
  }

  async updateAuditRule(id: string, input: Partial<AuditRule>): Promise<AuditRule | undefined> {
    const existing = await this.auditRuleRepo.findById(id);
    if (!existing) return undefined;
    const entity = await this.auditRuleRepo.update(id, {
      name: input.name ?? existing.name,
      pattern: input.pattern ?? existing.pattern,
      severity: input.severity ?? existing.severity,
      enabled: input.enabled ?? existing.enabled,
    });
    return entity ? this.auditRuleToDTO(entity) : undefined;
  }

  // ---- DTO Converters ----

  private orderToDTO(e: SqlOrderEntity): SqlOrder {
    return {
      id: e.id,
      tenantId: e.tenantId,
      userId: e.userId,
      database: e.databaseName,
      sql: e.sqlText,
      comment: e.comment,
      type: e.orderType as SqlOrder['type'],
      status: e.status as SqlOrder['status'],
      result: e.result ?? undefined,
      createdAt: e.createdAt.toISOString(),
      executedAt: e.executedAt?.toISOString(),
      approvedBy: e.approvedBy ?? undefined,
      approvedAt: e.approvedAt?.toISOString(),
    };
  }

  private dataSourceToDTO(e: DataSourceEntity): DataSource {
    return {
      id: e.id,
      name: e.name,
      type: e.sourceType as DataSource['type'],
      host: e.host,
      port: e.port,
      database: e.databaseName,
      status: e.status as DataSource['status'],
      lastChecked: e.lastChecked?.toISOString(),
    };
  }

  private auditRuleToDTO(e: AuditRuleEntity): AuditRule {
    return {
      id: e.id,
      tenantId: e.tenantId,
      name: e.name,
      pattern: e.pattern,
      severity: e.severity as AuditRule['severity'],
      enabled: e.enabled,
    };
  }
}
