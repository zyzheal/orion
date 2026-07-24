/**
 * InceptionService 单元测试
 *
 * 测试 SQL 审计服务的输入验证和 SQL 分类逻辑。
 */

import { describe, it, expect } from '@jest/globals';

// SQL validation logic extracted from InceptionService
const DB_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
const DANGEROUS_KEYWORDS = ['DROP DATABASE', 'DROP USER', 'GRANT ALL', 'CREATE USER'];

function validateDatabaseName(db: string): string | null {
  if (!DB_NAME_REGEX.test(db)) {
    return `Invalid database name: ${db}`;
  }
  return null;
}

function checkDangerousSql(sql: string): string | null {
  const normalized = sql.toUpperCase().replace(/\s+/g, ' ').trim();
  for (const keyword of DANGEROUS_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return `Dangerous SQL operation detected: ${keyword}`;
    }
  }
  return null;
}

function classifySqlOperation(sql: string): string {
  const normalized = sql.trim().toUpperCase().replace(/\s+/g, ' ');
  if (normalized.startsWith('SELECT')) return 'read';
  if (normalized.startsWith('INSERT')) return 'write';
  if (normalized.startsWith('UPDATE')) return 'write';
  if (normalized.startsWith('DELETE')) return 'write';
  if (normalized.startsWith('CREATE TABLE')) return 'ddl';
  if (normalized.startsWith('ALTER TABLE')) return 'ddl';
  if (normalized.startsWith('DROP TABLE')) return 'ddl';
  return 'other';
}

describe('InceptionService - SQL Validation', () => {
  describe('validateDatabaseName', () => {
    it('accepts valid database names', () => {
      expect(validateDatabaseName('mydb')).toBeNull();
      expect(validateDatabaseName('test_db_1')).toBeNull();
      expect(validateDatabaseName('_leading_underscore')).toBeNull();
    });

    it('rejects invalid database names', () => {
      expect(validateDatabaseName('123db')).not.toBeNull();
      expect(validateDatabaseName('my-db')).not.toBeNull();
      expect(validateDatabaseName('my.db')).not.toBeNull();
      expect(validateDatabaseName('')).not.toBeNull();
    });

    it('rejects too long names', () => {
      const longName = 'a'.repeat(65);
      expect(validateDatabaseName(longName)).not.toBeNull();
    });

    it('accepts max length name', () => {
      const maxName = 'a'.repeat(64);
      expect(validateDatabaseName(maxName)).toBeNull();
    });
  });

  describe('checkDangerousSql', () => {
    it('detects DROP DATABASE', () => {
      expect(checkDangerousSql('DROP DATABASE mydb')).not.toBeNull();
    });

    it('detects DROP USER', () => {
      expect(checkDangerousSql('DROP USER admin')).not.toBeNull();
    });

    it('detects GRANT ALL', () => {
      expect(checkDangerousSql('GRANT ALL ON *.* TO user')).not.toBeNull();
    });

    it('detects CREATE USER', () => {
      expect(checkDangerousSql('CREATE USER test@localhost')).not.toBeNull();
    });

    it('allows safe SQL', () => {
      expect(checkDangerousSql('SELECT * FROM users')).toBeNull();
      expect(checkDangerousSql('INSERT INTO users VALUES (1)')).toBeNull();
      expect(checkDangerousSql('UPDATE users SET name = "x"')).toBeNull();
    });

    it('detects bypass attempts with extra whitespace', () => {
      expect(checkDangerousSql('DROP  \n  DATABASE mydb')).not.toBeNull();
      expect(checkDangerousSql('GRANT\t\tALL ON db')).not.toBeNull();
    });
  });

  describe('classifySqlOperation', () => {
    it('classifies read operations', () => {
      expect(classifySqlOperation('SELECT * FROM users')).toBe('read');
    });

    it('classifies write operations', () => {
      expect(classifySqlOperation('INSERT INTO users VALUES (1)')).toBe('write');
      expect(classifySqlOperation('UPDATE users SET name = "x"')).toBe('write');
      expect(classifySqlOperation('DELETE FROM users WHERE id = 1')).toBe('write');
    });

    it('classifies DDL operations', () => {
      expect(classifySqlOperation('CREATE TABLE users (id INT)')).toBe('ddl');
      expect(classifySqlOperation('ALTER TABLE users ADD COLUMN name VARCHAR(255)')).toBe('ddl');
      expect(classifySqlOperation('DROP TABLE users')).toBe('ddl');
    });

    it('handles whitespace variations', () => {
      expect(classifySqlOperation('  SELECT  1')).toBe('read');
      expect(classifySqlOperation('INSERT   INTO  x  VALUES  (1)')).toBe('write');
    });
  });
});
