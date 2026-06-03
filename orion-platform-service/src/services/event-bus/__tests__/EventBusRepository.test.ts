/**
 * EventBusRepository - Database layer unit tests
 *
 * Tests subscribe, unsubscribe, getSubscriptions, logEvent, and getEventLogs operations.
 */

import { EventBusRepository, EventSubscription, EventLog } from '../EventBusRepository';

describe('EventBusRepository', () => {
  let repo: EventBusRepository;
  let mockPool: any;

  const mockSubscription: EventSubscription = {
    id: 'sub-1',
    tenant_id: 'tenant-1',
    event_type: 'pipeline.completed',
    handler: 'https://example.com/webhook',
    enabled: true,
  };

  const mockEventLog: EventLog = {
    id: 'log-1',
    tenant_id: 'tenant-1',
    event_type: 'pipeline.completed',
    payload: { pipelineId: 'p-1', status: 'success' },
    processed: false,
    created_at: new Date('2026-01-15T10:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = { query: jest.fn() };
    repo = new EventBusRepository(mockPool);
  });

  // ==================== subscribe ====================

  describe('subscribe', () => {
    it('should insert a new event subscription', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockSubscription] });

      const result = await repo.subscribe('tenant-1', 'pipeline.completed', 'https://example.com/webhook');

      expect(result).toEqual(mockSubscription);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO event_subscriptions'),
        ['tenant-1', 'pipeline.completed', 'https://example.com/webhook']
      );
    });

    it('should set enabled to true by default', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockSubscription] });

      await repo.subscribe('tenant-1', 'pipeline.completed', 'handler');

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('true');
    });

    it('should use RETURNING * to get the created row', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockSubscription] });

      await repo.subscribe('t-1', 'event', 'handler');

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('RETURNING *');
    });
  });

  // ==================== unsubscribe ====================

  describe('unsubscribe', () => {
    it('should delete a subscription by id', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.unsubscribe('sub-1');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM event_subscriptions WHERE id = $1',
        ['sub-1']
      );
    });

    it('should return false when subscription does not exist', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.unsubscribe('missing');
      expect(result).toBe(false);
    });
  });

  // ==================== getSubscriptions ====================

  describe('getSubscriptions', () => {
    it('should return subscriptions for a tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockSubscription] });

      const result = await repo.getSubscriptions('tenant-1');

      expect(result).toEqual([mockSubscription]);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        ['tenant-1']
      );
    });

    it('should filter by event type when provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockSubscription] });

      await repo.getSubscriptions('tenant-1', 'pipeline.completed');

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('AND event_type = $2');
      expect(mockPool.query.mock.calls[0][1]).toEqual(['tenant-1', 'pipeline.completed']);
    });

    it('should not add event_type filter when not provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.getSubscriptions('tenant-1');

      const query = mockPool.query.mock.calls[0][0];
      expect(query).not.toContain('AND event_type');
    });

    it('should return empty array when no subscriptions match', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.getSubscriptions('empty-tenant');
      expect(result).toEqual([]);
    });

    it('should return multiple subscriptions', async () => {
      const sub2 = { ...mockSubscription, id: 'sub-2', event_type: 'deploy.started' };
      mockPool.query.mockResolvedValue({ rows: [mockSubscription, sub2] });

      const result = await repo.getSubscriptions('tenant-1');
      expect(result).toHaveLength(2);
    });
  });

  // ==================== logEvent ====================

  describe('logEvent', () => {
    it('should insert an event log entry', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockEventLog] });

      const payload = { pipelineId: 'p-1', status: 'success' };
      const result = await repo.logEvent('tenant-1', 'pipeline.completed', payload);

      expect(result).toEqual(mockEventLog);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO event_logs'),
        ['tenant-1', 'pipeline.completed', payload]
      );
    });

    it('should set processed to false by default', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockEventLog] });

      await repo.logEvent('t-1', 'event', {});

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('false');
    });

    it('should return the created log entry', async () => {
      const log = { ...mockEventLog, id: 'log-99' };
      mockPool.query.mockResolvedValue({ rows: [log] });

      const result = await repo.logEvent('t-1', 'event', {});
      expect(result.id).toBe('log-99');
    });
  });

  // ==================== getEventLogs ====================

  describe('getEventLogs', () => {
    it('should return event logs for a tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockEventLog] });

      const result = await repo.getEventLogs('tenant-1');

      expect(result).toEqual([mockEventLog]);
    });

    it('should use default limit of 100', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.getEventLogs('tenant-1');

      const params = mockPool.query.mock.calls[0][1];
      expect(params[1]).toBe(100);
    });

    it('should accept custom limit', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.getEventLogs('tenant-1', 50);

      const params = mockPool.query.mock.calls[0][1];
      expect(params[1]).toBe(50);
    });

    it('should order by created_at DESC', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.getEventLogs('tenant-1');

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('ORDER BY created_at DESC');
    });

    it('should return empty array when no logs exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.getEventLogs('empty-tenant');
      expect(result).toEqual([]);
    });
  });
});
