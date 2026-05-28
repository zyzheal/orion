import { OrionError } from '../errors';
// Valid SQL identifier pattern (alphanumeric + underscore, not starting with digit)
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateIdentifier(name: string, label: string): void {
  if (!VALID_IDENTIFIER.test(name)) {
    throw new OrionError('VALIDATION_ERROR', `Invalid ${label}: ${name}`)
  }
}

export type QueryParamValue = string | number | boolean | null | Date | Buffer;

export interface QueryResult {
  sql: string;
  params: QueryParamValue[];
}

export class QueryBuilder {
  private table: string;
  private type: 'select' | 'insert' | 'update' | 'delete' | 'count' = 'select';
  private columns: string[] = ['*'];
  private whereClauses: { column: string; value: any }[] = [];
  private insertData: Record<string, any> = {};
  private updateData: Record<string, any> = {};
  private orderByClauses: { column: string; direction: 'ASC' | 'DESC' }[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private returningClause?: string;

  constructor(tableName: string) {
    validateIdentifier(tableName, 'table name');
    this.table = tableName;
  }

  select(columns: string[] = ['*']): this {
    this.type = 'select';
    this.columns = columns;
    return this;
  }

  count(): this {
    this.type = 'count';
    return this;
  }

  insert(data: Record<string, any>): this {
    this.type = 'insert';
    this.insertData = data;
    return this;
  }

  update(data: Record<string, any>): this {
    this.type = 'update';
    this.updateData = data;
    return this;
  }

  delete(): this {
    this.type = 'delete';
    return this;
  }

  where(conditions: Record<string, any>): this {
    for (const [column, value] of Object.entries(conditions)) {
      validateIdentifier(column, 'column name');
      if (value !== undefined && value !== null) {
        this.whereClauses.push({ column, value });
      }
    }
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    validateIdentifier(column, 'order column');
    this.orderByClauses.push({ column, direction });
    return this;
  }

  limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  offset(offset: number): this {
    this.offsetValue = offset;
    return this;
  }

  returning(columns: string | string[]): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    for (const col of cols) {
      if (col !== '*') validateIdentifier(col, 'returning column');
    }
    this.returningClause = cols.join(', ');
    return this;
  }

  build(): QueryResult {
    const params: QueryParamValue[] = [];
    let sql = '';

    switch (this.type) {
      case 'select': {
        for (const col of this.columns) {
          if (col !== '*') validateIdentifier(col, 'select column');
        }
        sql = `SELECT ${this.columns.join(', ')} FROM ${this.table}`;
        break;
      }
      case 'count': {
        sql = `SELECT COUNT(*) as count FROM ${this.table}`;
        break;
      }
      case 'insert': {
        const cols = Object.keys(this.insertData);
        for (const col of cols) validateIdentifier(col, 'insert column');
        const values = Object.values(this.insertData);
        const phs = cols.map((_, i) => `$${i + 1}`).join(', ');
        sql = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${phs})`;
        params.push(...values);
        break;
      }
      case 'update': {
        const cols = Object.keys(this.updateData);
        for (const col of cols) validateIdentifier(col, 'update column');
        const vals = Object.values(this.updateData);
        const setClause = cols.map((col, i) => `${col} = $${i + 1}`).join(', ');
        sql = `UPDATE ${this.table} SET ${setClause}`;
        params.push(...vals);
        break;
      }
      case 'delete': {
        sql = `DELETE FROM ${this.table}`;
        break;
      }
    }

    // WHERE clause
    if (this.whereClauses.length > 0) {
      const whereParts = this.whereClauses.map((clause) => {
        const idx = params.length + 1;
        params.push(clause.value);
        return `${clause.column} = $${idx}`;
      });
      sql += ` WHERE ${whereParts.join(' AND ')}`;
    }

    // ORDER BY
    if (this.orderByClauses.length > 0) {
      const orderParts = this.orderByClauses.map(o => `${o.column} ${o.direction}`);
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    }

    // LIMIT / OFFSET
    if (this.limitValue !== undefined) {
      params.push(this.limitValue);
      sql += ` LIMIT $${params.length}`;
    }
    if (this.offsetValue !== undefined) {
      params.push(this.offsetValue);
      sql += ` OFFSET $${params.length}`;
    }

    // RETURNING
    if (this.returningClause) {
      sql += ` RETURNING ${this.returningClause}`;
    }

    return { sql, params };
  }
}
