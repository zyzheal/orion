import { OrionError, ErrorCode } from '../errors';
// Valid SQL identifier pattern (alphanumeric + underscore, not starting with digit)
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
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

  async findById(id: string): Promise<T | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAll(options: FindAllOptions = {}): Promise<FindAllResult<T>> {
    const { where = {}, orderBy = 'created_at', orderDir = 'DESC', limit = 20, offset = 0 } = options;

    validateIdentifier(orderBy, 'order by column');
    const validatedOrderDir = orderDir === 'ASC' ? 'ASC' : 'DESC';

    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const queryParams: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(where)) {
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

    // Build count query safely: extract table name from validated query
    const countQuery = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE 1=1` +
      query.slice(query.indexOf('WHERE 1=1') + 'WHERE 1=1'.length, query.indexOf(' ORDER BY'));

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

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError(`INSERT into ${this.tableName} returned no rows`, 'OPERATION_FAILED')
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id: string, data: any): Promise<T> {
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
    const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${columns.length + 1} RETURNING *`;
    const result = await this.db.query(query, [...values, id]);

    if (result.rows.length === 0) {
      throw new OrionError(`UPDATE on ${this.tableName} affected no rows (id: ${id})`, 'OPERATION_FAILED')
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected abstract mapRowToEntity(row: any): T;
}
