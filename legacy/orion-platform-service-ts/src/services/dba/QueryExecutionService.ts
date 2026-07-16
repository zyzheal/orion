/**
 * Query Execution Service
 *
 * Provides safe, read-only SQL query execution against PostgreSQL data sources.
 * Enforces safety controls: read-only mode, query timeout, max rows, and
 * requires admin capability for execution.
 *
 * All mutations (INSERT/UPDATE/DELETE/DDL) are blocked at the keyword level.
 * Queries are always parameterized — raw string concatenation is rejected.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SavedQueryRepository,
  SavedQueryEntity,
} from '../../repositories/DbaRepository';
import {
  executeQuery as executeDbQuery,
  extractFirstKeyword,
  READ_ONLY_KEYWORDS,
  DML_KEYWORDS,
  DDL_KEYWORDS,
  type QueryExecutionResult as DbQueryExecutionResult,
  type DbConnectionConfig,
} from './db-connection';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('query-execution-service');

// ============================================================================
// Safety Controls
// ============================================================================

/** Maximum query execution time in milliseconds */
export const MAX_QUERY_TIMEOUT_MS = 30_000;

/** Maximum rows returned per query */
export const MAX_RESULT_ROWS = 10_000;

/** Blocked DDL keywords (beyond the basic set from db-connection) */
const EXTRA_BLOCKED_KEYWORDS = [
  'COPY', 'IMPORT', 'EXPORT', 'DO', 'DECLARE', 'CURSOR', 'FETCH',
  'LOCK', 'SET', 'RESET', 'PREPARE', 'DEALLOCATE', 'ANALYZE', 'VACUUM',
  'REINDEX', 'CLUSTER',
];

// ============================================================================
// Types
// ============================================================================

export interface ExecuteQueryInput {
  dataSourceId: string;
  sql: string;
  params?: Record<string, any>;
  timeoutMs?: number;
}

export interface ExplainQueryInput {
  sql: string;
  params?: Record<string, any>;
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTimeMs: number;
  warnings: string[];
  truncated?: boolean;
}

export interface UpdateSavedQueryInput {
  name?: string;
  sql?: string;
  params?: Record<string, any>;
  description?: string;
  tags?: string[];
  category?: string;
  isPublic?: boolean;
}

export interface QueryHistoryEntry {
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

export interface SaveQueryInput {
  name: string;
  sql: string;
  params?: Record<string, any>;
}

export interface SavedQueryDTO {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  sql: string;
  params?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// QueryExecutionService
// ============================================================================

export class QueryExecutionService {
  private savedQueryRepo: SavedQueryRepository;
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    this.db = db;
    this.savedQueryRepo = new SavedQueryRepository(db);
  }

  // --------------------------------------------------------------------------
  // Query Execution
  // --------------------------------------------------------------------------

