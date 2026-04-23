import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Migration files', () => {
  const migrationsDir = join(__dirname, '..', 'migrations');

  // Only validate the new Phase 0 migrations (034+)
  const newMigrations = readdirSync(migrationsDir).filter(f => {
    const num = parseInt(f.substring(0, 3), 10);
    return f.endsWith('.sql') && !f.includes('rollback') && num >= 34;
  });

  test('all new migration files should have rollback statements', () => {
    for (const file of newMigrations) {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      expect(content).toMatch(/-- Rollback:/i);
      // ALTER TABLE migrations use DROP INDEX/CONSTRAINT/COLUMN instead of DROP TABLE
      expect(content).toMatch(/DROP (TABLE|INDEX|COLUMN|CONSTRAINT) IF EXISTS/i);
    }
  });

  test('all new migration files should use gen_random_uuid() for IDs', () => {
    for (const file of newMigrations) {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      const noComments = content.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
      const tableBlocks = noComments.match(/CREATE TABLE IF NOT EXISTS \w+ \([^;]+\);/gs);
      if (!tableBlocks) continue;

      for (const block of tableBlocks) {
        if (block.includes('UUID PRIMARY KEY')) {
          expect(block).toMatch(/DEFAULT gen_random_uuid\(\)/);
        }
      }
    }
  });

  test('all new migration files should have proper indexes', () => {
    for (const file of newMigrations) {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      const noComments = content.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
      const tableNames = noComments.match(/CREATE TABLE IF NOT EXISTS (\w+)/g);
      if (!tableNames) continue;

      for (const tableNameMatch of tableNames) {
        const tableName = tableNameMatch.replace('CREATE TABLE IF NOT EXISTS ', '');
        expect(noComments).toMatch(new RegExp(`CREATE (UNIQUE )?INDEX.*ON ${tableName}\\(`, 'i'));
      }
    }
  });
});
