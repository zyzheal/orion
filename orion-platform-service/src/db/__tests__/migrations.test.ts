import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Migration files', () => {
  const migrationsDir = join(__dirname, '..', 'migrations');

  test('all migration files should have rollback statements', () => {
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql') && !f.includes('rollback'));

    for (const file of files) {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      expect(content).toMatch(/-- Rollback:/i);
      expect(content).toMatch(/DROP TABLE/i);
    }
  });

  test('all migration files should use gen_random_uuid() for IDs', () => {
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql') && !f.includes('rollback'));

    for (const file of files) {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      const tableBlocks = content.match(/CREATE TABLE IF NOT EXISTS \w+ \([^;]+\);/gs);
      if (!tableBlocks) continue;

      for (const block of tableBlocks) {
        if (block.includes('UUID PRIMARY KEY')) {
          expect(block).toMatch(/DEFAULT gen_random_uuid\(\)/);
        }
      }
    }
  });

  test('all migration files should have proper indexes', () => {
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql') && !f.includes('rollback'));

    for (const file of files) {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      const tableNames = content.match(/CREATE TABLE IF NOT EXISTS (\w+)/g);
      if (!tableNames) continue;

      for (const tableNameMatch of tableNames) {
        const tableName = tableNameMatch.replace('CREATE TABLE IF NOT EXISTS ', '');
        expect(content).toMatch(new RegExp(`CREATE INDEX.*ON ${tableName}\\(`, 'i'));
      }
    }
  });
});