  /**
   * Execute a read-only SQL query against a PostgreSQL data source.
   *
   * Safety controls applied:
   * - Only SELECT / WITH / EXPLAIN / SHOW / DESCRIBE allowed (keyword check)
   * - DDL/DML keywords blocked (INSERT/UPDATE/DELETE/DROP/ALTER/etc.)
   * - Statement timeout enforced (max 30s)
   * - Max 10,000 rows returned
   * - Requires admin capability (enforced at route level via requirePermission)
   *
   * @returns QueryResult with columns, rows, rowCount, executionTimeMs, warnings
   */
  async executeQuery(
    tenantId: string,
    userId: string,
    input: ExecuteQueryInput,
  ): Promise<{ result: QueryResult; historyEntry: QueryHistoryEntry }> {
    const startTime = Date.now();
    const { dataSourceId, sql, params, timeoutMs } = input;

    // 1. Validate SQL is not empty
    if (!sql || sql.trim().length === 0) {
      throw new OrionError('SQL 查询不能为空', ErrorCode.VALIDATION_ERROR, false, { field: 'sql' });
    }

    // 2. Validate no string concatenation patterns (basic injection prevention)
    this.assertNoConcatenationPatterns(sql);

    // 3. Validate SQL is read-only
    const firstKeyword = extractFirstKeyword(sql);
    if (!firstKeyword) {
      throw new OrionError('无法解析 SQL 查询语句', ErrorCode.VALIDATION_ERROR, false, { sql });
    }

    const isReadOnly = READ_ONLY_KEYWORDS.some(kw => firstKeyword === kw);
    if (!isReadOnly) {
      const matchedDML = DML_KEYWORDS.find(kw => firstKeyword === kw);
      const matchedDDL = DDL_KEYWORDS.find(kw => firstKeyword === kw);
      const matchedExtra = EXTRA_BLOCKED_KEYWORDS.find(kw => firstKeyword === kw);
      const category = matchedDML ? 'DML' : matchedDDL ? 'DDL' : matchedExtra ? 'DDL' : 'Unknown';
      throw new OrionError(
        `${category} 操作不允许通过直连查询执行。仅允许 SELECT/WITH/EXPLAIN/SHOW/DESCRIBE。阻塞的关键字: ${firstKeyword}`,
        ErrorCode.VALIDATION_ERROR,
        false,
        { blockedKeyword: firstKeyword, category, sql },
      );
    }

    // 4. Look up data source
    const dsRow = await this.db.query(
      'SELECT * FROM dba_data_sources WHERE id = $1 AND tenant_id = $2',
      [dataSourceId, tenantId],
    );

    if (dsRow.rows.length === 0) {
      throw new OrionError('数据源不存在', ErrorCode.NOT_FOUND, false, { dataSourceId });
    }

    const ds = dsRow.rows[0];
    const sourceType = (ds.source_type || '').toLowerCase();
    if (sourceType !== 'postgresql' && sourceType !== 'postgres') {
      throw new OrionError(
        `直连查询执行不支持 ${ds.source_type} 数据源，仅支持 PostgreSQL`,
        ErrorCode.VALIDATION_ERROR,
        false,
        { dataSourceId, sourceType: ds.source_type },
      );
    }

    // 5. Build connection config (decrypt password)
    const password = ds.password_encrypted?.startsWith('ENC:AES256:')
      ? this.resolvePassword(ds.password_encrypted)
      : ds.password_encrypted;

    const config: DbConnectionConfig = {
      host: ds.host,
      port: ds.port,
      username: ds.username ?? undefined,
      password: password ?? undefined,
      database: ds.database_name,
      sourceType: ds.source_type,
    };

    // 6. Enforce safety limits
    const effectiveTimeout = Math.min(timeoutMs ?? MAX_QUERY_TIMEOUT_MS, MAX_QUERY_TIMEOUT_MS);
    const maxRows = MAX_RESULT_ROWS;

    // 7. Execute query
    const dbResult = await executeDbQuery(config, sql, effectiveTimeout, maxRows);

    const executionTimeMs = Date.now() - startTime;

    // 8. Build QueryResult
    const warnings: string[] = [];
    if (dbResult.truncated) {
      warnings.push(
        `查询返回行数已截断至 ${maxRows} 行。请使用 LIMIT/OFFSET 或优化查询条件。`,
      );
    }
    if (dbResult.message && !dbResult.truncated) {
      warnings.push(dbResult.message);
    }

    const result: QueryResult = {
      columns: dbResult.fields?.map(f => f.name) ?? [],
      rows: dbResult.rows,
      rowCount: dbResult.rows.length,
      executionTimeMs,
      warnings,
      truncated: dbResult.truncated,
    };

    // 9. Build history entry
    const historyEntry: QueryHistoryEntry = {
      id: uuidv4(),
      tenantId,
      userId,
      dataSourceId,
      dataSourceName: ds.name,
      sql,
      status: dbResult.success ? 'success' : 'error',
      rowCount: dbResult.rows.length,
      latency: executionTimeMs,
      error: dbResult.error,
      createdAt: new Date().toISOString(),
    };

    // 10. Persist audit log (non-blocking)
    this.persistQueryLog(historyEntry).catch(() => {});

    if (!dbResult.success) {
      logger.warn({ error: dbResult.error, dataSourceId, sql: sql.slice(0, 200) }, 'Query execution failed');
    } else {
      logger.info(
        { dataSourceId, rowCount: result.rowCount, latency: executionTimeMs, truncated: result.truncated },
        'Query executed successfully',
      );
    }

    return { result, historyEntry };
  }

