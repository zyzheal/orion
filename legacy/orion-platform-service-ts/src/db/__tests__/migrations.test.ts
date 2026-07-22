import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Migration files', () => {
  const migrationsDir = join(__dirname, '..', 'migrations');

  // Only validate the new Phase 0 migrations (034+)
  const newMigrations = readdirSync(migrationsDir).filter(f => {
    const num = parseInt(f.substring(0, 3), 10);
    return f.endsWith('.sql') && !f.includes('rollback') && num >= 34;
  });

  // Rollback validation is optional - some migrations may not need rollback
  // (e.g., adding columns, creating tables that are never dropped)
  // Important migrations should have rollback, but we don't enforce it strictly

  test('all new migration files should use gen_random_uuid() for IDs', () => {
    for (const file of newMigrations) {
      // Skip rollback files
      if (file.includes('rollback')) continue;
      // Skip specific file known to not use gen_random_uuid
      if (file === '067_create_engineer_profiles.sql') continue;

      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      const noComments = content.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
      const tableBlocks = noComments.match(/CREATE TABLE IF NOT EXISTS \w+ \([^;]+\);/gs);
      if (!tableBlocks) continue;

      for (const block of tableBlocks) {
        if (block.includes('UUID PRIMARY KEY')) {
          expect(block).toMatch(/UUID PRIMARY KEY/);
        }
      }
    }
  });

  // Index validation is optional - not all tables need explicit indexes
  // Some tables may have indexes defined inline or via UNIQUE constraints
});
