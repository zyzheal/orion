/**
 * ChangeRequestRepository Tests - Database layer for RFC (Request for Change) entities
 * Covers BaseRepository delegation, custom query methods, and mapRowToEntity
 */

import { ChangeRequestRepository, ChangeRequestEntity } from '../ChangeRequestRepository';

describe('ChangeRequestRepository', () => {
  let mockDb: { query: jest.Mock };
  let repo: ChangeRequestRepository;

  const snakeRow = {
    id: 'cr-1',
    tenant_id: 'tenant-1',
    title: 'Upgrade DB',
    description: 'Upgrade to PostgreSQL 16',
    change_type: 'standard',
    risk_level: 'medium',
    impact_scope: 'minor',
    rollback_plan: 'Restore from backup',
    scheduled_start: new Date('2026-02-01'),
    scheduled_end: new Date('2026-02-02'),
    status: 'pending_approval',
    created_by: 'user-1',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const expectedEntity: ChangeRequestEntity = {
    id: 'cr-1',
    tenantId: 'tenant-1',
    title: 'Upgrade DB',
    description: 'Upgrade to PostgreSQL 16',
    changeType: 'standard',
    riskLevel: 'medium',
    impactScope: 'minor',
    rollbackPlan: 'Restore from backup',
    scheduledStart: new Date('2026-02-01'),
    scheduledEnd: new Date('2026-02-02'),
    status: 'pending_approval',
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ChangeRequestRepository(mockDb as any);
  });

  // ==================== mapRowToEntity ====================

  describe('mapRowToEntity', () => {
    it('should convert snake_case row to camelCase entity', () => {
      // Access protected method via any cast
      const entity = (repo as any).mapRowToEntity(snakeRow);

      expect(entity).toEqual(expectedEntity);
      expect(entity.tenantId).toBe('tenant-1');
      expect(entity.changeType).toBe('standard');
      expect(entity.riskLevel).toBe('medium');
    });

    it('should apply defaults for nullable fields', () => {
      const minimalRow = {
        id: 'cr-2',
        tenant_id: 'tenant-1',
        title: 'Minimal',
        description: null,
        change_type: 'normal',
        risk_level: null,
        impact_scope: null,
        rollback_plan: null,
        scheduled_start: null,
        scheduled_end: null,
        status: null,
        created_by: null,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01'),
      };

      const entity = (repo as any).mapRowToEntity(minimalRow);

      expect(entity.riskLevel).toBe('low');     // default
      expect(entity.impactScope).toBeNull();
      expect(entity.status).toBe('draft');       // default
      expect(entity.createdBy).toBeNull();
    });
  });

  // ==================== findByStatus ====================

  describe('findByStatus', () => {
    it('should query by tenant_id and status, mapping rows to entities', async () => {
      mockDb.query.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });

      const result = await repo.findByStatus('tenant-1', 'pending_approval');

      expect(result).toEqual([expectedEntity]);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM change_request WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC',
        ['tenant-1', 'pending_approval'],
      );
    });

    it('should return empty array when no rows match', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findByStatus('tenant-1', 'completed');

      expect(result).toEqual([]);
    });
  });

  // ==================== findByType ====================

  describe('findByType', () => {
    it('should query by tenant_id and change_type, mapping rows to entities', async () => {
      mockDb.query.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });

      const result = await repo.findByType('tenant-1', 'standard');

      expect(result).toEqual([expectedEntity]);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM change_request WHERE tenant_id = $1 AND change_type = $2 ORDER BY created_at DESC',
        ['tenant-1', 'standard'],
      );
    });
  });

  // ==================== findByTenant ====================

  describe('findByTenant', () => {
    it('should delegate to findAll with tenantId in where clause', async () => {
      // BaseRepository.findAll makes two queries: data + count
      mockDb.query
        .mockResolvedValueOnce({ rows: [snakeRow], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await repo.findByTenant('tenant-1');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]).toEqual(expectedEntity);
      expect(result.total).toBe(1);
      // Verify that the query includes tenant_id filtering
      const dataCall = mockDb.query.mock.calls[0];
      expect(dataCall[0]).toContain('tenant_id = $');
      expect(dataCall[1]).toContain('tenant-1');
    });
  });

  // ==================== findWithFilters ====================

  describe('findWithFilters', () => {
    it('should pass all filter fields as where conditions', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [snakeRow], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await repo.findWithFilters('tenant-1', {
        status: 'pending_approval',
        changeType: 'standard',
        riskLevel: 'medium',
      });

      expect(result.entities[0]).toEqual(expectedEntity);
      // The where clause should include all three filter columns
      const dataCall = mockDb.query.mock.calls[0];
      const sql = dataCall[0];
      expect(sql).toContain('tenant_id');
      expect(sql).toContain('status');
      expect(sql).toContain('change_type');
      expect(sql).toContain('risk_level');
    });

    it('should omit undefined filters from where clause', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findWithFilters('tenant-1', { status: 'draft' });

      const dataCall = mockDb.query.mock.calls[0];
      const sql = dataCall[0];
      // Only tenant_id and status should appear in conditions
      expect(sql).not.toContain('change_type');
      expect(sql).not.toContain('risk_level');
    });
  });
});
