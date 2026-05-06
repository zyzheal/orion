/**
 * EventBusService Tests
 */

import { EventBusService, EventBusServiceError } from '../EventBusService';
import { EventBusRepository, EventSubscription, EventLog } from '../EventBusRepository';

describe('EventBusService', () => {
  let mockRepository: jest.Mocked<EventBusRepository>;
  let service: EventBusService;

  beforeEach(() => {
    mockRepository = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      getSubscriptions: jest.fn(),
      logEvent: jest.fn(),
      getEventLogs: jest.fn(),
    } as unknown as jest.Mocked<EventBusRepository>;

    service = new EventBusService(mockRepository);
  });

  describe('subscribe', () => {
    it('should create a new subscription', async () => {
      const mockSubscription: EventSubscription = {
        id: 'sub-1',
        tenant_id: 'tenant-1',
        event_type: 'pipeline.completed',
        handler: 'https://example.com/webhook',
        enabled: true,
      };
      mockRepository.subscribe.mockResolvedValue(mockSubscription);

      const result = await service.subscribe('tenant-1', 'pipeline.completed', 'https://example.com/webhook');

      expect(result).toEqual(mockSubscription);
      expect(mockRepository.subscribe).toHaveBeenCalledWith('tenant-1', 'pipeline.completed', 'https://example.com/webhook');
    });

    it('should throw when tenantId is missing', async () => {
      await expect(service.subscribe('', 'pipeline.completed', 'handler'))
        .rejects.toThrow(EventBusServiceError);
      await expect(service.subscribe('', 'pipeline.completed', 'handler'))
        .rejects.toThrow('Tenant ID and event type required');
    });

    it('should throw when eventType is missing', async () => {
      await expect(service.subscribe('tenant-1', '', 'handler'))
        .rejects.toThrow(EventBusServiceError);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe an existing subscription', async () => {
      mockRepository.unsubscribe.mockResolvedValue(true);

      const result = await service.unsubscribe('sub-1');

      expect(result).toBe(true);
      expect(mockRepository.unsubscribe).toHaveBeenCalledWith('sub-1');
    });

    it('should return false when subscription does not exist', async () => {
      mockRepository.unsubscribe.mockResolvedValue(false);

      const result = await service.unsubscribe('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('publish', () => {
    it('should log an event', async () => {
      const mockEvent: EventLog = {
        id: 'evt-1',
        tenant_id: 'tenant-1',
        event_type: 'pipeline.completed',
        payload: { pipelineId: 'p1', status: 'success' },
        processed: false,
        created_at: new Date(),
      };
      mockRepository.logEvent.mockResolvedValue(mockEvent);

      const result = await service.publish('tenant-1', 'pipeline.completed', { pipelineId: 'p1', status: 'success' });

      expect(result).toEqual(mockEvent);
      expect(mockRepository.logEvent).toHaveBeenCalledWith(
        'tenant-1',
        'pipeline.completed',
        { pipelineId: 'p1', status: 'success' }
      );
    });

    it('should log event with empty payload', async () => {
      mockRepository.logEvent.mockResolvedValue({
        id: 'evt-2', tenant_id: 't1', event_type: 'type', payload: {}, processed: false, created_at: new Date(),
      });

      const result = await service.publish('t1', 'type', {});

      expect(result.payload).toEqual({});
    });
  });

  describe('getSubscriptions', () => {
    it('should return all subscriptions for a tenant', async () => {
      const mockSubs: EventSubscription[] = [
        { id: 's1', tenant_id: 't1', event_type: 'pipeline.completed', handler: 'h1', enabled: true },
        { id: 's2', tenant_id: 't1', event_type: 'alert.triggered', handler: 'h2', enabled: true },
      ];
      mockRepository.getSubscriptions.mockResolvedValue(mockSubs);

      const result = await service.getSubscriptions('t1');

      expect(result).toEqual(mockSubs);
      expect(mockRepository.getSubscriptions).toHaveBeenCalledWith('t1', undefined);
    });

    it('should filter by event type', async () => {
      mockRepository.getSubscriptions.mockResolvedValue([
        { id: 's1', tenant_id: 't1', event_type: 'pipeline.completed', handler: 'h1', enabled: true },
      ]);

      const result = await service.getSubscriptions('t1', 'pipeline.completed');

      expect(result.length).toBe(1);
      expect(mockRepository.getSubscriptions).toHaveBeenCalledWith('t1', 'pipeline.completed');
    });

    it('should return empty array when no subscriptions', async () => {
      mockRepository.getSubscriptions.mockResolvedValue([]);

      const result = await service.getSubscriptions('t1');

      expect(result).toEqual([]);
    });
  });

  describe('getEventHistory', () => {
    it('should return event logs with default limit', async () => {
      const mockLogs: EventLog[] = [
        { id: 'e1', tenant_id: 't1', event_type: 'pipeline.completed', payload: {}, processed: true, created_at: new Date() },
        { id: 'e2', tenant_id: 't1', event_type: 'alert.triggered', payload: {}, processed: false, created_at: new Date() },
      ];
      mockRepository.getEventLogs.mockResolvedValue(mockLogs);

      const result = await service.getEventHistory('t1');

      expect(result).toEqual(mockLogs);
      expect(mockRepository.getEventLogs).toHaveBeenCalledWith('t1', undefined);
    });

    it('should return event logs with custom limit', async () => {
      mockRepository.getEventLogs.mockResolvedValue([]);

      await service.getEventHistory('t1', 50);

      expect(mockRepository.getEventLogs).toHaveBeenCalledWith('t1', 50);
    });
  });
});

describe('EventBusRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: EventBusRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new EventBusRepository(mockDb as any);
  });

  describe('subscribe', () => {
    it('should create a new subscription with enabled=true', async () => {
      const mockRow = { id: 'sub-1', tenant_id: 't1', event_type: 'pipeline.completed', handler: 'h1', enabled: true };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.subscribe('t1', 'pipeline.completed', 'h1');

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO event_subscriptions');
      expect(sql).toContain('enabled) VALUES ($1, $2, $3, true)');
    });
  });

  describe('unsubscribe', () => {
    it('should delete subscription and return true', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.unsubscribe('sub-1');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM event_subscriptions WHERE id = $1', ['sub-1']);
    });

    it('should return false when not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.unsubscribe('missing');

      expect(result).toBe(false);
    });
  });

  describe('getSubscriptions', () => {
    it('should return all subscriptions for tenant', async () => {
      const mockRows = [
        { id: 's1', tenant_id: 't1', event_type: 'pipeline.completed', handler: 'h1', enabled: true },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.getSubscriptions('t1');

      expect(result).toEqual(mockRows);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('WHERE tenant_id = $1');
    });

    it('should filter by event type when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getSubscriptions('t1', 'pipeline.completed');

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('AND event_type = $2');
    });
  });

  describe('logEvent', () => {
    it('should insert event log with processed=false', async () => {
      const mockRow = { id: 'evt-1', tenant_id: 't1', event_type: 'pipeline.completed', payload: {}, processed: false, created_at: new Date() };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.logEvent('t1', 'pipeline.completed', {});

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO event_logs');
      expect(sql).toContain('processed) VALUES ($1, $2, $3, false)');
    });
  });

  describe('getEventLogs', () => {
    it('should return event logs ordered by created_at DESC', async () => {
      const mockRows = [{ id: 'e1' }, { id: 'e2' }];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.getEventLogs('t1');

      expect(result).toEqual(mockRows);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('ORDER BY created_at DESC');
    });

    it('should use default limit of 100', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getEventLogs('t1');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[1]).toBe(100);
    });

    it('should use custom limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getEventLogs('t1', 50);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[1]).toBe(50);
    });
  });
});
