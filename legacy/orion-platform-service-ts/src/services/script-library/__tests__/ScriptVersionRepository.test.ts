/**
 * ScriptVersionRepository Tests - Database layer for script versions
 * Covers BaseRepository extension, custom query methods, and mapRowToEntity
 */

import { ScriptVersionRepository, ScriptVersionEntity } from '../ScriptVersionRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

describe('ScriptVersionRepository', () => {
  let mockDb: { query: jest.Mock };
  let repo: ScriptVersionRepository;

  const snakeRow = {
    id: 'sv-1',
    tenant_id: 'test-tenant',
    script_id: 'script-1',
    version: 3,
    content: 'echo hello',
    changelog: 'Added greeting',
    checksum: 'abc123',
    created_by: 'user-1',
    created_at: new Date('2026-01-01'),
  };

  const expectedEntity: ScriptVersionEntity = {
    id: 'sv-1',
    tenantId: 'test-tenant',
    scriptId: 'script-1',
    version: 3,
    content: 'echo hello',
    changelog: 'Added greeting',
    checksum: 'abc123',
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ScriptVersionRepository(mockDb as any);
  });

  // ==================== mapRowToEntity ====================

  describe('mapRowToEntity', () => {
    it('should convert snake_case row to camelCase entity', () => {
      const entity = (repo as any).mapRowToEntity(snakeRow);

      expect(entity).toEqual(expectedEntity);
      expect(entity.tenantId).toBe('test-tenant');
      expect(entity.scriptId).toBe('script-1');
      expect(entity.createdBy).toBe('user-1');
    });

    it('should apply defaults for nullable fields', () => {
      const minimalRow = {
        id: 'sv-2',
        tenant_id: 'test-tenant',
        script_id: 'script-1',
        version: 1,
        content: 'echo hi',
        changelog: null,
        checksum: 'def456',
        created_by: null,
        created_at: new Date('2026-01-01'),
      };

      const entity = (repo as any).mapRowToEntity(minimalRow);

      expect(entity.changelog).toBeNull();
      expect(entity.createdBy).toBeNull();
      // Required fields preserved
      expect(entity.checksum).toBe('def456');
      expect(entity.version).toBe(1);
    });
  });

  // ==================== findByScriptId ====================

  describe('findByScriptId', () => {
    it('should query by script_id and tenant_id, ordered by version DESC', async () => {
      const row2 = { ...snakeRow, version: 2, id: 'sv-2' };
      mockDb.query.mockResolvedValue({ rows: [snakeRow, row2], rowCount: 2 });

      const result = await repo.findByScriptId('script-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expectedEntity);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM script_version WHERE script_id = $1 AND tenant_id = $2 ORDER BY version DESC',
        ['script-1', 'test-tenant'],
      );
    });

    it('should return empty array when no versions found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findByScriptId('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ==================== findByScriptAndVersion ====================

  describe('findByScriptAndVersion', () => {
    it('should query by script_id, version, and tenant_id', async () => {
      mockDb.query.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });

      const result = await repo.findByScriptAndVersion('script-1', 3);

      expect(result).toEqual(expectedEntity);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM script_version WHERE script_id = $1 AND version = $2 AND tenant_id = $3',
        ['script-1', 3, 'test-tenant'],
      );
    });

    it('should return undefined when no matching version found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findByScriptAndVersion('script-1', 999);

      expect(result).toBeUndefined();
    });
  });

  // ==================== findLatest ====================

  describe('findLatest', () => {
    it('should query with ORDER BY version DESC LIMIT 1', async () => {
      mockDb.query.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });

      const result = await repo.findLatest('script-1');

      expect(result).toEqual(expectedEntity);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM script_version WHERE script_id = $1 AND tenant_id = $2 ORDER BY version DESC LIMIT 1',
        ['script-1', 'test-tenant'],
      );
    });

    it('should return undefined when script has no versions', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findLatest('empty-script');

      expect(result).toBeUndefined();
    });
  });

  // ==================== Tenant Isolation ====================

  describe('tenant isolation', () => {
    it('should always pass tenant_id from context as a query parameter', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findByScriptId('s-1');
      await repo.findByScriptAndVersion('s-1', 1);
      await repo.findLatest('s-1');

      for (const call of mockDb.query.mock.calls) {
        expect(call[1]).toContain('test-tenant');
      }
    });
  });
});
