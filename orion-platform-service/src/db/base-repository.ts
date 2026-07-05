import { OrionError, ErrorCode } from '../errors';
import { getCurrentTenantId } from './tenant-context-storage';
// Valid SQL identifier pattern (alphanumeric + underscore, not starting with digit)
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function camelToSnake(str: string): string {
  return str
    .replace(/([a-z])(\d)/g, '$1_$2')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/(\d)([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function validateIdentifier(name: string, label: string): void {
  if (!VALID_IDENTIFIER.test(name)) {
    throw new OrionError(`Invalid ${label}: ${name}`, 'VALIDATION_ERROR')
  }
}

export interface FindAllOptions {
  where?: Record<string, any>;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface FindAllResult<T> {
  entities: T[];
  total: number;
}

export abstract class BaseRepository<T extends { id: string }> {
  constructor(
    protected db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    protected tableName: string,
  ) {
    validateIdentifier(tableName, 'table name');
  }

  /** Expose db pool for transaction support in services */
  getDb(): { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> } {
    return this.db;
  }

  /** Get current tenant ID from context, or SYSTEM_TENANT_ID if not in request context */
  protected getTenantId(): string {
    return getCurrentTenantId();
  }

  async findById(id: string): Promise<T | null> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAll(options: FindAllOptions = {}): Promise<FindAllResult<T>> {
    const { where = {}, orderBy = 'created_at', orderDir = 'DESC', limit = 20, offset = 0 } = options;

    validateIdentifier(orderBy, 'order by column');
    const validatedOrderDir = orderDir === 'ASC' ? 'ASC' : 'DESC';

    const tenantId = this.getTenantId();
    let query = `SELECT * FROM ${this.tableName} WHERE tenant_id = $1`;
    const queryParams: any[] = [tenantId];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(where)) {
      // Skip tenant_id in where clause — always filter by current tenant context for security
      if (key === 'tenant_id') continue;
      const snakeKey = camelToSnake(key);
      validateIdentifier(snakeKey, 'where column');
      if (value !== undefined && value !== null) {
        query += ` AND ${snakeKey} = $${paramIndex}`;
        queryParams.push(value);
        paramIndex++;
      }
    }

    query += ` ORDER BY ${orderBy} ${validatedOrderDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await this.db.query(query, queryParams);

    // Build count query with the same WHERE conditions (tenant_id + any filters)
    const whereClause = query.slice(query.indexOf('WHERE') + 5, query.indexOf('ORDER BY'));
    const countQuery = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${whereClause}`;

    const countResult = await this.db.query(countQuery, queryParams.slice(0, -2));

    return {
      entities: result.rows.map((row: any) => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async create(data: any): Promise<T> {
    const rawColumns = Object.keys(data);
    const values = Object.values(data);
    const columns = rawColumns.map(camelToSnake);

    for (const col of columns) {
      validateIdentifier(col, 'column name');
    }

    // Auto-inject tenant_id if not already provided in data
    const tenantId = this.getTenantId();
    const hasTenantId = rawColumns.some(c => c === 'tenantId' || c === 'tenant_id');
    let finalColumns = columns;
    let finalValues = values;
    if (!hasTenantId) {
      finalColumns = ['tenant_id', ...columns];
      finalValues = [tenantId, ...values];
    }

    const placeholders = finalValues.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${finalColumns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, finalValues);

    if (result.rows.length === 0) {
      throw new OrionError(`INSERT into ${this.tableName} returned no rows`, 'OPERATION_FAILED')
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id: string, data: any): Promise<T | null> {
    const tenantId = this.getTenantId();
    const rawColumns = Object.keys(data);
    const values = Object.values(data);
    const columns = rawColumns.map(camelToSnake);

    if (columns.length === 0) {
      throw new OrionError('Update requires at least one column', ErrorCode.OPERATION_FAILED);
    }

    for (const col of columns) {
      validateIdentifier(col, 'column name');
    }

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${columns.length + 1} AND tenant_id = $${columns.length + 2} RETURNING *`;
    const result = await this.db.query(query, [...values, id, tenantId]);

    if (result.rows.length === 0) {
      return null;
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected abstract mapRowToEntity(row: any): T;
}
