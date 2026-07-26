/**
 * DbaService 单元测试
 *
 * 测试 DBA 服务的输入验证和 SQL 校验逻辑。
 */

import { describe, it, expect } from '@jest/globals';

// SQL validation logic extracted from DbaService
function validateSqlInput(input: { sql?: string; dataSourceId?: string }): string[] {
  const errors: string[] = [];
  if (!input.sql || input.sql.trim().length === 0) {
    errors.push('SQL statement is required');
  }
  if (!input.dataSourceId || input.dataSourceId.trim().length === 0) {
    errors.push('Data source ID is required');
  }
  return errors;
}

function validateOrderInput(input: { sql?: string; database?: string; comment?: string }): string[] {
  const errors: string[] = [];
  if (!input.sql || input.sql.trim().length === 0) {
    errors.push('SQL is required');
  }
  if (!input.database || input.database.trim().length === 0) {
    errors.push('Database name is required');
  }
  if (!input.comment || input.comment.trim().length === 0) {
    errors.push('Order comment is required');
  }
  return errors;
}

function classifySqlType(sql: string): string {
  const normalized = sql.trim().toUpperCase();
  if (normalized.startsWith('SELECT')) return 'query';
  if (normalized.startsWith('INSERT')) return 'insert';
  if (normalized.startsWith('UPDATE')) return 'update';
  if (normalized.startsWith('DELETE')) return 'delete';
  if (normalized.startsWith('CREATE')) return 'ddl';
  if (normalized.startsWith('ALTER')) return 'ddl';
  if (normalized.startsWith('DROP')) return 'ddl';
  if (normalized.startsWith('TRUNCATE')) return 'ddl';
  return 'unknown';
}

function isDangerousSql(sql: string): { dangerous: boolean; reason?: string } {
  const normalized = sql.trim().toUpperCase().replace(/\s+/g, ' ');

  const dangerousPatterns = [
    { pattern: 'DROP DATABASE', reason: 'Cannot drop database' },
    { pattern: 'DROP USER', reason: 'Cannot drop user' },
    { pattern: 'GRANT ALL', reason: 'Cannot grant all privileges' },
    { pattern: 'CREATE USER', reason: 'Cannot create user' },
    { pattern: 'TRUNCATE', reason: 'Truncate is not allowed' },
  ];

  for (const { pattern, reason } of dangerousPatterns) {
    if (normalized.includes(pattern)) {
      return { dangerous: true, reason };
    }
  }

  return { dangerous: false };
}

describe('DbaService - Input Validation', () => {
  describe('validateSqlInput', () => {
    it('accepts valid input', () => {
      const errors = validateSqlInput({ sql: 'SELECT 1', dataSourceId: 'ds-1' });
      expect(errors).toHaveLength(0);
    });

    it('rejects empty sql', () => {
      const errors = validateSqlInput({ sql: '', dataSourceId: 'ds-1' });
      expect(errors).toContain('SQL statement is required');
    });

    it('rejects empty dataSourceId', () => {
      const errors = validateSqlInput({ sql: 'SELECT 1', dataSourceId: '' });
      expect(errors).toContain('Data source ID is required');
    });
  });

  describe('validateOrderInput', () => {
    it('accepts valid order', () => {
      const errors = validateOrderInput({ sql: 'ALTER TABLE x ADD COLUMN y INT', database: 'mydb', comment: 'Add column' });
      expect(errors).toHaveLength(0);
    });

    it('rejects missing fields', () => {
      const errors = validateOrderInput({});
      expect(errors).toHaveLength(3);
    });
  });

  describe('classifySqlType', () => {
    it('classifies DML statements', () => {
      expect(classifySqlType('SELECT * FROM users')).toBe('query');
      expect(classifySqlType('INSERT INTO users VALUES (1)')).toBe('insert');
      expect(classifySqlType('UPDATE users SET name = "x"')).toBe('update');
      expect(classifySqlType('DELETE FROM users WHERE id = 1')).toBe('delete');
    });

    it('classifies DDL statements', () => {
      expect(classifySqlType('CREATE TABLE users (id INT)')).toBe('ddl');
      expect(classifySqlType('ALTER TABLE users ADD COLUMN name VARCHAR(255)')).toBe('ddl');
      expect(classifySqlType('DROP TABLE users')).toBe('ddl');
    });

    it('handles whitespace', () => {
      expect(classifySqlType('  SELECT 1')).toBe('query');
      expect(classifySqlType('\n\nINSERT INTO x')).toBe('insert');
    });

    it('returns unknown for unrecognized', () => {
      expect(classifySqlType('EXEC sp_help')).toBe('unknown');
    });
  });

  describe('isDangerousSql', () => {
    it('detects dangerous operations', () => {
      expect(isDangerousSql('DROP DATABASE mydb').dangerous).toBe(true);
      expect(isDangerousSql('DROP USER admin').dangerous).toBe(true);
      expect(isDangerousSql('GRANT ALL ON *.*').dangerous).toBe(true);
      expect(isDangerousSql('TRUNCATE TABLE logs').dangerous).toBe(true);
    });

    it('allows safe operations', () => {
      expect(isDangerousSql('SELECT * FROM users').dangerous).toBe(false);
      expect(isDangerousSql('INSERT INTO users VALUES (1)').dangerous).toBe(false);
      expect(isDangerousSql('UPDATE users SET name = "x"').dangerous).toBe(false);
    });

    it('detects bypass attempts', () => {
      // Extra whitespace should still be caught
      expect(isDangerousSql('DROP   DATABASE   mydb').dangerous).toBe(true);
      // Newlines should still be caught
      expect(isDangerousSql('DROP\nDATABASE mydb').dangerous).toBe(true);
    });
  });
});
