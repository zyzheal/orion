/**
 * ProcessDefinitionRepository Tests
 * Covers findById, findAll, create, update, delete
 */
import { ProcessDefinitionRepository } from '../ProcessDefinitionRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();
let repo: ProcessDefinitionRepository;

const mockRow = {
  id: 'def-1',
  tenant_id: 'test-tenant',
  name: 'Approval Flow',
  description: 'Multi-step',
  version: 1,
  entity_type: 'ticket',
  enabled: true,
  steps: [{ id: 's1', name: 'Review' }],
  transitions: [],
  created_by: 'user-1',
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

beforeEach(() => {
  jest.clearAllMocks();
  repo = new ProcessDefinitionRepository({ query: mockQuery } as any);
});

describe('ProcessDefinitionRepository', () => {
  describe('findById', () => {
    it('should return definition when found', async () => {
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 });
      const result = await repo.findById('def-1');
      expect(result?.name).toBe('Approval Flow');
      expect(result?.steps).toEqual([{ id: 's1', name: 'Review' }]);
    });

    it('should return null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.findById('missing');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should query with tenant_id and default pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockRow] });
      const result = await repo.findAll();
      expect(result.total).toBe(1);
      expect(result.rows).toHaveLength(1);
      const countSql = mockQuery.mock.calls[0][0];
      expect(countSql).toContain('tenant_id = $1');
    });

    it('should add entityType and enabled filters', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });
      await repo.findAll({ entityType: 'ticket', enabled: true });
      const countSql = mockQuery.mock.calls[0][0];
      expect(countSql).toContain('entity_type = $2');
      expect(countSql).toContain('enabled = $3');
      const params = mockQuery.mock.calls[0][1];
      expect(params).toEqual(['test-tenant', 'ticket', true]);
    });
  });

  describe('create', () => {
    it('should insert with JSON serialized steps and transitions', async () => {
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 });
      const result = await repo.create({
        name: 'Approval Flow',
        entity_type: 'ticket',
        steps: [{ id: 's1' }],
        transitions: [],
        created_by: 'user-1',
      });
      expect(result.name).toBe('Approval Flow');
      const params = mockQuery.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant');
      expect(params[4]).toBe(JSON.stringify([{ id: 's1' }]));
      expect(params[5]).toBe(JSON.stringify([]));
      expect(params[6]).toBe(true); // default enabled
    });
  });

  describe('update', () => {
    it('should build dynamic SET clauses', async () => {
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 });
      await repo.update('def-1', { name: 'Updated', enabled: false });
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('name = $1');
      expect(sql).toContain('enabled = $2');
      expect(sql).toContain('updated_at = NOW()');
    });

    it('should return existing when no fields provided', async () => {
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 });
      const result = await repo.update('def-1', {});
      expect(result?.name).toBe('Approval Flow');
      // Should call findById, not UPDATE
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT');
    });

    it('should return null when not found after update', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.update('def-1', { name: 'x' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return true when rows deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      expect(await repo.delete('def-1')).toBe(true);
    });

    it('should return false when not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });
      expect(await repo.delete('missing')).toBe(false);
    });
  });
});
