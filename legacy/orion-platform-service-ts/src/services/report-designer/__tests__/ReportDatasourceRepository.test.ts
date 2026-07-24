/**
 * ReportDatasourceRepository Tests
 */
import { ReportDatasourceRepository } from '../ReportDatasourceRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();
let repo: ReportDatasourceRepository;

beforeEach(() => {
  jest.clearAllMocks();
  repo = new ReportDatasourceRepository({ query: mockQuery });
});

describe('ReportDatasourceRepository', () => {
  describe('list', () => {
    it('should query with tenant_id', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.list();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['test-tenant'],
      );
    });
  });

  describe('getById', () => {
    it('should return entity when found', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'ds-1', tenant_id: 'test-tenant', name: 'PG', datasource_type: 'postgresql', config: {}, refresh_interval: null, created_at: new Date(), updated_at: new Date() }],
        rowCount: 1,
      });
      const result = await repo.getById('ds-1');
      expect(result?.id).toBe('ds-1');
      expect(result?.datasourceType).toBe('postgresql');
    });

    it('should return undefined when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.getById('missing');
      expect(result).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should insert and return entity', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'ds-1', tenant_id: 'test-tenant', name: 'PG', datasource_type: 'postgresql', config: {}, refresh_interval: 60, created_at: new Date(), updated_at: new Date() }],
        rowCount: 1,
      });
      const result = await repo.create({ name: 'PG', datasourceType: 'postgresql', config: { host: 'localhost' }, refreshInterval: 60 });
      expect(result.name).toBe('PG');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining(['test-tenant', 'PG', 'postgresql']),
      );
    });
  });

  describe('testConnection', () => {
    it('should return success for valid postgresql config', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'ds-1', datasource_type: 'postgresql', config: { host: 'localhost', port: 5432, database: 'test' } }],
        rowCount: 1,
      });
      const result = await repo.testConnection('ds-1');
      expect(result.success).toBe(true);
    });

    it('should return failure for missing required fields', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'ds-1', datasource_type: 'postgresql', config: { host: 'localhost' } }],
        rowCount: 1,
      });
      const result = await repo.testConnection('ds-1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing required fields');
    });

    it('should return failure for not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.testConnection('missing');
      expect(result.success).toBe(false);
    });
  });

  describe('mapRowToEntity', () => {
    it('should map snake_case to camelCase', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'ds-1', tenant_id: 't-1', name: 'PG', datasource_type: 'api', config: { url: 'http://test' }, refresh_interval: null, created_at: new Date(), updated_at: new Date() }],
        rowCount: 1,
      });
      const result = await repo.getById('ds-1');
      expect(result?.tenantId).toBe('t-1');
      expect(result?.datasourceType).toBe('api');
    });
  });
});