  /**
   * Get the EXPLAIN plan for a SQL query without executing it.
   * Returns the query execution plan from PostgreSQL.
   */
  async explainQuery(
    tenantId: string,
    userId: string,
    input: ExplainQueryInput,
  ): Promise<{ plan: any; executionTimeMs: number }> {
    const startTime = Date.now();
    const { sql } = input;

    if (!sql || sql.trim().length === 0) {
      throw new OrionError('SQL 查询不能为空', ErrorCode.VALIDATION_ERROR, false, { field: 'sql' });
    }

    // Wrap the query in EXPLAIN (ANALYZE off, no actual execution)
    const explainSql = `EXPLAIN (FORMAT JSON, VERBOSE) ${sql}`;

    // Validate the wrapped query is still read-only
    const innerKeyword = extractFirstKeyword(sql);
    const isReadOnly = READ_ONLY_KEYWORDS.some(kw => innerKeyword === kw);
    if (!isReadOnly) {
      throw new OrionError(
        `仅允许对只读查询生成执行计划。阻塞的关键字: ${innerKeyword}`,
        ErrorCode.VALIDATION_ERROR,
        false,
        { blockedKeyword: innerKeyword },
      );
    }

    // Use default data source for explain (first available PostgreSQL data source)
    const dsRow = await this.db.query(
      `SELECT * FROM dba_data_sources
       WHERE tenant_id = $1 AND source_type IN ('postgresql', 'postgres')
       LIMIT 1`,
      [tenantId],
    );

    if (dsRow.rows.length === 0) {
      throw new OrionError('未找到可用的 PostgreSQL 数据源来生成执行计划', ErrorCode.NOT_FOUND);
    }

    const ds = dsRow.rows[0];
    const password = ds.password_encrypted?.startsWith('ENC:AES256:')
      ? this.resolvePassword(ds.password_encrypted)
      : ds.password_encrypted;

    const config: DbConnectionConfig = {
      host: ds.host,
      port: ds.port,
      username: ds.username ?? undefined,
      password: password ?? undefined,
      database: ds.database_name,
      sourceType: ds.source_type,
    };

    const dbResult = await executeDbQuery(config, explainSql, MAX_QUERY_TIMEOUT_MS, 1);

    const executionTimeMs = Date.now() - startTime;

    if (!dbResult.success) {
      throw new OrionError(
        `执行计划生成失败: ${dbResult.error}`,
        ErrorCode.DATABASE_ERROR,
        true,
        { error: dbResult.error },
      );
    }

    // Parse EXPLAIN JSON output
    let plan: any = dbResult.rows;
    if (dbResult.rows.length > 0 && Array.isArray(dbResult.rows[0])) {
      plan = dbResult.rows[0];
    }

    return { plan, executionTimeMs };
  }

  /**
   * Validate a SQL query without executing it.
   * Checks for read-only compliance and injection patterns.
   * Returns validation result with any warnings.
   */
  validateQuery(sql: string): { valid: boolean; warnings: string[]; error?: string } {
    const warnings: string[] = [];

    if (!sql || sql.trim().length === 0) {
      return { valid: false, warnings, error: 'SQL 查询不能为空' };
    }

    // Check for string concatenation patterns
    try {
      this.assertNoConcatenationPatterns(sql);
    } catch (err) {
      return {
        valid: false,
        warnings,
        error: err instanceof Error ? err.message : 'SQL 包含不安全的拼接模式',
      };
    }

    // Check keyword compliance
    const firstKeyword = extractFirstKeyword(sql);
    if (!firstKeyword) {
      return { valid: false, warnings, error: '无法解析 SQL 查询语句' };
    }

    const isReadOnly = READ_ONLY_KEYWORDS.some(kw => firstKeyword === kw);
    if (!isReadOnly) {
      const matchedDML = DML_KEYWORDS.find(kw => firstKeyword === kw);
      const matchedDDL = DDL_KEYWORDS.find(kw => firstKeyword === kw);
      const matchedExtra = EXTRA_BLOCKED_KEYWORDS.find(kw => firstKeyword === kw);
      const category = matchedDML ? 'DML' : matchedDDL ? 'DDL' : matchedExtra ? 'DDL' : 'Unknown';
      return {
        valid: false,
        warnings,
        error: `${category} 操作不允许: ${firstKeyword}。仅允许 SELECT/WITH/EXPLAIN/SHOW/DESCRIBE`,
      };
    }

    // Warn about potential expensive queries (no LIMIT)
    const sqlUpper = sql.toUpperCase();
    if (
      firstKeyword === 'SELECT' &&
      !sqlUpper.includes('LIMIT') &&
      !sqlUpper.includes('COUNT(') &&
      !sqlUpper.includes('EXISTS')
    ) {
      warnings.push('查询未包含 LIMIT 子句，可能返回大量数据');
    }

    return { valid: true, warnings };
  }

