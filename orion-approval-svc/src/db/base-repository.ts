// Valid SQL identifier pattern (alphanumeric + underscore, not starting with digit)
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateIdentifier(name: string, label: string): void {
  if (!VALID_IDENTIFIER.test(name)) {
    throw new Error(`Invalid ${label}: ${name}`);
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

  async findById(id: string): Promise<T | null> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAll(options: FindAllOptions = {}): Promise<FindAllResult<T>> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = options.orderBy || 'created_at';
    const orderDir = options.orderDir || 'DESC';
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY ${orderBy} ${orderDir} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset],
    );

    return {
      entities: result.rows.map((row) => this.mapRowToEntity(row)),
      total,
    };
  }

  async create(data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const result = await this.db.query(
      `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values,
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    const result = await this.db.query(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id],
    );
    if (result.rows.length === 0) return null;
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
