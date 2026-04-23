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
    protected db: any,
    protected tableName: string,
  ) {}

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

    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const queryParams: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(where)) {
      if (value !== undefined && value !== null) {
        query += ` AND ${key} = $${paramIndex}`;
        queryParams.push(value);
        paramIndex++;
      }
    }

    query += ` ORDER BY ${orderBy} ${orderDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await this.db.query(query, queryParams);

    const countQuery = query.replace(/SELECT \* FROM/, 'SELECT COUNT(*) as count FROM').split(' ORDER BY ')[0];
    const countResult = await this.db.query(countQuery, queryParams.slice(0, -2));

    return {
      entities: result.rows.map((row: any) => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<T, 'id'>>): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);
    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${columns.length + 1} RETURNING *`;
    const result = await this.db.query(query, [...values, id]);
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