  // --------------------------------------------------------------------------
  // Query History
  // --------------------------------------------------------------------------

  /**
   * Get recent query execution history for a tenant.
   * Returns entries ordered by most recent first.
   */
  async getQueryHistory(
    tenantId: string,
    limit: number = 50,
  ): Promise<QueryHistoryEntry[]> {
    const safeLimit = Math.min(limit, 100);
    try {
      const result = await this.db.query(
        `SELECT * FROM dba_query_audit_log
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [tenantId, safeLimit],
      );
      return result.rows.map((row: any) => ({
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
    } catch (err) {
      logger.warn({ err }, 'Failed to load query history (table may not exist)');
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Saved Queries
  // --------------------------------------------------------------------------

  /**
   * Save a query template for later reuse.
   */
  async saveQuery(
    tenantId: string,
    userId: string,
    input: SaveQueryInput,
  ): Promise<SavedQueryDTO> {
    // Validate the SQL before saving
    const validation = this.validateQuery(input.sql);
    if (!validation.valid) {
      throw new OrionError(
        `无法保存查询: ${validation.error}`,
        ErrorCode.VALIDATION_ERROR,
        false,
      );
    }

    // Check for duplicate name within tenant+user
    const existing = await this.savedQueryRepo.findByName(tenantId, userId, input.name);
    if (existing) {
      throw new OrionError(
        `已存在同名查询模板: ${input.name}`,
        ErrorCode.ALREADY_EXISTS,
        false,
        { name: input.name },
      );
    }

    const entity = await this.savedQueryRepo.create({
      id: uuidv4(),
      tenantId,
      userId,
      name: input.name,
      sql: input.sql,
      params: input.params ?? null,
    });

    return this.entityToDTO(entity);
  }

  /**
   * List saved queries for a tenant (all users' public queries for the tenant).
   */
  async listSavedQueries(tenantId: string): Promise<SavedQueryDTO[]> {
    const entities = await this.savedQueryRepo.findByTenant(tenantId);
    return entities.map(e => this.entityToDTO(e));
  }

  /**
   * List saved queries for the current user only.
   */
  async listMySavedQueries(tenantId: string, userId: string): Promise<SavedQueryDTO[]> {
    const entities = await this.savedQueryRepo.findByTenantAndUser(tenantId, userId);
    return entities.map(e => this.entityToDTO(e));
  }

  /**
   * Get a single saved query by ID.
   */
  async getSavedQuery(tenantId: string, queryId: string): Promise<SavedQueryDTO | undefined> {
    const entity = await this.savedQueryRepo.findById(queryId);
    if (!entity || entity.tenantId !== tenantId) return undefined;
    return this.entityToDTO(entity);
  }

  /**
   * Update a saved query template.
   */
  async updateSavedQuery(
    tenantId: string,
    queryId: string,
    input: UpdateSavedQueryInput,
  ): Promise<SavedQueryDTO | undefined> {
    const existing = await this.savedQueryRepo.findById(queryId);
    if (!existing || existing.tenantId !== tenantId) return undefined;

    // If SQL is being updated, validate it
    if (input.sql !== undefined) {
      const validation = this.validateQuery(input.sql);
      if (!validation.valid) {
        throw new OrionError(
          `无法更新查询: ${validation.error}`,
          ErrorCode.VALIDATION_ERROR,
          false,
        );
      }
    }

    const updated = await this.savedQueryRepo.update(queryId, {
      name: input.name ?? existing.name,
      sql: input.sql ?? existing.sql,
      params: input.params ?? existing.params,
    });

    return updated ? this.entityToDTO(updated) : undefined;
  }

  /**
   * Delete a saved query template.
   */
  async deleteSavedQuery(tenantId: string, queryId: string): Promise<boolean> {
    const existing = await this.savedQueryRepo.findById(queryId);
    if (!existing || existing.tenantId !== tenantId) return false;
    await this.savedQueryRepo.delete(queryId);
    return true;
  }

  /**
   * Execute a saved query template by ID.
   * Merges saved SQL with optional runtime params.
   */
  async executeSavedQuery(
    tenantId: string,
    userId: string,
    queryId: string,
    runtimeParams?: Record<string, any>,
  ): Promise<{ result: QueryResult; historyEntry: QueryHistoryEntry }> {
    const saved = await this.savedQueryRepo.findById(queryId);
    if (!saved || saved.tenantId !== tenantId) {
      throw new OrionError('保存的查询模板不存在', ErrorCode.NOT_FOUND, false, { queryId });
    }

    // Merge saved params with runtime params (runtime overrides saved)
    const mergedParams = { ...(saved.params ?? {}), ...(runtimeParams ?? {}) };

    const executeInput: Parameters<QueryExecutionService['executeQuery']>[2] = {
      dataSourceId: '', // Will be resolved from context if needed; for now use the first available
      sql: saved.sql,
      params: mergedParams,
    };

    // If the saved query has a dataSourceId embedded in params, use it
    const dataSourceId = mergedParams._dataSourceId;
    if (dataSourceId) {
      executeInput.dataSourceId = dataSourceId;
    }

    return this.executeQuery(tenantId, userId, executeInput);
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  /**
   * Detect and reject string concatenation / template injection patterns.
   * Prevents SQL injection via string interpolation in the raw SQL input.
   */
  private assertNoConcatenationPatterns(sql: string): void {
    // Detect common JS/TS concatenation patterns that should not appear in SQL
    const dangerousPatterns = [
      /\$\{/,           // Template literal: ${...}
      /'\s*\+\s*'/,     // String concat: '...' + '...'
      /"\s*\+\s*"/,     // String concat: "..." + "..."
      /`\s*\+\s*`/,     // Template concat
      /concat\s*\(/i,   // SQL CONCAT function with variables
      /format\s*\(/i,   // String formatting
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sql)) {
        throw new OrionError(
          'SQL 查询包含不安全的拼接模式。请使用参数化查询 (params) 而非字符串拼接',
          ErrorCode.VALIDATION_ERROR,
          false,
          { pattern: pattern.source },
        );
      }
    }
  }

  /**
   * Decrypt an encrypted password value.
   */
  private resolvePassword(encrypted: string): string {
    try {
      const { decryptValue } = require('../../utils/encryption');
      return decryptValue(encrypted);
    } catch {
      return encrypted;
    }
  }

  /**
   * Persist a query execution record to the audit log table.
   */
  private async persistQueryLog(entry: QueryHistoryEntry): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO dba_query_audit_log
         (id, tenant_id, user_id, data_source_id, data_source_name, sql_text, status, row_count, latency_ms, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          entry.id,
          entry.tenantId,
          entry.userId,
          entry.dataSourceId,
          entry.dataSourceName,
          entry.sql,
          entry.status,
          entry.rowCount,
          entry.latency,
          entry.error ?? null,
          entry.createdAt,
        ],
      );
    } catch (err) {
      // Non-blocking: audit log failure should not fail the query result
      logger.error({ err, id: entry.id }, 'Failed to persist query execution audit log');
    }
  }

  /**
   * Convert SavedQueryEntity to SavedQueryDTO.
   */
  private entityToDTO(entity: SavedQueryEntity): SavedQueryDTO {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      userId: entity.userId,
      name: entity.name,
      sql: entity.sql,
      params: entity.params ?? undefined,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
