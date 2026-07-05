/**
 * Tests for SLADefinitionRepository, SLATrackingRepository, SLABreachEventRepository
 *
 * Mode A: Mock pool.query, verify SQL queries and parameters.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  SLADefinitionRepository,
  SLATrackingRepository,
  SLABreachEventRepository,
} from '../SLARepository';

const mockPool = { query: jest.fn() };

// ==================== SLADefinitionRepository ====================

describe('SLADefinitionRepository', () => {
  let repo: SLADefinitionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SLADefinitionRepository(mockPool as any);
  });

  const mockDefRow = (overrides: Record<string, any> = {}) => ({
    id: 'sla-1',
    tenant_id: 'tenant-1',
    name: 'P1 Response SLA',
    description: 'Critical incident response time',
    type: 'response',
    target_value: 15,
    target_unit: 'minutes',
    business_hours_only: false,
    priority: 'critical',
    category: 'incident',
    escalation_rules: {},
    metadata: {},
    status: 'active',
    created_by: 'user-1',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-02'),
    ...overrides,
  });

  // ==================== BaseRepository: findById ====================

  describe('findById', () => {
    it('should return SLA definition when found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockDefRow()], rowCount: 1 });

      const result = await repo.findById('sla-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('sla-1');
      expect(result!.name).toBe('P1 Response SLA');
      expect(result!.target_value).toBe(15);
      expect(result!.type).toBe('response');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM sla_definitions WHERE id = $1',
        ['sla-1']
      );
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findById('sla-x');

      expect(result).toBeUndefined();
    });
  });

  // ==================== createDefinition ====================

  describe('createDefinition', () => {
    it('should create with all fields', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockDefRow()], rowCount: 1 });

      const result = await repo.createDefinition({
        tenantId: 'tenant-1',
        name: 'P1 Response SLA',
        description: 'Critical incident response time',
        type: 'response',
        targetValue: 15,
        targetUnit: 'minutes',
        businessHoursOnly: false,
        priority: 'critical',
        category: 'incident',
        escalationRules: { warn: 10 },
        metadata: { team: 'sre' },
        status: 'active',
        createdBy: 'user-1',
      });

      expect(result.id).toBe('sla-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sla_definitions'),
        expect.arrayContaining(['tenant-1', 'P1 Response SLA', 15])
      );
    });

    it('should apply defaults for optional fields', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockDefRow()], rowCount: 1 });

      await repo.createDefinition({
        tenantId: 'tenant-1',
        name: 'Minimal SLA',
        targetValue: 60,
      });

      const params = mockPool.query.mock.calls[0][1] as any[];
      // type defaults to 'response'
      expect(params).toContain('response');
      // targetUnit defaults to 'minutes'
      expect(params).toContain('minutes');
      // status defaults to 'active'
      expect(params).toContain('active');
    });
  });

  // ==================== updateDefinition ====================

  describe('updateDefinition', () => {
    it('should update name and target_value', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockDefRow({ name: 'Updated', target_value: 30 })], rowCount: 1 });

      const result = await repo.updateDefinition('sla-1', { name: 'Updated', targetValue: 30 });

      expect(result!.name).toBe('Updated');
      expect(result!.target_value).toBe(30);
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('name = $1');
      expect(sql).toContain('target_value = $2');
      expect(sql).toContain('updated_at = NOW()');
    });

    it('should update status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockDefRow({ status: 'inactive' })], rowCount: 1 });

      const result = await repo.updateDefinition('sla-1', { status: 'inactive' });

      expect(result!.status).toBe('inactive');
    });

    it('should return existing when no fields to update', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockDefRow()], rowCount: 1 });

      const result = await repo.updateDefinition('sla-1', {});

      expect(result).toBeDefined();
      // Should call findById (SELECT) instead of UPDATE
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM sla_definitions WHERE id = $1',
        ['sla-1']
      );
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.updateDefinition('sla-x', { name: 'x' });

      expect(result).toBeUndefined();
    });
  });

  // ==================== BaseRepository: delete ====================

  describe('delete', () => {
    it('should return true when delete succeeds', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await repo.delete('sla-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.delete('sla-x');

      expect(result).toBe(false);
    });
  });

  // ==================== findByTenant ====================

  describe('findByTenant', () => {
    it('should return definitions with default pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockDefRow()], rowCount: 1 });

      const result = await repo.findByTenant('tenant-1');

      expect(result.total).toBe(1);
      expect(result.entities).toHaveLength(1);
      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('SELECT COUNT(*)'),
        expect.arrayContaining(['tenant-1'])
      );
    });

    it('should filter by type', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { type: 'resolution' });

      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('type = $2'),
        expect.arrayContaining(['tenant-1', 'resolution'])
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

    it('should filter by category', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { category: 'incident' });

      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('category = $2'),
        expect.arrayContaining(['tenant-1', 'incident'])
      );
    });

    it('should combine multiple filters', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { type: 'response', status: 'active', category: 'incident', limit: 5, offset: 10 });

      const countSql = mockPool.query.mock.calls[0][0] as string;
      expect(countSql).toContain('type = $2');
      expect(countSql).toContain('status = $3');
      expect(countSql).toContain('category = $4');

      const dataCall = mockPool.query.mock.calls[1];
      expect(dataCall[1]).toEqual(expect.arrayContaining(['tenant-1', 'response', 'active', 'incident', 5, 10]));
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return aggregated statistics', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ status: 'active', count: '7' }, { status: 'inactive', count: '3' }], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [{ type: 'response', count: '5' }, { type: 'resolution', count: '5' }], rowCount: 2 });

      const result = await repo.getStats('tenant-1');

      expect(result.total).toBe(10);
      expect(result.byStatus).toEqual({ active: 7, inactive: 3 });
      expect(result.byType).toEqual({ response: 5, resolution: 5 });
    });
  });

  // ==================== mapRowToEntity ====================

  describe('mapRowToEntity', () => {
    it('should parse JSON string fields', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [mockDefRow({ escalation_rules: '{"warn": 10}', metadata: '{"team": "sre"}' })],
        rowCount: 1,
      });

      const result = await repo.findById('sla-1');

      expect(result!.escalation_rules).toEqual({ warn: 10 });
      expect(result!.metadata).toEqual({ team: 'sre' });
    });

    it('should default null JSON fields to empty objects', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [mockDefRow({ escalation_rules: null, metadata: null })],
        rowCount: 1,
      });

      const result = await repo.findById('sla-1');

      expect(result!.escalation_rules).toEqual({});
      expect(result!.metadata).toEqual({});
    });
  });
});

// ==================== SLATrackingRepository ====================

describe('SLATrackingRepository', () => {
  let repo: SLATrackingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SLATrackingRepository(mockPool as any);
  });

  const mockTrackingRow = (overrides: Record<string, any> = {}) => ({
    id: 'track-1',
    tenant_id: 'tenant-1',
    sla_definition_id: 'sla-1',
    entity_type: 'incident',
    entity_id: 'inc-1',
    status: 'tracking',
    start_time: new Date('2026-06-01T10:00:00Z'),
    target_time: new Date('2026-06-01T10:15:00Z'),
    actual_time: null,
    breach_time: null,
    pause_duration: '0',
    notes: null,
    created_at: new Date('2026-06-01'),
    updated_at: new Date('2026-06-01'),
    ...overrides,
  });

  // ==================== createTracking ====================

  describe('createTracking', () => {
    it('should create tracking with all fields', async () => {
      const targetTime = new Date('2026-06-01T10:15:00Z');
      mockPool.query.mockResolvedValueOnce({ rows: [mockTrackingRow()], rowCount: 1 });

      const result = await repo.createTracking({
        tenantId: 'tenant-1',
        slaDefinitionId: 'sla-1',
        entityType: 'incident',
        entityId: 'inc-1',
        targetTime,
        notes: 'Urgent',
      });

      expect(result.id).toBe('track-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sla_tracking'),
        expect.arrayContaining(['tenant-1', 'sla-1', 'incident', 'inc-1', targetTime])
      );
    });

    it('should apply defaults for optional fields', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockTrackingRow()], rowCount: 1 });

      await repo.createTracking({
        tenantId: 'tenant-1',
        slaDefinitionId: 'sla-1',
        entityType: 'incident',
        entityId: 'inc-1',
        targetTime: new Date(),
      });

      const params = mockPool.query.mock.calls[0][1] as any[];
      expect(params).toContain('tracking'); // default status
    });
  });

  // ==================== updateStatus ====================

  describe('updateStatus', () => {
    it('should set actual_time when status is met', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockTrackingRow({ status: 'met', actual_time: new Date() })], rowCount: 1 });

      const result = await repo.updateStatus('track-1', 'met', 'tenant-1');

      expect(result!.status).toBe('met');
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('actual_time = NOW()');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        ['met', 'track-1', 'tenant-1']
      );
    });

    it('should set actual_time when status is breached', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockTrackingRow({ status: 'breached', actual_time: new Date() })], rowCount: 1 });

      const result = await repo.updateStatus('track-1', 'breached', 'tenant-1');

      expect(result!.status).toBe('breached');
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('actual_time = NOW()');
    });

    it('should not set actual_time for paused status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockTrackingRow({ status: 'paused' })], rowCount: 1 });

      await repo.updateStatus('track-1', 'paused', 'tenant-1');

      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).not.toContain('actual_time');
      expect(sql).toContain('status = $1');
      expect(sql).toContain('updated_at = NOW()');
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.updateStatus('track-x', 'met', 'tenant-1');

      expect(result).toBeUndefined();
    });
  });

  // ==================== findByTenant ====================

  describe('findByTenant', () => {
    it('should return trackings with default pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockTrackingRow()], rowCount: 1 });

      const result = await repo.findByTenant('tenant-1');

      expect(result.total).toBe(1);
      expect(result.entities).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { status: 'breached' });

      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('status = $2'),
        expect.arrayContaining(['tenant-1', 'breached'])
      );
    });

    it('should filter by entityType', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { entityType: 'request' });

      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('entity_type = $2'),
        expect.arrayContaining(['tenant-1', 'request'])
      );
    });

    it('should filter by entityId', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { entityId: 'inc-42' });

      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('entity_id = $2'),
        expect.arrayContaining(['tenant-1', 'inc-42'])
      );
    });
  });

  // ==================== findByEntity ====================

  describe('findByEntity', () => {
    it('should find trackings by entity type and id', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockTrackingRow()], rowCount: 1 });

      const result = await repo.findByEntity('incident', 'inc-1', 'tenant-1');

      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_type = $2 AND entity_id = $3'),
        ['tenant-1', 'incident', 'inc-1']
      );
    });

    it('should return empty array when no trackings', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByEntity('incident', 'inc-x', 'tenant-1');

      expect(result).toEqual([]);
    });
  });

  // ==================== findActiveBreaches ====================

  describe('findActiveBreaches', () => {
    it('should find overdue tracking records', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockTrackingRow()], rowCount: 1 });

      const result = await repo.findActiveBreaches('tenant-1');

      expect(result).toHaveLength(1);
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain("status = 'tracking'");
      expect(sql).toContain('target_time < NOW()');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        ['tenant-1']
      );
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return tracking statistics with breach rate', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '20' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [
            { status: 'tracking', count: '10' },
            { status: 'met', count: '7' },
            { status: 'breached', count: '3' },
          ],
          rowCount: 3,
        });

      const result = await repo.getStats('tenant-1');

      expect(result.total).toBe(20);
      expect(result.byStatus).toEqual({ tracking: 10, met: 7, breached: 3 });
      expect(result.breachRate).toBe(15); // 3/20 * 100
    });

    it('should return 0 breach rate when no trackings', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.getStats('tenant-1');

      expect(result.total).toBe(0);
      expect(result.breachRate).toBe(0);
    });
  });

  // ==================== mapRowToEntity ====================

  describe('mapRowToEntity', () => {
    it('should map all fields correctly', async () => {
      const now = new Date();
      mockPool.query.mockResolvedValueOnce({
        rows: [mockTrackingRow({ start_time: now, target_time: now, actual_time: now, breach_time: now })],
        rowCount: 1,
      });

      const result = await repo.findById('track-1');

      expect(result!.sla_definition_id).toBe('sla-1');
      expect(result!.entity_type).toBe('incident');
      expect(result!.entity_id).toBe('inc-1');
      expect(result!.pause_duration).toBe('0');
    });
  });
});

// ==================== SLABreachEventRepository ====================

describe('SLABreachEventRepository', () => {
  let repo: SLABreachEventRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SLABreachEventRepository(mockPool as any);
  });

  const mockEventRow = (overrides: Record<string, any> = {}) => ({
    id: 'evt-1',
    tenant_id: 'tenant-1',
    sla_tracking_id: 'track-1',
    event_type: 'breach',
    event_time: new Date('2026-06-01T10:16:00Z'),
    details: { entity_type: 'incident', entity_id: 'inc-1' },
    notified_users: ['user-1', 'user-2'],
    created_at: new Date('2026-06-01'),
    ...overrides,
  });

  // ==================== createEvent ====================

  describe('createEvent', () => {
    it('should create breach event with all fields', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockEventRow()], rowCount: 1 });

      const result = await repo.createEvent({
        tenantId: 'tenant-1',
        slaTrackingId: 'track-1',
        eventType: 'breach',
        details: { entity_type: 'incident' },
        notifiedUsers: ['user-1'],
      });

      expect(result.id).toBe('evt-1');
      expect(result.event_type).toBe('breach');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sla_breach_events'),
        expect.arrayContaining(['tenant-1', 'track-1', 'breach'])
      );
    });

    it('should apply defaults for optional fields', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockEventRow()], rowCount: 1 });

      await repo.createEvent({
        tenantId: 'tenant-1',
        slaTrackingId: 'track-1',
        eventType: 'warning',
      });

      const params = mockPool.query.mock.calls[0][1] as any[];
      // details defaults to '{}'
      expect(params).toContain('{}');
      // notifiedUsers defaults to []
      expect(params).toContainEqual([]);
    });
  });

  // ==================== findByTrackingId ====================

  describe('findByTrackingId', () => {
    it('should find events by tracking ID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockEventRow(), mockEventRow({ id: 'evt-2', event_type: 'warning' })], rowCount: 2 });

      const result = await repo.findByTrackingId('track-1');

      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('sla_tracking_id = $1'),
        ['track-1']
      );
    });

    it('should return empty array when no events', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByTrackingId('track-x');

      expect(result).toEqual([]);
    });
  });

  // ==================== findByTenant ====================

  describe('findByTenant', () => {
    it('should return events with default pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockEventRow()], rowCount: 1 });

      const result = await repo.findByTenant('tenant-1');

      expect(result.total).toBe(1);
      expect(result.entities).toHaveLength(1);
    });

    it('should apply custom limit and offset', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('tenant-1', { limit: 5, offset: 10 });

      const dataCall = mockPool.query.mock.calls[1];
      expect(dataCall[1]).toEqual(expect.arrayContaining(['tenant-1', 5, 10]));
    });
  });

  // ==================== mapRowToEntity ====================

  describe('mapRowToEntity', () => {
    it('should parse JSON string details', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [mockEventRow({ details: '{"entity_type": "incident"}' })],
        rowCount: 1,
      });

      const result = await repo.findByTrackingId('track-1');

      expect(result[0].details).toEqual({ entity_type: 'incident' });
    });

    it('should default null fields', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [mockEventRow({ details: null, notified_users: null })],
        rowCount: 1,
      });

      const result = await repo.findByTrackingId('track-1');

      expect(result[0].details).toEqual({});
      expect(result[0].notified_users).toEqual([]);
    });
  });
});
