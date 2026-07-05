/**
 * VersionArchiveRepository Tests
 */
import { VersionArchiveRepository } from '../VersionArchiveRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();
let repo: VersionArchiveRepository;

beforeEach(() => {
  jest.clearAllMocks();
  repo = new VersionArchiveRepository({ query: mockQuery });
});

describe('VersionArchiveRepository', () => {
  describe('findByResource', () => {
    it('should query by resource type and id', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.findByResource('pipeline', 'p-1', 10);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('resource_type = $1 AND resource_id = $2'),
        ['pipeline', 'p-1', 10],
      );
    });
  });

  describe('findByVersion', () => {
    it('should find specific version', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'v-1', tenant_id: 't-1', resource_type: 'pipeline', resource_id: 'p-1',
          version: '1.0.0', snapshot: '{"name":"test"}', archived_by: 'admin',
          reason: 'manual', created_at: new Date(), updated_at: new Date(),
        }],
        rowCount: 1,
      });
      const result = await repo.findByVersion('pipeline', 'p-1', '1.0.0');
      expect(result?.version).toBe('1.0.0');
      expect(result?.snapshot).toEqual({ name: 'test' });
    });

    it('should return undefined when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.findByVersion('pipeline', 'p-1', '99.0.0');
      expect(result).toBeUndefined();
    });
  });

  describe('getLatestVersion', () => {
    it('should return the most recent version', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'v-3', tenant_id: 't-1', resource_type: 'pipeline', resource_id: 'p-1',
          version: '3.0.0', snapshot: { name: 'latest' }, archived_by: null,
          reason: null, created_at: new Date(), updated_at: new Date(),
        }],
        rowCount: 1,
      });
      const result = await repo.getLatestVersion('pipeline', 'p-1');
      expect(result?.version).toBe('3.0.0');
    });
  });

  describe('mapRowToEntity', () => {
    it('should parse JSON snapshot strings', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'v-1', tenant_id: 't-1', resource_type: 'config', resource_id: 'c-1',
          version: '2.0', snapshot: '{"key":"value"}', archived_by: 'system',
          reason: 'auto', created_at: new Date(), updated_at: new Date(),
        }],
        rowCount: 1,
      });
      const result = await repo.findByVersion('config', 'c-1', '2.0');
      expect(result?.snapshot).toEqual({ key: 'value' });
    });

    it('should handle object snapshots directly', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'v-1', tenant_id: 't-1', resource_type: 'config', resource_id: 'c-1',
          version: '2.0', snapshot: { key: 'value' }, archived_by: 'system',
          reason: 'auto', created_at: new Date(), updated_at: new Date(),
        }],
        rowCount: 1,
      });
      const result = await repo.findByVersion('config', 'c-1', '2.0');
      expect(result?.snapshot).toEqual({ key: 'value' });
    });
  });
});
