/**
 * InMemoryDb - A simple in-memory database mock for testing alert services
 *
 * Supports basic SQL patterns used by BaseRepository:
 * - INSERT INTO ... VALUES ... RETURNING *
 * - SELECT * FROM ... WHERE ... ORDER BY ... LIMIT ... OFFSET ...
 * - UPDATE ... SET ... WHERE ... RETURNING *
 * - DELETE FROM ... WHERE ...
 * - SELECT COUNT(*) ...
 */

interface Table {
  rows: Map<string, Record<string, any>>;
}

export class InMemoryDb {
  private tables: Map<string, Table> = new Map();

  private getTable(name: string): Table {
    if (!this.tables.has(name)) {
      this.tables.set(name, { rows: new Map() });
    }
    return this.tables.get(name)!;
  }

  async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number | null }> {
    const normalized = text.trim().replace(/\s+/g, ' ');
    const upper = normalized.toUpperCase();

    // INSERT
    if (upper.startsWith('INSERT')) {
      return this.handleInsert(normalized, params);
    }

    // SELECT COUNT
    if (upper.startsWith('SELECT COUNT')) {
      return this.handleSelectCount(normalized, params);
    }

    // SELECT
    if (upper.startsWith('SELECT')) {
      return this.handleSelect(normalized, params);
    }

    // UPDATE
    if (upper.startsWith('UPDATE')) {
      return this.handleUpdate(normalized, params);
    }

    // DELETE
    if (upper.startsWith('DELETE')) {
      return this.handleDelete(normalized, params);
    }

    return { rows: [], rowCount: 0 };
  }

  private parseTableName(sql: string, keyword: string): string {
    const idx = sql.toUpperCase().indexOf(keyword);
    const after = sql.slice(idx + keyword.length).trim();
    const match = after.match(/^(\w+)/);
    return match ? match[1] : '';
  }

  private handleInsert(sql: string, params: any[]): { rows: any[]; rowCount: number } {
    const tableName = this.parseTableName(sql, 'INTO');
    const table = this.getTable(tableName);

    // Extract column names
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    const columns = colMatch
      ? colMatch[1].split(',').map(c => c.trim().replace(/['"]/g, ''))
      : [];

    // Build row from params
    const row: Record<string, any> = {};
    for (let i = 0; i < columns.length && i < params.length; i++) {
      row[columns[i]] = params[i];
    }

    // Ensure id exists
    if (!row.id) {
      row.id = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // Set defaults
    if (!row.created_at) row.created_at = new Date();
    if (!row.updated_at) row.updated_at = new Date();

    table.rows.set(row.id, row);
    return { rows: [row], rowCount: 1 };
  }

  private handleSelect(sql: string, params: any[]): { rows: any[]; rowCount: number | null } {
    const tableName = this.parseTableName(sql, 'FROM');
    const table = this.getTable(tableName);

    let rows = Array.from(table.rows.values());

    // Apply WHERE conditions
    const whereIdx = sql.toUpperCase().indexOf('WHERE');
    if (whereIdx >= 0) {
      const whereClause = sql.slice(whereIdx + 5);
      rows = this.applyWhere(rows, whereClause, params);
    }

    // Apply ORDER BY
    const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(\s+(ASC|DESC))?/i);
    if (orderMatch) {
      const col = orderMatch[1];
      const dir = (orderMatch[3] || 'ASC').toUpperCase();
      rows.sort((a, b) => {
        const av = a[col] ?? '';
        const bv = b[col] ?? '';
        if (av < bv) return dir === 'ASC' ? -1 : 1;
        if (av > bv) return dir === 'ASC' ? 1 : -1;
        return 0;
      });
    }

    // Apply LIMIT
    const limitMatch = sql.match(/LIMIT\s+\$(\d+)/i);
    if (limitMatch) {
      const paramIdx = parseInt(limitMatch[1], 10) - 1;
      if (paramIdx < params.length) {
        rows = rows.slice(0, Number(params[paramIdx]));
      }
    }

    // Apply OFFSET
    const offsetMatch = sql.match(/OFFSET\s+\$(\d+)/i);
    if (offsetMatch) {
      const paramIdx = parseInt(offsetMatch[1], 10) - 1;
      if (paramIdx < params.length) {
        rows = rows.slice(Number(params[paramIdx]));
      }
    }

    return { rows, rowCount: rows.length };
  }

  private handleSelectCount(sql: string, params: any[]): { rows: any[]; rowCount: number | null } {
    const tableName = this.parseTableName(sql, 'FROM');
    const table = this.getTable(tableName);

    let rows = Array.from(table.rows.values());

    // Apply WHERE
    const whereIdx = sql.toUpperCase().indexOf('WHERE');
    if (whereIdx >= 0) {
      const whereClause = sql.slice(whereIdx + 5);
      rows = this.applyWhere(rows, whereClause, params);
    }

    // Handle COUNT(*) and FILTER
    const countMatch = sql.match(/COUNT\(\*\)\s+FILTER\s+\(WHERE\s+(\w+)\s*=\s*'(\w+)'\)\s+as\s+(\w+)/gi);
    const result: Record<string, any> = { count: String(rows.length) };

    if (countMatch) {
      result.count = String(rows.length);
      for (const cm of countMatch) {
        const filterMatch = cm.match(/COUNT\(\*\)\s+FILTER\s+\(WHERE\s+(\w+)\s*=\s*'(\w+)'\)\s+as\s+(\w+)/i);
        if (filterMatch) {
          const filterCol = filterMatch[1];
          const filterVal = filterMatch[2];
          const alias = filterMatch[3];
          result[alias] = String(rows.filter(r => r[filterCol] === filterVal).length);
        }
      }
    }

    // Handle SUM
    const sumMatch = sql.match(/COALESCE\(SUM\((\w+)\),\s*0\)\s+as\s+(\w+)/i);
    if (sumMatch) {
      const sumCol = sumMatch[1];
      const alias = sumMatch[2];
      result[alias] = String(rows.reduce((sum, r) => sum + (Number(r[sumCol]) || 0), 0));
    }

    return { rows: [result], rowCount: 1 };
  }

  private handleUpdate(sql: string, params: any[]): { rows: any[]; rowCount: number } {
    const tableName = this.parseTableName(sql, 'UPDATE');
    const table = this.getTable(tableName);

    // Extract SET clause
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    if (!setMatch) return { rows: [], rowCount: 0 };

    const setClause = setMatch[1];
    const setParts = setClause.split(',').map(s => s.trim());

    // Find WHERE conditions
    const whereIdx = sql.toUpperCase().indexOf('WHERE');
    const whereClause = whereIdx >= 0 ? sql.slice(whereIdx + 5) : '';

    // Find all matching rows
    let rows = Array.from(table.rows.values());
    rows = this.applyWhere(rows, whereClause, params);

    // Apply updates
    let paramOffset = 0;
    for (const part of setParts) {
      const assignMatch = part.match(/(\w+)\s*=\s*\$(\d+)/);
      if (assignMatch) {
        const col = assignMatch[1];
        const paramIdx = parseInt(assignMatch[2], 10) - 1;
        if (paramIdx < params.length) {
          for (const row of rows) {
            row[col] = params[paramIdx];
          }
        }
      }

      // Handle NOW() calls
      const nowMatch = part.match(/(\w+)\s*=\s*NOW\(\)/i);
      if (nowMatch) {
        const col = nowMatch[1];
        for (const row of rows) {
          row[col] = new Date();
        }
      }

      // Handle CASE expressions (simplified)
      const caseMatch = part.match(/(\w+)\s*=\s*CASE/i);
      if (caseMatch) {
        const col = caseMatch[1];
        // Simplified: just set to the last param value for CASE
        for (const row of rows) {
          row[col] = params[params.length - 1];
        }
      }
    }

    // Store updated rows back
    for (const row of rows) {
      table.rows.set(row.id, row);
    }

    return { rows, rowCount: rows.length };
  }

  private handleDelete(sql: string, params: any[]): { rows: any[]; rowCount: number } {
    const tableName = this.parseTableName(sql, 'FROM');
    const table = this.getTable(tableName);

    let rows = Array.from(table.rows.values());

    // Apply WHERE
    const whereIdx = sql.toUpperCase().indexOf('WHERE');
    if (whereIdx >= 0) {
      const whereClause = sql.slice(whereIdx + 5);
      const toDelete = this.applyWhere(rows, whereClause, params);
      for (const row of toDelete) {
        table.rows.delete(row.id);
      }
      return { rows: toDelete, rowCount: toDelete.length };
    }

    return { rows: [], rowCount: 0 };
  }

  private applyWhere(rows: Record<string, any>[], whereClause: string, params: any[]): Record<string, any>[] {
    // Handle multiple AND conditions
    const conditions = whereClause.split(/\s+AND\s+/i);

    return rows.filter(row => {
      for (const cond of conditions) {
        const trimmed = cond.trim().replace(/\)$/, '').trim();

        // Handle IS NULL
        const isNullMatch = trimmed.match(/(\w+)\s+IS\s+NULL/i);
        if (isNullMatch) {
          if (row[isNullMatch[1]] !== null && row[isNullMatch[1]] !== undefined) return false;
          continue;
        }

        // Handle IS NOT NULL
        const isNotNullMatch = trimmed.match(/(\w+)\s+IS\s+NOT\s+NULL/i);
        if (isNotNullMatch) {
          if (row[isNotNullMatch[1]] === null || row[isNotNullMatch[1]] === undefined) return false;
          continue;
        }

        // Handle NOT EQUAL
        const neMatch = trimmed.match(/(\w+)\s*!=\s*'(\w+)'/);
        if (neMatch) {
          if (row[neMatch[1]] === neMatch[2]) return false;
          continue;
        }

        // Handle NOT EQUAL with param
        const neParamMatch = trimmed.match(/(\w+)\s*!=\s*\$(\d+)/);
        if (neParamMatch) {
          const paramIdx = parseInt(neParamMatch[2], 10) - 1;
          if (paramIdx < params.length && row[neParamMatch[1]] === params[paramIdx]) return false;
          continue;
        }

        // Handle = $N (parameterized)
        const paramMatch = trimmed.match(/(\w+)\s*=\s*\$(\d+)/);
        if (paramMatch) {
          const col = paramMatch[1];
          const paramIdx = parseInt(paramMatch[2], 10) - 1;
          if (paramIdx < params.length) {
            if (row[col] !== params[paramIdx]) return false;
            continue;
          }
        }

        // Handle = 'literal'
        const literalMatch = trimmed.match(/(\w+)\s*=\s*'([^']*)'/);
        if (literalMatch) {
          if (row[literalMatch[1]] !== literalMatch[2]) return false;
          continue;
        }

        // Handle = false/true
        const boolMatch = trimmed.match(/(\w+)\s*=\s*(false|true)/i);
        if (boolMatch) {
          const val = boolMatch[2].toLowerCase() === 'true';
          if (row[boolMatch[1]] !== val) return false;
          continue;
        }

        // Handle >= $N
        const gteMatch = trimmed.match(/(\w+)\s*>=\s*\$(\d+)/);
        if (gteMatch) {
          const col = gteMatch[1];
          const paramIdx = parseInt(gteMatch[2], 10) - 1;
          if (paramIdx < params.length) {
            const rowVal = row[col] instanceof Date ? row[col].getTime() : new Date(row[col]).getTime();
            const paramVal = params[paramIdx] instanceof Date ? params[paramIdx].getTime() : new Date(params[paramIdx]).getTime();
            if (rowVal < paramVal) return false;
            continue;
          }
        }

        // Handle <= $N
        const lteMatch = trimmed.match(/(\w+)\s*<=\s*\$(\d+)/);
        if (lteMatch) {
          const col = lteMatch[1];
          const paramIdx = parseInt(lteMatch[2], 10) - 1;
          if (paramIdx < params.length) {
            const rowVal = row[col] instanceof Date ? row[col].getTime() : new Date(row[col]).getTime();
            const paramVal = params[paramIdx] instanceof Date ? params[paramIdx].getTime() : new Date(params[paramIdx]).getTime();
            if (rowVal > paramVal) return false;
            continue;
          }
        }

        // Handle > $N
        const gtMatch = trimmed.match(/(\w+)\s*>\s*\$(\d+)/);
        if (gtMatch) {
          const col = gtMatch[1];
          const paramIdx = parseInt(gtMatch[2], 10) - 1;
          if (paramIdx < params.length) {
            if (Number(row[col]) <= Number(params[paramIdx])) return false;
            continue;
          }
        }

        // Handle < $N
        const ltMatch = trimmed.match(/(\w+)\s*<\s*\$(\d+)/);
        if (ltMatch) {
          const col = ltMatch[1];
          const paramIdx = parseInt(ltMatch[2], 10) - 1;
          if (paramIdx < params.length) {
            if (Number(row[col]) >= Number(params[paramIdx])) return false;
            continue;
          }
        }

        // Handle $N = ANY(column)
        const anyMatch = trimmed.match(/\$(\d+)\s*=\s*ANY\((\w+)\)/);
        if (anyMatch) {
          const paramIdx = parseInt(anyMatch[1], 10) - 1;
          const col = anyMatch[2];
          if (paramIdx < params.length) {
            const arr = row[col];
            if (!Array.isArray(arr) || !arr.includes(params[paramIdx])) return false;
            continue;
          }
        }

        // Handle jsonb_array_length
        const arrayLenMatch = trimmed.match(/jsonb_array_length\((\w+)\)\s*>=\s*\$(\d+)/);
        if (arrayLenMatch) {
          continue; // Skip array length checks for simplicity
        }

        // If we can't parse the condition, skip it (permissive)
      }
      return true;
    });
  }

  /**
   * Clear all data (for test cleanup)
   */
  clearAll(): void {
    this.tables.clear();
  }

  /**
   * Clear data for a specific table
   */
  clearTable(tableName: string): void {
    this.tables.delete(tableName);
  }
}

/**
 * Create a new InMemoryDb instance
 */
export function createInMemoryDb(): InMemoryDb {
  return new InMemoryDb();
}
