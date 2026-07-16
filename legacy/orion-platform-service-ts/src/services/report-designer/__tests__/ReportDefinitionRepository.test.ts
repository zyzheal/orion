/**
 * ReportDefinitionRepository Tests
 * Covers list/getById/create/updateById/deleteById/getByCategory and mapRowToEntity
 */
import { ReportDefinitionRepository } from '../ReportDefinitionRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();
let repo: ReportDefinitionRepository;

const snakeRow = {
  id: 'rpt-1',
  tenant_id: 'test-tenant',
  name: 'Sales Report',
  description: 'Monthly',
  category: 'sales',
  layout: { type: 'grid' },
  components: [{ id: 'c1' }],
  datasource_bindings: { ds: 'pg' },
  template_id: 'tpl-1',
  enabled: true,
  created_by: 'user-1',
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-02'),
};

beforeEach(() => {
  jest.clearAllMocks();
  repo = new ReportDefinitionRepository({ query: mockQuery });
});

describe('ReportDefinitionRepository', () => {
  describe('list', () => {
    it('should query with tenant_id and default pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });
      await repo.list();
      const countSql = mockQuery.mock.calls[0][0];
      expect(countSql).toContain('tenant_id = $1');
      expect(countSql).toContain('COUNT(*)');
      // params is mutated by reference after push(limit, offset)
      const dataSql = mockQuery.mock.calls[1][0];
      expect(dataSql).toContain('LIMIT $2 OFFSET $3');
    });

    it('should add category/enabled/keyword filters', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [snakeRow] });
      const result = await repo.list({ category: 'sales', enabled: true, keyword: 'Sales' });
      expect(result.entities).toHaveLength(1);
      const countSql = mockQuery.mock.calls[0][0];
      expect(countSql).toContain('category = $2');
      expect(countSql).toContain('enabled = $3');
      expect(countSql).toContain('ILIKE $4');
    });
  });

  describe('getById', () => {
    it('should return entity when found', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });
      const result = await repo.getById('rpt-1');
      expect(result?.name).toBe('Sales Report');
      expect(result?.tenantId).toBe('test-tenant');
      expect(result?.layout).toEqual({ type: 'grid' });
    });

    it('should return undefined when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.getById('missing');
      expect(result).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should insert with JSON serialization for layout/components', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });
      const result = await repo.create({
        name: 'Sales Report',
        description: 'Monthly',
        category: 'sales',
        layout: { type: 'grid' },
        components: [{ id: 'c1' }],
        datasourceBindings: { ds: 'pg' },
        templateId: 'tpl-1',
        enabled: true,
        createdBy: 'user-1',
      });
      expect(result.name).toBe('Sales Report');
      const params = mockQuery.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant'); // tenant_id
      expect(params[4]).toBe(JSON.stringify({ type: 'grid' })); // layout serialized
      expect(params[5]).toBe(JSON.stringify([{ id: 'c1' }])); // components serialized
    });
  });

  describe('updateById', () => {
    it('should build dynamic SET clauses', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });
      await repo.updateById('rpt-1', { name: 'Updated', enabled: false });
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('name = $1');
      expect(sql).toContain('enabled = $2');
      expect(sql).toContain('updated_at = NOW()');
      expect(sql).toContain('WHERE id = $3 AND tenant_id = $4');
    });

    it('should throw ValidationError when no fields provided', async () => {
      await expect(repo.updateById('rpt-1', {})).rejects.toThrow('No fields to update');
    });

    it('should throw NotFoundError when row not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await expect(repo.updateById('rpt-1', { name: 'x' })).rejects.toThrow('not found');
    });
  });

  describe('deleteById', () => {
    it('should return true when rows deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      const result = await repo.deleteById('rpt-1');
      expect(result).toBe(true);
    });

    it('should return false when no rows deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });
      const result = await repo.deleteById('missing');
      expect(result).toBe(false);
    });
  });

  describe('getByCategory', () => {
    it('should query by tenant and category', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow] });
      const result = await repo.getByCategory('sales');
      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('category = $2'),
        ['test-tenant', 'sales'],
      );
    });
  });

  describe('mapRowToEntity', () => {
    it('should map snake_case to camelCase', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });
      const result = await repo.getById('rpt-1');
      expect(result?.datasourceBindings).toEqual({ ds: 'pg' });
      expect(result?.templateId).toBe('tpl-1');
      expect(result?.createdBy).toBe('user-1');
    });
  });
});
