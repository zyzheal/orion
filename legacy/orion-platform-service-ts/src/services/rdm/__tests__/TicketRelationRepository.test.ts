/**
 * TicketRelationRepository Tests - Database layer for ticket relations
 * Covers query generation, parameter binding, and tenant isolation
 */

import { TicketRelationRepository, TicketRelationEntity } from '../TicketRelationRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

describe('TicketRelationRepository', () => {
  let mockPool: { query: jest.Mock };
  let repo: TicketRelationRepository;

  const mockRelation: TicketRelationEntity = {
    id: 'rel-1',
    tenant_id: 'test-tenant',
    source_ticket_id: 'ticket-1',
    target_ticket_id: 'ticket-2',
    relation_type: 'blocks',
    created_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new TicketRelationRepository(mockPool);
  });

  // ==================== getRelations ====================

  describe('getRelations', () => {
    it('should query both source and target with tenant isolation', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockRelation], rowCount: 1 });

      const result = await repo.getRelations('ticket-1');

      expect(result).toEqual([mockRelation]);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('(source_ticket_id = $1 OR target_ticket_id = $1)'),
        ['ticket-1', 'test-tenant'],
      );
    });

    it('should return empty array when no relations found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.getRelations('ticket-99');

      expect(result).toEqual([]);
    });
  });

  // ==================== addRelation ====================

  describe('addRelation', () => {
    it('should insert with tenant_id from context and return created row', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockRelation], rowCount: 1 });

      const result = await repo.addRelation({
        source_ticket_id: 'ticket-1',
        target_ticket_id: 'ticket-2',
        relation_type: 'blocks',
      });

      expect(result).toEqual(mockRelation);
      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO ticket_relation');
      expect(sql).toContain('RETURNING *');
      const params = mockPool.query.mock.calls[0][1];
      expect(params).toEqual(['test-tenant', 'ticket-1', 'ticket-2', 'blocks']);
    });
  });

  // ==================== removeRelation ====================

  describe('removeRelation', () => {
    it('should return true when a row is deleted', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const result = await repo.removeRelation('rel-1');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM ticket_relation WHERE id = $1 AND tenant_id = $2',
        ['rel-1', 'test-tenant'],
      );
    });

    it('should return false when no row is deleted', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.removeRelation('nonexistent');

      expect(result).toBe(false);
    });
  });

  // ==================== getRelated ====================

  describe('getRelated', () => {
    it('should query without relation_type filter by default', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockRelation], rowCount: 1 });

      const result = await repo.getRelated('ticket-1');

      expect(result).toEqual([mockRelation]);
      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).not.toContain('relation_type = $3');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['ticket-1', 'test-tenant'],
      );
    });

    it('should append relation_type filter when provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockRelation], rowCount: 1 });

      const result = await repo.getRelated('ticket-1', 'blocks');

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('AND relation_type = $3');
      const params = mockPool.query.mock.calls[0][1];
      expect(params).toEqual(['ticket-1', 'test-tenant', 'blocks']);
    });
  });

  // ==================== Tenant Isolation ====================

  describe('tenant isolation', () => {
    it('should always pass tenant_id as a query parameter', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.getRelations('t-1');
      await repo.addRelation({ source_ticket_id: 't-1', target_ticket_id: 't-2', relation_type: 'relates' });
      await repo.removeRelation('r-1');
      await repo.getRelated('t-1');

      // Every call should include 'test-tenant' in its params
      for (const call of mockPool.query.mock.calls) {
        expect(call[1]).toContain('test-tenant');
      }
    });
  });
});
