/**
 * Tests for ChangeRequestRepository, CABMeetingRepository,
 * ChangeTimelineRepository, and RFCRepository
 *
 * Mode A: Mock pool.query, verify SQL queries and parameters.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ChangeRequestRepository,
  CABMeetingRepository,
  ChangeTimelineRepository,
  RFCRepository,
} from '../ChangeRepository';

const mockPool = { query: jest.fn() };

// ==================== ChangeRequestRepository ====================

describe('ChangeRequestRepository', () => {
  let repo: ChangeRequestRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ChangeRequestRepository(mockPool as any);
  });

  const mockChangeRow = (overrides: Record<string, any> = {}) => ({
    id: 'chg-1',
    tenant_id: 'tenant-1',
    title: 'Upgrade database to v16',
    description: 'Major version upgrade',
    type: 'normal',
    category: 'infrastructure',
    priority: 'high',
    risk_level: 'medium',
    status: 'draft',
    impact_description: 'Brief downtime expected',
    rollback_plan: 'Restore from backup',
    implementation_plan: 'Step-by-step upgrade',
    scheduled_start: new Date('2026-07-01T02:00:00Z'),
    scheduled_end: new Date('2026-07-01T04:00:00Z'),
    actual_start: null,
    actual_end: null,
    requester_id: 'user-1',
    assigned_to: 'user-2',
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    related_incidents: [],
    related_problems: [],
    affected_services: ['db-primary'],
    metadata: {},
    created_by: 'user-1',
    created_at: new Date('2026-06-01'),
    updated_at: new Date('2026-06-01'),
    ...overrides,
  });

  // ==================== BaseRepository: findById ====================

  describe('findById', () => {
    it('should return change request when found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockChangeRow()], rowCount: 1 });

      const result = await repo.findById('chg-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('chg-1');
      expect(result!.tenantId).toBe('tenant-1');
      expect(result!.riskLevel).toBe('medium');
      expect(result!.relatedIncidents).toEqual([]);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM change_requests WHERE id = $1',
        ['chg-1']
      );
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findById('chg-x');

      expect(result).toBeUndefined();
    });
  });

  // ==================== findByTenant ====================

  describe('findByTenant', () => {
    it('should return changes with default pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockChangeRow()], rowCount: 1 });

      const result = await repo.findByTenant('tenant-1');

      expect(result.total).toBe(1);
      expect(result.entities).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { status: 'approved' });

      const countSql = mockPool.query.mock.calls[0][0] as string;
      expect(countSql).toContain('status = $2');
      expect(mockPool.query.mock.calls[0][1]).toEqual(expect.arrayContaining(['tenant-1', 'approved']));
    });

    it('should filter by type', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { type: 'emergency' });

      const countSql = mockPool.query.mock.calls[0][0] as string;
      expect(countSql).toContain('type = $2');
    });

    it('should filter by priority', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { priority: 'critical' });

      const countSql = mockPool.query.mock.calls[0][0] as string;
      expect(countSql).toContain('priority = $2');
    });

    it('should filter by riskLevel', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { riskLevel: 'high' });

      const countSql = mockPool.query.mock.calls[0][0] as string;
      expect(countSql).toContain('risk_level = $2');
    });

    it('should filter by assignedTo', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { assignedTo: 'user-1' });

      const countSql = mockPool.query.mock.calls[0][0] as string;
      expect(countSql).toContain('assigned_to = $2');
    });

    it('should filter by requesterId', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { requesterId: 'user-2' });

      const countSql = mockPool.query.mock.calls[0][0] as string;
      expect(countSql).toContain('requester_id = $2');
    });

    it('should combine multiple filters', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', {
        status: 'draft',
        type: 'normal',
        priority: 'high',
        riskLevel: 'medium',
        assignedTo: 'user-1',
        requesterId: 'user-2',
        limit: 10,
        offset: 5,
      });

      const countSql = mockPool.query.mock.calls[0][0] as string;
      expect(countSql).toContain('status = $2');
      expect(countSql).toContain('type = $3');
      expect(countSql).toContain('priority = $4');
      expect(countSql).toContain('risk_level = $5');
      expect(countSql).toContain('assigned_to = $6');
      expect(countSql).toContain('requester_id = $7');

      const dataCall = mockPool.query.mock.calls[1];
      expect(dataCall[1]).toEqual(expect.arrayContaining([10, 5]));
    });
  });

  // ==================== findByIdAndTenant ====================

  describe('findByIdAndTenant', () => {
    it('should return change when found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockChangeRow()], rowCount: 1 });

      const result = await repo.findByIdAndTenant('chg-1', 'tenant-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('chg-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM change_requests WHERE id = $1 AND tenant_id = $2',
        ['chg-1', 'tenant-1']
      );
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByIdAndTenant('chg-x', 'tenant-1');

      expect(result).toBeUndefined();
    });
  });

  // ==================== updateStatus ====================

  describe('updateStatus', () => {
    it('should update status only', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockChangeRow({ status: 'submitted' })], rowCount: 1 });

      const result = await repo.updateStatus('chg-1', 'submitted', 'tenant-1');

      expect(result!.status).toBe('submitted');
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('status = $1');
      expect(sql).toContain('updated_at = NOW()');
    });

    it('should update status with extra fields (snake_case conversion)', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [mockChangeRow({ status: 'approved', approved_by: 'user-3', approved_at: new Date() })],
        rowCount: 1,
      });

      const result = await repo.updateStatus('chg-1', 'approved', 'tenant-1', {
        approvedBy: 'user-3',
        approvedAt: new Date(),
      });

      expect(result!.status).toBe('approved');
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('approved_by');
      expect(sql).toContain('approved_at');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.updateStatus('chg-x', 'approved', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return aggregated statistics', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '20' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ status: 'draft', count: '5' }, { status: 'approved', count: '15' }], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [{ type: 'normal', count: '12' }, { type: 'emergency', count: '8' }], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [{ priority: 'high', count: '10' }, { priority: 'medium', count: '10' }], rowCount: 2 });

      const result = await repo.getStats('tenant-1');

      expect(result.total).toBe(20);
      expect(result.byStatus).toEqual({ draft: 5, approved: 15 });
      expect(result.byType).toEqual({ normal: 12, emergency: 8 });
      expect(result.byPriority).toEqual({ high: 10, medium: 10 });
    });
  });

  // ==================== mapRowToEntity ====================

  describe('mapRowToEntity', () => {
    it('should map snake_case to camelCase', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockChangeRow()], rowCount: 1 });

      const result = await repo.findById('chg-1');

      expect(result!.riskLevel).toBe('medium');
      expect(result!.impactDescription).toBe('Brief downtime expected');
      expect(result!.rollbackPlan).toBe('Restore from backup');
      expect(result!.implementationPlan).toBe('Step-by-step upgrade');
      expect(result!.scheduledStart).toBeDefined();
      expect(result!.requesterId).toBe('user-1');
      expect(result!.assignedTo).toBe('user-2');
      expect(result!.affectedServices).toEqual(['db-primary']);
    });

    it('should default null arrays to empty', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [mockChangeRow({ related_incidents: null, related_problems: null, affected_services: null, metadata: null })],
        rowCount: 1,
      });

      const result = await repo.findById('chg-1');

      expect(result!.relatedIncidents).toEqual([]);
      expect(result!.relatedProblems).toEqual([]);
      expect(result!.affectedServices).toEqual([]);
      expect(result!.metadata).toEqual({});
    });
  });
});

// ==================== CABMeetingRepository ====================

describe('CABMeetingRepository', () => {
  let repo: CABMeetingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CABMeetingRepository(mockPool as any);
  });

  const mockMeetingRow = (overrides: Record<string, any> = {}) => ({
    id: 'cab-1',
    tenant_id: 'tenant-1',
    title: 'Weekly CAB Meeting',
    description: 'Review pending changes',
    scheduled_at: new Date('2026-07-01T10:00:00Z'),
    location: 'Conference Room A',
    attendees: ['user-1', 'user-2', 'user-3'],
    status: 'scheduled',
    minutes: null,
    decisions: [],
    created_by: 'user-1',
    created_at: new Date('2026-06-01'),
    updated_at: new Date('2026-06-01'),
    ...overrides,
  });

  describe('findByTenant', () => {
    it('should return meetings with default pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockMeetingRow()], rowCount: 1 });

      const result = await repo.findByTenant('tenant-1');

      expect(result.total).toBe(1);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].attendees).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('should filter by status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { status: 'completed' });

      const countSql = mockPool.query.mock.calls[0][0] as string;
      expect(countSql).toContain('status = $2');
    });
  });

  describe('findByIdAndTenant', () => {
    it('should return meeting when found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockMeetingRow()], rowCount: 1 });

      const result = await repo.findByIdAndTenant('cab-1', 'tenant-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('cab-1');
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByIdAndTenant('cab-x', 'tenant-1');

      expect(result).toBeUndefined();
    });
  });

  describe('addDecision', () => {
    it('should append decision to decisions JSONB array', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [mockMeetingRow({ decisions: [{ changeRequestId: 'chg-1', decision: 'approved' }] })],
        rowCount: 1,
      });

      const result = await repo.addDecision('cab-1', {
        changeRequestId: 'chg-1',
        decision: 'approved',
        notes: 'LGTM',
      }, 'tenant-1');

      expect(result!.decisions).toHaveLength(1);
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('decisions');
      expect(sql).toContain('jsonb');
    });

    it('should return null when meeting not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.addDecision('cab-x', { changeRequestId: 'chg-1', decision: 'approved' }, 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('mapRowToEntity', () => {
    it('should default null arrays to empty', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [mockMeetingRow({ attendees: null, decisions: null })],
        rowCount: 1,
      });

      const result = await repo.findById('cab-1');

      expect(result!.attendees).toEqual([]);
      expect(result!.decisions).toEqual([]);
    });
  });
});

// ==================== ChangeTimelineRepository ====================

describe('ChangeTimelineRepository', () => {
  let repo: ChangeTimelineRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ChangeTimelineRepository(mockPool as any);
  });

  const mockTimelineRow = (overrides: Record<string, any> = {}) => ({
    id: 'tl-1',
    tenant_id: 'tenant-1',
    change_request_id: 'chg-1',
    event_type: 'status_change',
    description: 'Status changed from draft to submitted',
    created_by: 'user-1',
    metadata: {},
    created_at: new Date('2026-06-01'),
    ...overrides,
  });

  describe('findByChangeId', () => {
    it('should return timeline events for change request', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [mockTimelineRow(), mockTimelineRow({ id: 'tl-2', event_type: 'comment' })],
        rowCount: 2,
      });

      const result = await repo.findByChangeId('chg-1');

      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('change_request_id = $1'),
        ['chg-1', 50, 0]
      );
    });

    it('should apply custom limit and offset', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByChangeId('chg-1', 10, 20);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        ['chg-1', 10, 20]
      );
    });

    it('should return empty array when no events', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByChangeId('chg-x');

      expect(result).toEqual([]);
    });
  });

  describe('mapRowToEntity', () => {
    it('should map fields correctly', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockTimelineRow()], rowCount: 1 });

      const result = await repo.findByChangeId('chg-1');

      expect(result[0].changeRequestId).toBe('chg-1');
      expect(result[0].eventType).toBe('status_change');
      expect(result[0].createdBy).toBe('user-1');
    });
  });
});

// ==================== RFCRepository ====================

describe('RFCRepository', () => {
  let repo: RFCRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RFCRepository(mockPool as any);
  });

  const mockRFCRow = (overrides: Record<string, any> = {}) => ({
    id: 'rfc-1',
    tenant_id: 'tenant-1',
    change_request_id: 'chg-1',
    rfc_number: 'RFC-2026-001',
    justification: 'Need to upgrade for security patches',
    risk_assessment: 'Medium risk, rollback plan in place',
    test_plan: 'Staging environment testing first',
    communication_plan: 'Email to stakeholders 48h before',
    backout_plan: 'Restore from snapshot',
    cab_meeting_id: 'cab-1',
    status: 'draft',
    reviewed_by: null,
    reviewed_at: null,
    created_by: 'user-1',
    created_at: new Date('2026-06-01'),
    updated_at: new Date('2026-06-01'),
    ...overrides,
  });

  describe('findByChangeId', () => {
    it('should return RFCs for change request', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockRFCRow()], rowCount: 1 });

      const result = await repo.findByChangeId('chg-1');

      expect(result).toHaveLength(1);
      expect(result[0].rfcNumber).toBe('RFC-2026-001');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('change_request_id = $1'),
        ['chg-1']
      );
    });

    it('should return empty array when no RFCs', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByChangeId('chg-x');

      expect(result).toEqual([]);
    });
  });

  describe('findByIdAndTenant', () => {
    it('should return RFC when found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockRFCRow()], rowCount: 1 });

      const result = await repo.findByIdAndTenant('rfc-1', 'tenant-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('rfc-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM rfcs WHERE id = $1 AND tenant_id = $2',
        ['rfc-1', 'tenant-1']
      );
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByIdAndTenant('rfc-x', 'tenant-1');

      expect(result).toBeUndefined();
    });
  });

  describe('findByTenant', () => {
    it('should return RFCs with pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockRFCRow()], rowCount: 1 });

      const result = await repo.findByTenant('tenant-1');

      expect(result.total).toBe(1);
      expect(result.entities).toHaveLength(1);
    });

    it('should apply custom limit and offset', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', 5, 10);

      const dataCall = mockPool.query.mock.calls[1];
      expect(dataCall[1]).toEqual(expect.arrayContaining(['tenant-1', 5, 10]));
    });
  });

  describe('updateStatus', () => {
    it('should update RFC status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockRFCRow({ status: 'approved' })], rowCount: 1 });

      const result = await repo.updateStatus('rfc-1', 'approved', 'tenant-1');

      expect(result!.status).toBe('approved');
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('status = $1');
      expect(sql).toContain('updated_at = NOW()');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.updateStatus('rfc-x', 'approved', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('mapRowToEntity', () => {
    it('should map all fields correctly', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockRFCRow()], rowCount: 1 });

      const result = await repo.findByChangeId('chg-1');

      expect(result[0].changeRequestId).toBe('chg-1');
      expect(result[0].rfcNumber).toBe('RFC-2026-001');
      expect(result[0].justification).toBe('Need to upgrade for security patches');
      expect(result[0].riskAssessment).toBe('Medium risk, rollback plan in place');
      expect(result[0].testPlan).toBe('Staging environment testing first');
      expect(result[0].communicationPlan).toBe('Email to stakeholders 48h before');
      expect(result[0].backoutPlan).toBe('Restore from snapshot');
      expect(result[0].cabMeetingId).toBe('cab-1');
    });
  });
});
