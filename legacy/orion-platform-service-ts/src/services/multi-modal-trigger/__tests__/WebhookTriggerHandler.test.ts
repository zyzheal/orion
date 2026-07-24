/**
 * WebhookTriggerHandler - Comprehensive Tests
 *
 * Tests for webhook registration, processing, signature verification,
 * IP filtering, path extraction, and webhook history.
 */

import { WebhookTriggerHandler, WebhookPayload } from '../WebhookTriggerHandler';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('pino', () => () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

class MockWebhookEndpointRepository {
  private endpoints: Map<string, any> = new Map();

  async create(entity: any) {
    const endpoint = { ...entity, created_at: new Date() };
    this.endpoints.set(endpoint.id, endpoint);
    return endpoint;
  }

  async findById(id: string) {
    return this.endpoints.get(id);
  }

  async findByPath(path: string) {
    return Array.from(this.endpoints.values()).find(e => e.path === path);
  }

  async findByTenant(tenantId: string) {
    return Array.from(this.endpoints.values()).filter(e => e.tenant_id === tenantId);
  }

  async delete(id: string) {
    return this.endpoints.delete(id);
  }

  async incrementRequestCount(id: string) {
    const endpoint = this.endpoints.get(id);
    if (endpoint) {
      endpoint.request_count += 1;
      endpoint.last_request_at = new Date();
    }
  }

  addEndpoint(endpoint: any) {
    this.endpoints.set(endpoint.id, endpoint);
  }
}

class MockTriggerEventRepository {
  private events: Map<string, any> = new Map();

  async create(entity: any) {
    const event = { ...entity, created_at: new Date() };
    this.events.set(event.id, event);
    return event;
  }

  async findByTriggerId(triggerId: string, limit: number = 50) {
    return Array.from(this.events.values())
      .filter(e => e.trigger_id === triggerId)
      .slice(0, limit);
  }
}

class MockTriggerRepository {
  private triggers: Map<string, any> = new Map();

  async incrementTriggerCount(id: string) {
    const trigger = this.triggers.get(id);
    if (trigger) trigger.trigger_count += 1;
  }

  addTrigger(trigger: any) {
    this.triggers.set(trigger.id, trigger);
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WebhookTriggerHandler', () => {
  let handler: WebhookTriggerHandler;
  let mockWebhookRepo: MockWebhookEndpointRepository;
  let mockEventRepo: MockTriggerEventRepository;
  let mockTriggerRepo: MockTriggerRepository;

  function createPayload(overrides: Partial<WebhookPayload> = {}): WebhookPayload {
    return {
      headers: {},
      body: {},
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  beforeEach(() => {
    mockWebhookRepo = new MockWebhookEndpointRepository();
    mockEventRepo = new MockTriggerEventRepository();
    mockTriggerRepo = new MockTriggerRepository();
    handler = new WebhookTriggerHandler();
    (handler as any).webhookRepo = mockWebhookRepo;
    (handler as any).eventRepo = mockEventRepo;
    (handler as any).triggerRepo = mockTriggerRepo;
  });

  // ─── registerWebhook ─────────────────────────────────────────────────────

  describe('registerWebhook', () => {
    it('should register a webhook with auto-generated path', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', {
        triggerId: 'trigger-1',
      });

      expect(endpoint.id).toBeDefined();
      expect(endpoint.tenant_id).toBe('tenant-1');
      expect(endpoint.path).toBeDefined();
      expect(endpoint.secret).toBeDefined();
      expect(endpoint.method).toBe('POST');
      expect(endpoint.request_count).toBe(0);
    });

    it('should register with custom path', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', {
        path: '/custom/webhook',
      });

      expect(endpoint.path).toBe('/custom/webhook');
    });

    it('should register with custom secret', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', {
        secret: 'my-secret-key',
      });

      expect(endpoint.secret).toBe('my-secret-key');
    });

    it('should register with custom method', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', {
        method: 'PUT',
      });

      expect(endpoint.method).toBe('PUT');
    });

    it('should register with allowed IPs', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', {
        allowedIps: ['192.168.1.1', '10.0.0.1'],
      });

      expect(endpoint.allowed_ips).toEqual(['192.168.1.1', '10.0.0.1']);
    });

    it('should throw when no DB configured', async () => {
      const noDbHandler = new WebhookTriggerHandler();
      await expect(
        noDbHandler.registerWebhook('tenant-1', {})
      ).rejects.toThrow('Database not configured');
    });
  });

  // ─── getWebhook ──────────────────────────────────────────────────────────

  describe('getWebhook', () => {
    it('should get webhook by ID', async () => {
      const created = await handler.registerWebhook('tenant-1', { path: '/test' });
      const found = await handler.getWebhook(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent webhook', async () => {
      const found = await handler.getWebhook('non-existent');
      expect(found).toBeUndefined();
    });
  });

  // ─── getWebhookByPath ────────────────────────────────────────────────────

  describe('getWebhookByPath', () => {
    it('should get webhook by path', async () => {
      await handler.registerWebhook('tenant-1', { path: '/webhooks/deploy' });
      const found = await handler.getWebhookByPath('/webhooks/deploy');

      expect(found).toBeDefined();
      expect(found?.path).toBe('/webhooks/deploy');
    });
  });

  // ─── listWebhooks ────────────────────────────────────────────────────────

  describe('listWebhooks', () => {
    it('should list webhooks for tenant', async () => {
      await handler.registerWebhook('tenant-1', { path: '/wh-1' });
      await handler.registerWebhook('tenant-1', { path: '/wh-2' });
      await handler.registerWebhook('tenant-2', { path: '/wh-3' });

      const list = await handler.listWebhooks('tenant-1');
      expect(list.length).toBe(2);
    });

    it('should return empty array for tenant with no webhooks', async () => {
      const list = await handler.listWebhooks('tenant-empty');
      expect(list).toEqual([]);
    });
  });

  // ─── deleteWebhook ───────────────────────────────────────────────────────

  describe('deleteWebhook', () => {
    it('should delete webhook', async () => {
      const created = await handler.registerWebhook('tenant-1', { path: '/to-delete' });
      const deleted = await handler.deleteWebhook(created.id);

      expect(deleted).toBe(true);
      expect(await handler.getWebhook(created.id)).toBeUndefined();
    });

    it('should return false for non-existent webhook', async () => {
      const deleted = await handler.deleteWebhook('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ─── processWebhookEvent ─────────────────────────────────────────────────

  describe('processWebhookEvent', () => {
    it('should process webhook from query path', async () => {
      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/deploy',
        triggerId: 'trigger-1',
      });

      const payload = createPayload({
        query: { path: '/webhooks/deploy' },
        body: { event: 'push' },
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
      expect(result.endpointId).toBeDefined();
    });

    it('should process webhook from body path', async () => {
      await handler.registerWebhook('tenant-1', { path: '/webhooks/build' });

      const payload = createPayload({
        body: { path: '/webhooks/build', data: 'test' },
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
    });

    it('should process webhook from x-webhook-path header', async () => {
      await handler.registerWebhook('tenant-1', { path: '/webhooks/notify' });

      const payload = createPayload({
        headers: { 'x-webhook-path': '/webhooks/notify' },
        body: {},
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
    });

    it('should process webhook from body._meta.path', async () => {
      await handler.registerWebhook('tenant-1', { path: '/webhooks/meta' });

      const payload = createPayload({
        body: { _meta: { path: '/webhooks/meta' } },
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
    });

    it('should return error when no path found', async () => {
      const payload = createPayload({ body: {} });
      const result = await handler.processWebhookEvent(payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No path found');
    });

    it('should return error for unknown path', async () => {
      const payload = createPayload({
        query: { path: '/unknown/path' },
        body: {},
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Webhook endpoint not found');
    });

    it('should reject IP not in allowed list', async () => {
      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/restricted',
        allowedIps: ['192.168.1.1'],
      });

      const payload = createPayload({
        query: { path: '/webhooks/restricted' },
        body: {},
        ip: '10.0.0.1',
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('IP not in allowed list');
    });

    it('should accept IP in allowed list', async () => {
      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/restricted',
        allowedIps: ['192.168.1.1'],
      });

      const payload = createPayload({
        query: { path: '/webhooks/restricted' },
        body: {},
        ip: '192.168.1.1',
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
    });

    it('should reject when IP is missing but allowed list is set', async () => {
      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/restricted',
        allowedIps: ['192.168.1.1'],
      });

      const payload = createPayload({
        query: { path: '/webhooks/restricted' },
        body: {},
        // no ip
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(false);
    });

    it('should increment request count on successful processing', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', { path: '/webhooks/count' });

      await handler.processWebhookEvent(createPayload({
        query: { path: '/webhooks/count' },
        body: {},
      }));

      const updated = await handler.getWebhook(endpoint.id);
      expect(updated?.request_count).toBe(1);
    });

    it('should create event record when trigger is associated', async () => {
      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/with-trigger',
        triggerId: 'trigger-1',
      });

      const result = await handler.processWebhookEvent(createPayload({
        query: { path: '/webhooks/with-trigger' },
        body: { data: 'test' },
      }));

      expect(result.success).toBe(true);
      expect(result.triggerId).toBe('trigger-1');
      expect(result.eventId).toBeDefined();
    });

    it('should increment trigger count when trigger is associated', async () => {
      mockTriggerRepo.addTrigger({
        id: 'trigger-count',
        trigger_count: 0,
      });

      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/trigger-count',
        triggerId: 'trigger-count',
      });

      await handler.processWebhookEvent(createPayload({
        query: { path: '/webhooks/trigger-count' },
        body: {},
      }));

      // trigger count should be incremented
      const trigger = (mockTriggerRepo as any).triggers.get('trigger-count');
      expect(trigger.trigger_count).toBe(1);
    });
  });

  // ─── Signature Verification ──────────────────────────────────────────────

  describe('signature verification', () => {
    it('should reject invalid signature', async () => {
      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/signed',
        secret: 'my-secret',
      });

      const payload = createPayload({
        query: { path: '/webhooks/signed' },
        body: { data: 'test' },
        headers: { 'x-webhook-signature': 'invalid-signature' },
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid webhook signature');
    });

    it('should accept valid signature', async () => {
      const crypto = require('crypto');
      const secret = 'test-secret';
      const body = { data: 'test' };
      const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');

      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/signed',
        secret,
      });

      const payload = createPayload({
        query: { path: '/webhooks/signed' },
        body,
        headers: { 'x-webhook-signature': signature },
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
    });

    it('should skip signature check when no signature header', async () => {
      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/no-sig',
        secret: 'my-secret',
      });

      const payload = createPayload({
        query: { path: '/webhooks/no-sig' },
        body: { data: 'test' },
        // no signature header
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
    });
  });

  // ─── getWebhookHistory ───────────────────────────────────────────────────

  describe('getWebhookHistory', () => {
    it('should return webhook history', async () => {
      await handler.registerWebhook('tenant-1', { path: '/wh-1', triggerId: 'trigger-1' });
      const history = await handler.getWebhookHistory('tenant-1');

      expect(history.length).toBe(1);
      expect(history[0].endpoint).toBeDefined();
      expect(history[0].events).toBeDefined();
    });

    it('should return empty for tenant with no webhooks', async () => {
      const history = await handler.getWebhookHistory('tenant-empty');
      expect(history).toEqual([]);
    });
  });

  // ─── getWebhookEvents ────────────────────────────────────────────────────

  describe('getWebhookEvents', () => {
    it('should return events for webhook with trigger', async () => {
      mockEventRepo.create({
        id: 'evt-1',
        trigger_id: 'trigger-events',
        tenant_id: 'tenant-1',
        event_type: 'webhook',
        event_payload: {},
        evaluation_result: 'matched',
        pipeline_run_id: null,
      });

      mockWebhookRepo.addEndpoint({
        id: 'wh-events',
        tenant_id: 'tenant-1',
        trigger_id: 'trigger-events',
        path: '/wh-events',
      });

      const events = await handler.getWebhookEvents('wh-events');
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for webhook without trigger', async () => {
      mockWebhookRepo.addEndpoint({
        id: 'wh-no-trigger',
        tenant_id: 'tenant-1',
        trigger_id: null,
        path: '/wh-no-trigger',
      });

      const events = await handler.getWebhookEvents('wh-no-trigger');
      expect(events).toEqual([]);
    });

    it('should throw for non-existent webhook', async () => {
      await expect(
        handler.getWebhookEvents('non-existent')
      ).rejects.toThrow('Webhook endpoint not found');
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle webhook with no allowed IPs (accept all)', async () => {
      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/open',
        allowedIps: [],
      });

      const payload = createPayload({
        query: { path: '/webhooks/open' },
        body: {},
        ip: '10.0.0.1',
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
    });

    it('should handle webhook with null allowed_ips', async () => {
      mockWebhookRepo.addEndpoint({
        id: 'wh-null-ips',
        tenant_id: 'tenant-1',
        path: '/webhooks/null-ips',
        allowed_ips: null,
        secret: null,
        request_count: 0,
      });

      const payload = createPayload({
        query: { path: '/webhooks/null-ips' },
        body: {},
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
    });
  });

  // ─── Signature verification - x-signature header ───────────────────────

  describe('signature verification - alternative header', () => {
    it('should accept valid signature with x-signature header', async () => {
      const crypto = require('crypto');
      const secret = 'alt-secret';
      const body = { event: 'push' };
      const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');

      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/alt-sig',
        secret,
      });

      const payload = createPayload({
        query: { path: '/webhooks/alt-sig' },
        body,
        headers: { 'x-signature': signature },
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
    });

    it('should reject invalid signature with x-signature header', async () => {
      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/alt-sig-bad',
        secret: 'my-secret',
      });

      const payload = createPayload({
        query: { path: '/webhooks/alt-sig-bad' },
        body: { data: 'test' },
        headers: { 'x-signature': 'wrong-sig' },
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid webhook signature');
    });
  });

  // ─── processWebhookEvent without trigger_id ────────────────────────────

  describe('processWebhookEvent - no trigger association', () => {
    it('should return success without triggerId when no trigger associated', async () => {
      await handler.registerWebhook('tenant-1', {
        path: '/webhooks/no-trigger',
      });

      const payload = createPayload({
        query: { path: '/webhooks/no-trigger' },
        body: { data: 'test' },
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
      expect(result.triggerId).toBeUndefined();
      expect(result.eventId).toBeUndefined();
    });

    it('should still increment request count without trigger', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', {
        path: '/webhooks/count-no-trigger',
      });

      await handler.processWebhookEvent(createPayload({
        query: { path: '/webhooks/count-no-trigger' },
        body: {},
      }));

      const updated = await handler.getWebhook(endpoint.id);
      expect(updated?.request_count).toBe(1);
    });
  });

  // ─── getWebhookHistory with events ─────────────────────────────────────

  describe('getWebhookHistory with events', () => {
    it('should return history with associated events', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', {
        path: '/webhooks/history',
        triggerId: 'trigger-history',
      });

      // Create events
      await mockEventRepo.create({
        id: 'evt-h1',
        trigger_id: 'trigger-history',
        tenant_id: 'tenant-1',
        event_type: 'webhook',
        event_payload: { data: 'event1' },
        evaluation_result: 'matched',
        pipeline_run_id: null,
      });
      await mockEventRepo.create({
        id: 'evt-h2',
        trigger_id: 'trigger-history',
        tenant_id: 'tenant-1',
        event_type: 'webhook',
        event_payload: { data: 'event2' },
        evaluation_result: 'matched',
        pipeline_run_id: null,
      });

      const history = await handler.getWebhookHistory('tenant-1');
      expect(history.length).toBe(1);
      expect(history[0].events.length).toBe(2);
    });

    it('should return empty events for endpoint without trigger_id', async () => {
      await handler.registerWebhook('tenant-1', { path: '/webhooks/no-trigger-hist' });

      const history = await handler.getWebhookHistory('tenant-1');
      expect(history.length).toBe(1);
      expect(history[0].events).toEqual([]);
    });
  });

  // ─── getWebhookEvents with custom limit ────────────────────────────────

  describe('getWebhookEvents with limit', () => {
    it('should respect custom limit', async () => {
      mockWebhookRepo.addEndpoint({
        id: 'wh-limit',
        tenant_id: 'tenant-1',
        trigger_id: 'trigger-limit',
        path: '/wh-limit',
      });

      for (let i = 0; i < 10; i++) {
        await mockEventRepo.create({
          id: `evt-limit-${i}`,
          trigger_id: 'trigger-limit',
          tenant_id: 'tenant-1',
          event_type: 'webhook',
          event_payload: {},
          evaluation_result: 'matched',
          pipeline_run_id: null,
        });
      }

      const events = await handler.getWebhookEvents('wh-limit', 3);
      expect(events.length).toBe(3);
    });

    it('should use default limit of 50', async () => {
      mockWebhookRepo.addEndpoint({
        id: 'wh-default-limit',
        tenant_id: 'tenant-1',
        trigger_id: 'trigger-default-limit',
        path: '/wh-default-limit',
      });

      const events = await handler.getWebhookEvents('wh-default-limit');
      expect(events.length).toBeLessThanOrEqual(50);
    });
  });

  // ─── No DB configured errors ──────────────────────────────────────────

  describe('no DB configured errors', () => {
    let noDbHandler: WebhookTriggerHandler;

    beforeEach(() => {
      noDbHandler = new WebhookTriggerHandler();
    });

    it('should throw for getWebhook', async () => {
      await expect(noDbHandler.getWebhook('id')).rejects.toThrow('Database not configured');
    });

    it('should throw for getWebhookByPath', async () => {
      await expect(noDbHandler.getWebhookByPath('/path')).rejects.toThrow('Database not configured');
    });

    it('should throw for listWebhooks', async () => {
      await expect(noDbHandler.listWebhooks('tenant')).rejects.toThrow('Database not configured');
    });

    it('should throw for deleteWebhook', async () => {
      await expect(noDbHandler.deleteWebhook('id')).rejects.toThrow('Database not configured');
    });

    it('should throw for processWebhookEvent', async () => {
      await expect(noDbHandler.processWebhookEvent(createPayload())).rejects.toThrow('Database not configured');
    });

    it('should throw for getWebhookHistory', async () => {
      await expect(noDbHandler.getWebhookHistory('tenant')).rejects.toThrow('Database not configured');
    });

    it('should throw for getWebhookEvents', async () => {
      await expect(noDbHandler.getWebhookEvents('id')).rejects.toThrow('Database not configured');
    });
  });

  // ─── registerWebhook edge cases ────────────────────────────────────────

  describe('registerWebhook - edge cases', () => {
    it('should default triggerId to null', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', {});
      expect(endpoint.trigger_id).toBeNull();
    });

    it('should default allowed_ips to empty array', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', {});
      expect(endpoint.allowed_ips).toEqual([]);
    });

    it('should default request_count to 0', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', {});
      expect(endpoint.request_count).toBe(0);
    });

    it('should default last_request_at to null', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', {});
      expect(endpoint.last_request_at).toBeNull();
    });
  });

  // ─── Path extraction priority ──────────────────────────────────────────

  describe('path extraction priority', () => {
    it('should prioritize query path over body path', async () => {
      await handler.registerWebhook('tenant-1', { path: '/webhooks/query-path' });
      await handler.registerWebhook('tenant-1', { path: '/webhooks/body-path' });

      const payload = createPayload({
        query: { path: '/webhooks/query-path' },
        body: { path: '/webhooks/body-path' },
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
      const endpoint = await handler.getWebhookByPath('/webhooks/query-path');
      expect(endpoint?.id).toBe(result.endpointId);
    });

    it('should fall back to header when query and body have no path', async () => {
      await handler.registerWebhook('tenant-1', { path: '/webhooks/header-path' });

      const payload = createPayload({
        headers: { 'x-webhook-path': '/webhooks/header-path' },
        body: {},
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
    });

    it('should fall back to body._meta.path last', async () => {
      await handler.registerWebhook('tenant-1', { path: '/webhooks/meta-path' });

      const payload = createPayload({
        body: { _meta: { path: '/webhooks/meta-path' } },
      });

      const result = await handler.processWebhookEvent(payload);
      expect(result.success).toBe(true);
    });
  });

  // ─── Multiple request count increments ─────────────────────────────────

  describe('request count increments', () => {
    it('should track multiple requests', async () => {
      const endpoint = await handler.registerWebhook('tenant-1', { path: '/webhooks/multi' });

      for (let i = 0; i < 5; i++) {
        await handler.processWebhookEvent(createPayload({
          query: { path: '/webhooks/multi' },
          body: {},
        }));
      }

      const updated = await handler.getWebhook(endpoint.id);
      expect(updated?.request_count).toBe(5);
    });
  });

  // ─── Constructor with triggerService ───────────────────────────────────

  describe('constructor', () => {
    it('should accept triggerService parameter', () => {
      const mockTriggerService = {} as any;
      const h = new WebhookTriggerHandler(undefined, mockTriggerService);
      expect((h as any).triggerService).toBe(mockTriggerService);
    });

    it('should set triggerService to null when not provided', () => {
      const h = new WebhookTriggerHandler();
      expect((h as any).triggerService).toBeNull();
    });
  });
});
