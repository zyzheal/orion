/**
 * WebhookService 单元测试
 *
 * 测试 Webhook 配置管理：CRUD、事件投递、日志查询。
 */

// Mock uuid to return predictable values
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

import { WebhookService } from '../WebhookService';

describe('WebhookService', () => {
  let service: WebhookService;
  let mockPool: any;

  const sampleWebhookRow = {
    id: 'wh-1',
    name: 'Test Webhook',
    url: 'https://example.com/hook',
    events: '["deploy.finished","alert.created"]',
    secret_key: 'secret123',
    enabled: true,
    retry_count: 3,
    retry_interval_seconds: 30,
    timeout_seconds: 10,
    headers: '{"X-Custom":"value"}',
    description: 'Test webhook',
    created_by: 'admin',
    last_triggered_at: null,
    last_status: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = {
      query: jest.fn(),
    };
    service = new WebhookService(mockPool);
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should create service with pool', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getAll', () => {
    it('should return all webhooks', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleWebhookRow] });

      const result = await service.getAll();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Webhook');
      expect(result[0].events).toEqual(['deploy.finished', 'alert.created']);
      expect(result[0].headers).toEqual({ 'X-Custom': 'value' });
    });

    it('should handle events as array', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleWebhookRow, events: ['event1'] }],
      });

      const result = await service.getAll();

      expect(result[0].events).toEqual(['event1']);
    });

    it('should handle headers as object', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleWebhookRow, headers: { 'X-Test': 'val' } }],
      });

      const result = await service.getAll();

      expect(result[0].headers).toEqual({ 'X-Test': 'val' });
    });
  });

  describe('getById', () => {
    it('should return webhook by id', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleWebhookRow] });

      const result = await service.getById('wh-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('wh-1');
      expect(result!.events).toEqual(['deploy.finished', 'alert.created']);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create webhook with defaults', async () => {
      // Mock getById for the return value
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // insert
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] }); // getById

      const result = await service.create({
        name: 'Test Webhook',
        url: 'https://example.com/hook',
        events: ['deploy.finished'],
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Webhook');
    });

    it('should generate secret when not provided', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] });

      await service.create({
        name: 'Test',
        url: 'https://example.com/hook',
        events: ['test'],
      });

      // Verify secret was generated (32 bytes hex = 64 chars)
      const insertParams = mockPool.query.mock.calls[0][1];
      expect(insertParams[4]).toMatch(/^[a-f0-9]{64}$/); // secret
    });

    it('should use provided secret', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] });

      await service.create({
        name: 'Test',
        url: 'https://example.com/hook',
        events: ['test'],
        secret_key: 'my-secret',
      });

      const insertParams = mockPool.query.mock.calls[0][1];
      expect(insertParams[4]).toBe('my-secret');
    });

    it('should use defaults for optional fields', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] });

      await service.create({
        name: 'Test',
        url: 'https://example.com/hook',
        events: ['test'],
      });

      const insertParams = mockPool.query.mock.calls[0][1];
      expect(insertParams[5]).toBe(true); // enabled
      expect(insertParams[6]).toBe(3); // retry_count
      expect(insertParams[7]).toBe(30); // retry_interval_seconds
      expect(insertParams[8]).toBe(10); // timeout_seconds
      expect(insertParams[10]).toBe(''); // description
      expect(insertParams[11]).toBe('system'); // created_by
    });
  });

  describe('update', () => {
    it('should return null when webhook not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.update('nonexistent', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('should update name', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] }) // getById
        .mockResolvedValueOnce({ rows: [] }) // update
        .mockResolvedValueOnce({ rows: [{ ...sampleWebhookRow, name: 'Updated' }] }); // re-fetch

      const result = await service.update('wh-1', { name: 'Updated' });

      expect(result!.name).toBe('Updated');
    });

    it('should update multiple fields', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] });

      await service.update('wh-1', {
        name: 'Updated',
        enabled: false,
        timeout_seconds: 30,
      });

      const updateQuery = mockPool.query.mock.calls[1][0];
      expect(updateQuery).toContain('name = $');
      expect(updateQuery).toContain('enabled = $');
      expect(updateQuery).toContain('timeout_seconds = $');
    });

    it('should not update when no changes provided', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] })
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] });

      const result = await service.update('wh-1', {});

      expect(result).toBeDefined();
      // Should NOT have called the update query (calls: getById, re-fetch)
      // The update query should NOT be present
      const updateCalls = mockPool.query.mock.calls.filter(
        (c: any[]) => c[0].includes('UPDATE chatops_webhooks SET')
      );
      expect(updateCalls).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('should return true when deleted', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.delete('wh-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('testWebhook', () => {
    it('should return error when webhook not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.testWebhook('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook not found');
    });

    it('should return success on 200 response', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] }) // getById
        .mockResolvedValueOnce({ rows: [] }) // logDelivery insert
        .mockResolvedValueOnce({ rows: [] }); // update webhook status

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });

      const result = await service.testWebhook('wh-1');

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
    });

    it('should handle fetch error', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] })
        .mockResolvedValueOnce({ rows: [] }) // logDelivery
        .mockResolvedValueOnce({ rows: [] }); // update status

      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.testWebhook('wh-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('getLogs', () => {
    it('should return webhook logs', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'log-1',
          webhook_id: 'wh-1',
          event_type: 'deploy.finished',
          payload: '{"test":true}',
          response_status: 200,
          response_body: 'OK',
          error_message: null,
          retry_count: 0,
          created_at: new Date(),
        }],
      });

      const result = await service.getLogs('wh-1');

      expect(result).toHaveLength(1);
      expect(result[0].event_type).toBe('deploy.finished');
      expect(result[0].payload).toEqual({ test: true });
    });

    it('should handle payload as object', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'log-1',
          webhook_id: 'wh-1',
          event_type: 'test',
          payload: { test: true },
          response_status: 200,
          response_body: null,
          error_message: null,
          retry_count: 0,
          created_at: new Date(),
        }],
      });

      const result = await service.getLogs('wh-1');

      expect(result[0].payload).toEqual({ test: true });
    });

    it('should use custom limit', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.getLogs('wh-1', 50);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['wh-1', 50],
      );
    });
  });

  describe('deliverEvent', () => {
    it('should deliver to matching webhooks', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] }) // getAll
        .mockResolvedValueOnce({ rows: [] }) // logDelivery
        .mockResolvedValueOnce({ rows: [] }); // update status

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });

      await service.deliverEvent('deploy.finished', { service: 'api' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should skip disabled webhooks', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleWebhookRow, enabled: false }],
      });

      await service.deliverEvent('deploy.finished', { service: 'api' });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip webhooks without matching event', async () => {
      mockPool.query.mockResolvedValue({
        rows: [sampleWebhookRow],
      });

      await service.deliverEvent('unrelated.event', { data: 'test' });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle delivery failure', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleWebhookRow] })
        .mockResolvedValueOnce({ rows: [] }) // logDelivery
        .mockResolvedValueOnce({ rows: [] }); // update status

      mockFetch.mockRejectedValue(new Error('Connection refused'));

      // Should not throw
      await service.deliverEvent('deploy.finished', { service: 'api' });

      // Verify error was logged
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chatops_webhook_logs'),
        expect.arrayContaining([expect.stringContaining('Connection refused')]),
      );
    });
  });
});
