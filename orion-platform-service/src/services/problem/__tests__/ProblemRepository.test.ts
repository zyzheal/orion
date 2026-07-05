/**
 * Tests for ProblemRepository and KnownErrorRepository
 *
 * Unit tests for ITSM problem management and Known Error Database (KEDB)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProblemRepository, KnownErrorRepository } from '../../../repositories/ProblemRepository';

// Mock database pool
const mockPool = { query: jest.fn<any, any>() };

// ==================== ProblemRepository ====================

describe('ProblemRepository', () => {
  let repo: ProblemRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ProblemRepository(mockPool as any);
  });

  // ==================== BaseRepository: findById ====================

  describe('findById', () => {
    it('should return problem when found', async () => {
      const mockRow = {
        id: 'prob-1',
        tenant_id: 'tenant-1',
        title: 'Database connection pool exhaustion',
        description: 'DB pool exhausted during peak hours',
        status: 'open',
        severity: 'high',
        category: 'infrastructure',
        root_cause: 'Connection leak in ORM',
        workaround: 'Restart service every 4 hours',
        resolution: null,
        related_incidents: ['inc-1'],
        related_changes: ['chg-1'],
        assigned_to: 'user-1',
        created_by: 'user-2',
        resolved_at: null,
        closed_at: null,
        metadata: { priority: 1 },
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-02'),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repo.findById('prob-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('prob-1');
      expect(result!.tenantId).toBe('tenant-1');
      expect(result!.title).toBe('Database connection pool exhaustion');
      expect(result!.status).toBe('open');
      expect(result!.severity).toBe('high');
      expect(result!.relatedIncidents).toEqual(['inc-1']);
      expect(result!.relatedChanges).toEqual(['chg-1']);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM problems WHERE id = $1',
        ['prob-1']
      );
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findById('prob-nonexistent');

      expect(result).toBeUndefined();
    });
  });

  // ==================== BaseRepository: create ====================

  describe('create', () => {
    it('should create a problem and return mapped entity', async () => {
      const input = {
        id: 'prob-new',
        tenantId: 'tenant-1',
        title: 'Memory leak in worker process',
        status: 'open',
        severity: 'medium',
        assignedTo: 'user-3',
      };

      const mockRow = {
        id: 'prob-new',
        tenant_id: 'tenant-1',
        title: 'Memory leak in worker process',
        description: null,
        status: 'open',
        severity: 'medium',
        category: null,
        root_cause: null,
        workaround: null,
        resolution: null,
        related_incidents: [],
        related_changes: [],
        assigned_to: 'user-3',
        created_by: null,
        resolved_at: null,
        closed_at: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repo.create(input);

      expect(result.id).toBe('prob-new');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.assignedTo).toBe('user-3');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO problems'),
        expect.arrayContaining(['prob-new', 'tenant-1', 'Memory leak in worker process', 'open', 'medium', 'user-3'])
      );
    });
  });

  // ==================== BaseRepository: update ====================

  describe('update', () => {
    it('should update a problem and return mapped entity', async () => {
      const mockRow = {
        id: 'prob-1',
        tenant_id: 'tenant-1',
        title: 'Updated title',
        description: null,
        status: 'open',
        severity: 'high',
        category: null,
        root_cause: null,
        workaround: null,
        resolution: null,
        related_incidents: [],
        related_changes: [],
        assigned_to: null,
        created_by: null,
        resolved_at: null,
        closed_at: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repo.update('prob-1', { title: 'Updated title' });

      expect(result.id).toBe('prob-1');
      expect(result.title).toBe('Updated title');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE problems SET'),
        expect.arrayContaining(['Updated title', 'prob-1'])
      );
    });

    it('should throw when update affects no rows', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(repo.update('prob-nonexistent', { title: 'x' })).rejects.toThrow();
    });
  });

  // ==================== BaseRepository: delete ====================

  describe('delete', () => {
    it('should return true when delete succeeds', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await repo.delete('prob-1');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM problems WHERE id = $1',
        ['prob-1']
      );
    });

    it('should return false when no rows deleted', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.delete('prob-nonexistent');

      expect(result).toBe(false);
    });
  });

  // ==================== findByTenant ====================

  describe('findByTenant', () => {
    it('should return problems with default pagination', async () => {
      const mockRows = [
        { id: 'prob-1', tenant_id: 'tenant-1', title: 'Problem A', status: 'open', severity: 'high', related_incidents: [], related_changes: [], metadata: {}, created_at: new Date(), updated_at: new Date() },
        { id: 'prob-2', tenant_id: 'tenant-1', title: 'Problem B', status: 'resolved', severity: 'low', related_incidents: [], related_changes: [], metadata: {}, created_at: new Date(), updated_at: new Date() },
      ];

      // First call = count query, second call = data query
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: mockRows, rowCount: 2 });

      const result = await repo.findByTenant('tenant-1');

      expect(result.total).toBe(2);
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].tenantId).toBe('tenant-1');
      // Count query SQL
      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('SELECT COUNT(*)'),
        expect.arrayContaining(['tenant-1'])
      );
      // Data query has LIMIT/OFFSET with default values
      expect(mockPool.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('LIMIT'),
        expect.arrayContaining(['tenant-1', 20, 0])
      );
    });

    it('should filter by status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'prob-1', tenant_id: 't1', status: 'open', related_incidents: [], related_changes: [], metadata: {} }], rowCount: 1 });

      const result = await repo.findByTenant('tenant-1', { status: 'open' });

      expect(result.entities).toHaveLength(1);
      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('status = $2'),
        expect.arrayContaining(['tenant-1', 'open'])
      );
    });

    it('should filter by severity', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { severity: 'critical' });

      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('severity = $2'),
        expect.arrayContaining(['tenant-1', 'critical'])
      );
    });

    it('should filter by assignedTo', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { assignedTo: 'user-1' });

      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('assigned_to = $2'),
        expect.arrayContaining(['tenant-1', 'user-1'])
      );
    });

    it('should filter by category', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { category: 'infrastructure' });

      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('category = $2'),
        expect.arrayContaining(['tenant-1', 'infrastructure'])
      );
    });

    it('should combine multiple filters', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', {
        status: 'open',
        severity: 'high',
        assignedTo: 'user-1',
        category: 'database',
        limit: 10,
        offset: 5,
      });

      // Count query should include all filters (params shared by reference, includes limit/offset)
      const countCall = mockPool.query.mock.calls[0];
      const countSql = countCall[0] as string;
      expect(countSql).toContain('status = $2');
      expect(countSql).toContain('severity = $3');
      expect(countSql).toContain('assigned_to = $4');
      expect(countSql).toContain('category = $5');
      expect(countCall[1]).toEqual(expect.arrayContaining(['tenant-1', 'open', 'high', 'user-1', 'database']));

      // Data query should have LIMIT and OFFSET
      const dataCall = mockPool.query.mock.calls[1];
      const dataSql = dataCall[0] as string;
      expect(dataSql).toContain('LIMIT');
      expect(dataSql).toContain('OFFSET');
      expect(dataCall[1]).toEqual(expect.arrayContaining([10, 5]));
    });

    it('should apply custom limit and offset', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { limit: 5, offset: 10 });

      const dataCall = mockPool.query.mock.calls[1];
      expect(dataCall[1]).toEqual(expect.arrayContaining([5, 10]));
    });
  });

  // ==================== findByIdAndTenant ====================

  describe('findByIdAndTenant', () => {
    it('should return problem when found by id and tenant', async () => {
      const mockRow = {
        id: 'prob-1',
        tenant_id: 'tenant-1',
        title: 'Test Problem',
        status: 'open',
        severity: 'medium',
        related_incidents: [],
        related_changes: [],
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repo.findByIdAndTenant('prob-1', 'tenant-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('prob-1');
      expect(result!.tenantId).toBe('tenant-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM problems WHERE id = $1 AND tenant_id = $2',
        ['prob-1', 'tenant-1']
      );
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByIdAndTenant('prob-x', 'tenant-1');

      expect(result).toBeUndefined();
    });
  });

  // ==================== updateStatus ====================

  describe('updateStatus', () => {
    it('should update status to resolved with resolved_at', async () => {
      const mockRow = {
        id: 'prob-1',
        tenant_id: 'tenant-1',
        status: 'resolved',
        resolved_at: new Date('2026-06-01'),
        closed_at: null,
        related_incidents: [],
        related_changes: [],
        metadata: {},
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repo.updateStatus('prob-1', 'resolved', 'tenant-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('resolved');
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('resolved_at = NOW()');
      expect(sql).not.toContain('closed_at = NOW()');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        ['resolved', 'prob-1', 'tenant-1']
      );
    });

    it('should update status to closed with closed_at', async () => {
      const mockRow = {
        id: 'prob-1',
        tenant_id: 'tenant-1',
        status: 'closed',
        resolved_at: new Date(),
        closed_at: new Date('2026-06-02'),
        related_incidents: [],
        related_changes: [],
        metadata: {},
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repo.updateStatus('prob-1', 'closed', 'tenant-1');

      expect(result!.status).toBe('closed');
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('closed_at = NOW()');
      expect(sql).not.toContain('resolved_at = NOW()');
    });

    it('should update status without extra timestamp fields for other statuses', async () => {
      const mockRow = {
        id: 'prob-1',
        tenant_id: 'tenant-1',
        status: 'investigating',
        resolved_at: null,
        closed_at: null,
        related_incidents: [],
        related_changes: [],
        metadata: {},
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      await repo.updateStatus('prob-1', 'investigating', 'tenant-1');

      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).not.toContain('resolved_at');
      expect(sql).not.toContain('closed_at');
      expect(sql).toContain('status = $1');
      expect(sql).toContain('updated_at = NOW()');
    });

    it('should return null when problem not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.updateStatus('prob-x', 'resolved', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  // ==================== addIncident ====================

  describe('addIncident', () => {
    it('should append incident to related_incidents JSONB array', async () => {
      const mockRow = {
        id: 'prob-1',
        tenant_id: 'tenant-1',
        status: 'open',
        severity: 'high',
        related_incidents: ['inc-1', 'inc-2'],
        related_changes: [],
        metadata: {},
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repo.addIncident('prob-1', 'inc-2', 'tenant-1');

      expect(result).toBeDefined();
      expect(result!.relatedIncidents).toEqual(['inc-1', 'inc-2']);
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('related_incidents');
      expect(sql).toContain('jsonb');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        ['"inc-2"', 'prob-1', 'tenant-1']
      );
    });

    it('should return null when problem not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.addIncident('prob-x', 'inc-1', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  // ==================== addChange ====================

  describe('addChange', () => {
    it('should append change to related_changes JSONB array', async () => {
      const mockRow = {
        id: 'prob-1',
        tenant_id: 'tenant-1',
        status: 'open',
        severity: 'high',
        related_incidents: [],
        related_changes: ['chg-1'],
        metadata: {},
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repo.addChange('prob-1', 'chg-1', 'tenant-1');

      expect(result).toBeDefined();
      expect(result!.relatedChanges).toEqual(['chg-1']);
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('related_changes');
      expect(sql).toContain('jsonb');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        ['"chg-1"', 'prob-1', 'tenant-1']
      );
    });

    it('should return null when problem not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.addChange('prob-x', 'chg-1', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return aggregated statistics', async () => {
      // 3 queries: total, byStatus, bySeverity
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '15' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [
            { status: 'open', count: '5' },
            { status: 'resolved', count: '7' },
            { status: 'closed', count: '3' },
          ],
          rowCount: 3,
        })
        .mockResolvedValueOnce({
          rows: [
            { severity: 'high', count: '4' },
            { severity: 'medium', count: '8' },
            { severity: 'low', count: '3' },
          ],
          rowCount: 3,
        });

      const result = await repo.getStats('tenant-1');

      expect(result.total).toBe(15);
      expect(result.byStatus).toEqual({ open: 5, resolved: 7, closed: 3 });
      expect(result.bySeverity).toEqual({ high: 4, medium: 8, low: 3 });

      // Verify all 3 queries filter by tenant
      for (const call of mockPool.query.mock.calls) {
        expect(call[1]).toEqual(['tenant-1']);
      }
    });

    it('should return zero stats when no problems exist', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.getStats('tenant-1');

      expect(result.total).toBe(0);
      expect(result.byStatus).toEqual({});
      expect(result.bySeverity).toEqual({});
    });
  });

  // ==================== mapRowToEntity field mapping ====================

  describe('mapRowToEntity', () => {
    it('should map snake_case row to camelCase entity', async () => {
      const now = new Date();
      const mockRow = {
        id: 'prob-1',
        tenant_id: 'tenant-1',
        title: 'Test',
        description: 'Desc',
        status: 'open',
        severity: 'critical',
        category: 'database',
        root_cause: 'Lock contention',
        workaround: 'Restart',
        resolution: null,
        related_incidents: ['inc-1'],
        related_changes: ['chg-1'],
        assigned_to: 'user-1',
        created_by: 'user-2',
        resolved_at: null,
        closed_at: null,
        metadata: { key: 'value' },
        created_at: now,
        updated_at: now,
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repo.findById('prob-1');

      expect(result).toEqual({
        id: 'prob-1',
        tenantId: 'tenant-1',
        title: 'Test',
        description: 'Desc',
        status: 'open',
        severity: 'critical',
        category: 'database',
        rootCause: 'Lock contention',
        workaround: 'Restart',
        resolution: null,
        relatedIncidents: ['inc-1'],
        relatedChanges: ['chg-1'],
        assignedTo: 'user-1',
        createdBy: 'user-2',
        resolvedAt: null,
        closedAt: null,
        metadata: { key: 'value' },
        createdAt: now,
        updatedAt: now,
      });
    });

    it('should default null related_incidents and related_changes to empty arrays', async () => {
      const mockRow = {
        id: 'prob-2',
        tenant_id: 't1',
        title: 'Test',
        status: 'open',
        severity: 'low',
        related_incidents: null,
        related_changes: null,
        metadata: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repo.findById('prob-2');

      expect(result!.relatedIncidents).toEqual([]);
      expect(result!.relatedChanges).toEqual([]);
      expect(result!.metadata).toEqual({});
    });
  });
});

// ==================== KnownErrorRepository ====================

describe('KnownErrorRepository', () => {
  let repo: KnownErrorRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new KnownErrorRepository(mockPool as any);
  });

  const mockKERow = (overrides: Record<string, any> = {}) => ({
    id: 'ke-1',
    tenant_id: 'tenant-1',
    problem_id: 'prob-1',
    title: 'Connection pool exhaustion workaround',
    symptoms: 'HTTP 503 errors, database timeouts',
    root_cause: 'ORM connection leak under concurrent load',
    workaround: 'Set max_connections=100 and restart daily',
    permanent_fix: 'Upgrade ORM to v3.0 with connection recycling',
    status: 'active',
    affected_services: ['api-gateway', 'auth-service'],
    keywords: ['database', 'connection', 'pool'],
    created_by: 'user-1',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-02'),
    ...overrides,
  });

  // ==================== BaseRepository: findById ====================

  describe('findById', () => {
    it('should return known error when found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockKERow()], rowCount: 1 });

      const result = await repo.findById('ke-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('ke-1');
      expect(result!.tenantId).toBe('tenant-1');
      expect(result!.symptoms).toBe('HTTP 503 errors, database timeouts');
      expect(result!.keywords).toEqual(['database', 'connection', 'pool']);
      expect(result!.affectedServices).toEqual(['api-gateway', 'auth-service']);
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findById('ke-nonexistent');

      expect(result).toBeUndefined();
    });
  });

  // ==================== BaseRepository: create ====================

  describe('create', () => {
    it('should create a known error and return mapped entity', async () => {
      const input = {
        id: 'ke-new',
        tenantId: 'tenant-1',
        title: 'New known error',
        symptoms: 'Symptom A',
        rootCause: 'Cause B',
        workaround: 'Fix C',
        status: 'active',
        keywords: ['test'],
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockKERow({ id: 'ke-new' })], rowCount: 1 });

      const result = await repo.create(input);

      expect(result.id).toBe('ke-new');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO known_errors'),
        expect.arrayContaining(['ke-new', 'tenant-1', 'New known error', 'Symptom A'])
      );
    });
  });

  // ==================== BaseRepository: update ====================

  describe('update', () => {
    it('should update a known error', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockKERow({ title: 'Updated' })], rowCount: 1 });

      const result = await repo.update('ke-1', { title: 'Updated' });

      expect(result.title).toBe('Updated');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE known_errors SET'),
        expect.arrayContaining(['Updated', 'ke-1'])
      );
    });
  });

  // ==================== BaseRepository: delete ====================

  describe('delete', () => {
    it('should return true when delete succeeds', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await repo.delete('ke-1');

      expect(result).toBe(true);
    });

    it('should return false when no rows deleted', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.delete('ke-nonexistent');

      expect(result).toBe(false);
    });
  });

  // ==================== findByTenant ====================

  describe('findByTenant', () => {
    it('should return known errors with default pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockKERow()], rowCount: 1 });

      const result = await repo.findByTenant('tenant-1');

      expect(result.total).toBe(1);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].tenantId).toBe('tenant-1');
      // Count query SQL
      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('SELECT COUNT(*)'),
        expect.arrayContaining(['tenant-1'])
      );
      // Data query with default limit/offset
      expect(mockPool.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('LIMIT'),
        expect.arrayContaining(['tenant-1', 20, 0])
      );
    });

    it('should filter by status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { status: 'active' });

      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('status = $2'),
        expect.arrayContaining(['tenant-1', 'active'])
      );
    });

    it('should filter by problemId', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { problemId: 'prob-1' });

      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('problem_id = $2'),
        expect.arrayContaining(['tenant-1', 'prob-1'])
      );
    });

    it('should combine status and problemId filters', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { status: 'active', problemId: 'prob-1' });

      const countSql = mockPool.query.mock.calls[0][0] as string;
      expect(countSql).toContain('status = $2');
      expect(countSql).toContain('problem_id = $3');
      expect(mockPool.query.mock.calls[0][1]).toEqual(expect.arrayContaining(['tenant-1', 'active', 'prob-1']));
    });

    it('should apply custom limit and offset', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { limit: 5, offset: 10 });

      const dataCall = mockPool.query.mock.calls[1];
      expect(dataCall[1]).toEqual(expect.arrayContaining([5, 10]));
    });
  });

  // ==================== findByIdAndTenant ====================

  describe('findByIdAndTenant', () => {
    it('should return known error when found by id and tenant', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockKERow()], rowCount: 1 });

      const result = await repo.findByIdAndTenant('ke-1', 'tenant-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('ke-1');
      expect(result!.tenantId).toBe('tenant-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM known_errors WHERE id = $1 AND tenant_id = $2',
        ['ke-1', 'tenant-1']
      );
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByIdAndTenant('ke-x', 'tenant-1');

      expect(result).toBeUndefined();
    });
  });

  // ==================== search ====================

  describe('search', () => {
    it('should search across symptoms, root_cause, workaround, and title with ILIKE', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockKERow()], rowCount: 1 });

      const result = await repo.search('tenant-1', 'timeout');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ke-1');

      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('ILIKE');
      expect(sql).toContain('symptoms');
      expect(sql).toContain('root_cause');
      expect(sql).toContain('workaround');
      expect(sql).toContain('title');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        ['tenant-1', '%timeout%']
      );
    });

    it('should return empty array when no matches', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.search('tenant-1', 'nonexistent');

      expect(result).toEqual([]);
    });

    it('should limit results to 50', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.search('tenant-1', 'test');

      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('LIMIT 50');
    });
  });

  // ==================== findByKeywords ====================

  describe('findByKeywords', () => {
    it('should search using PostgreSQL array overlap operator', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockKERow()], rowCount: 1 });

      const result = await repo.findByKeywords('tenant-1', ['database', 'connection']);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ke-1');

      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('&&');
      expect(sql).toContain('$2');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        ['tenant-1', ['database', 'connection']]
      );
    });

    it('should return empty array when no keyword matches', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByKeywords('tenant-1', ['nonexistent']);

      expect(result).toEqual([]);
    });

    it('should limit results to 50', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByKeywords('tenant-1', ['test']);

      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('LIMIT 50');
    });
  });

  // ==================== mapRowToEntity field mapping ====================

  describe('mapRowToEntity', () => {
    it('should map snake_case row to camelCase entity', async () => {
      const now = new Date();
      const row = {
        id: 'ke-1',
        tenant_id: 'tenant-1',
        problem_id: 'prob-1',
        title: 'Test KE',
        symptoms: 'Symptom text',
        root_cause: 'Root cause text',
        workaround: 'Workaround text',
        permanent_fix: 'Permanent fix text',
        status: 'active',
        affected_services: ['svc-1'],
        keywords: ['kw1', 'kw2'],
        created_by: 'user-1',
        created_at: now,
        updated_at: now,
      };

      mockPool.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const result = await repo.findById('ke-1');

      expect(result).toEqual({
        id: 'ke-1',
        tenantId: 'tenant-1',
        problemId: 'prob-1',
        title: 'Test KE',
        symptoms: 'Symptom text',
        rootCause: 'Root cause text',
        workaround: 'Workaround text',
        permanentFix: 'Permanent fix text',
        status: 'active',
        affectedServices: ['svc-1'],
        keywords: ['kw1', 'kw2'],
        createdBy: 'user-1',
        createdAt: now,
        updatedAt: now,
      });
    });

    it('should default null arrays to empty arrays', async () => {
      const row = {
        id: 'ke-2',
        tenant_id: 't1',
        problem_id: null,
        title: 'Test',
        symptoms: '',
        root_cause: '',
        workaround: '',
        permanent_fix: null,
        status: 'draft',
        affected_services: null,
        keywords: null,
        created_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const result = await repo.findById('ke-2');

      expect(result!.affectedServices).toEqual([]);
      expect(result!.keywords).toEqual([]);
      expect(result!.problemId).toBeNull();
      expect(result!.permanentFix).toBeNull();
    });
  });
});
