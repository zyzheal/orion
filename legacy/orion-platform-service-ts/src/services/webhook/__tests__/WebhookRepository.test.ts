/**
 * WebhookRepository - 数据仓库层单元测试
 *
 * 测试覆盖: Webhook CRUD、投递记录、增强版端点/订阅/投递
 */

import { WebhookRepository, WebhookRepositoryEnhanced } from '../WebhookRepository';

describe('WebhookRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: WebhookRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new WebhookRepository(mockDb as any);
  });

  // ==================== Legacy Webhook CRUD ====================

  describe('findById', () => {
    it('should return webhook by id', async () => {
      const mockRow = { id: 'wh-1', name: 'Test', active: true };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findById('wh-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('wh-1');
      expect(result!.enabled).toBe(true); // mapped from 'active'
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all webhooks for tenant', async () => {
      const mockRows = [
        { id: 'wh1', active: true },
        { id: 'wh2', active: false },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.findAll('t1');

      expect(result).toHaveLength(2);
      expect(result[0].enabled).toBe(true);
      expect(result[1].enabled).toBe(false);
    });
  });

  describe('create', () => {
    it('should create a webhook', async () => {
      const mockRow = { id: 'wh-1', name: 'Test', url: 'https://example.com', active: true };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.create('t1', 'Test', 'https://example.com', ['push']);

      expect(result).toBeDefined();
      expect(result.enabled).toBe(true);
    });

    it('should create webhook with secret', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'wh-1', active: true }] });

      await repository.create('t1', 'Test', 'https://example.com', ['push'], 'secret123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webhooks'),
        ['t1', 'Test', 'https://example.com', ['push'], 'secret123']
      );
    });
  });

  describe('update', () => {
    it('should update webhook name', async () => {
      const mockRow = { id: 'wh-1', name: 'Updated', active: true };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.update('wh-1', { name: 'Updated' });

      expect(result!.name).toBe('Updated');
    });

    it('should update webhook enabled state', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'wh-1', active: false }] });

      const result = await repository.update('wh-1', { enabled: false });

      expect(result!.enabled).toBe(false);
    });

    it('should return current webhook when no updates', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'wh-1', active: true }] });

      const result = await repository.update('wh-1', {});

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.update('non-existent', { name: 'New' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing webhook', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('wh-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('recordDelivery', () => {
    it('should record a delivery', async () => {
      const mockRow = {
        id: 'del-1',
        webhook_id: 'wh-1',
        event_type: 'push',
        payload: { ref: 'main' },
        status: 'pending',
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.recordDelivery('wh-1', 'push', { ref: 'main' });

      expect(result).toBeDefined();
      expect(result.event).toBe('push'); // mapped from event_type
    });
  });

  describe('markDelivered', () => {
    it('should mark delivery as delivered', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.markDelivered('del-1', 200, 'OK');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'delivered'"),
        [200, 'OK', 'del-1']
      );
    });
  });

  describe('findDeliveriesByWebhook', () => {
    it('should return deliveries for webhook', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'del1' }] });

      const result = await repository.findDeliveriesByWebhook('wh-1');

      expect(result).toHaveLength(1);
    });

    it('should apply custom limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findDeliveriesByWebhook('wh-1', 10);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['wh-1', 10]
      );
    });
  });

  describe('findByTenantAndName', () => {
    it('should find webhook by tenant and name', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'wh-1', active: true }] });

      const result = await repository.findByTenantAndName('t1', 'Test');

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findByTenantAndName('t1', 'NonExistent');

      expect(result).toBeNull();
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate connection refused errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repository.findById('wh-1')).rejects.toThrow('Connection refused');
    });

    it('should propagate timeout errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Query timeout'));

      await expect(repository.create('t1', 'Test', 'https://example.com', ['push'])).rejects.toThrow('Query timeout');
    });
  });
});

describe('WebhookRepositoryEnhanced', () => {
  let mockDb: { query: jest.Mock };
  let repository: WebhookRepositoryEnhanced;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new WebhookRepositoryEnhanced(mockDb as any);
  });

  // ==================== Endpoints ====================

  describe('createEndpoint', () => {
    it('should create an endpoint', async () => {
      const mockRow = { id: 'ep-1', name: 'Test', url: 'https://example.com', status: 'active' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.createEndpoint({
        name: 'Test',
        url: 'https://example.com',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('active');
    });

    it('should create endpoint with auth', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ep-1' }] });

      await repository.createEndpoint({
        name: 'Test',
        url: 'https://example.com',
        auth_type: 'bearer',
        auth_config: { token: 'xxx' },
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webhook_endpoints'),
        expect.arrayContaining(['bearer', '{"token":"xxx"}'])
      );
    });
  });

  describe('findEndpointById', () => {
    it('should return endpoint by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ep-1' }] });

      const result = await repository.findEndpointById('ep-1');

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findEndpointById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listEndpoints', () => {
    it('should list all endpoints', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ep1' }, { id: 'ep2' }] });

      const result = await repository.listEndpoints();

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.listEndpoints('active');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['active']
      );
    });
  });

  describe('updateEndpoint', () => {
    it('should update endpoint', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ep-1' }] });

      const result = await repository.updateEndpoint('ep-1', { name: 'Updated' });

      expect(result).toBeDefined();
    });

    it('should return current endpoint when no updates', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ep-1' }] });

      const result = await repository.updateEndpoint('ep-1', {});

      expect(result).toBeDefined();
    });
  });

  describe('deleteEndpoint', () => {
    it('should delete an endpoint', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteEndpoint('ep-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteEndpoint('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== Subscriptions ====================

  describe('createSubscription', () => {
    it('should create a subscription', async () => {
      const mockRow = { id: 'sub-1', endpoint_id: 'ep-1', event_type: 'push', active: true };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.createSubscription({
        endpoint_id: 'ep-1',
        event_type: 'push',
      });

      expect(result).toBeDefined();
      expect(result.active).toBe(true);
    });

    it('should create subscription with filters', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'sub-1' }] });

      await repository.createSubscription({
        endpoint_id: 'ep-1',
        event_type: 'push',
        filters: { branch: 'main' },
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webhook_subscriptions'),
        expect.arrayContaining(['ep-1', 'push', '{"branch":"main"}', true])
      );
    });
  });

  describe('findSubscriptionById', () => {
    it('should return subscription by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'sub-1' }] });

      const result = await repository.findSubscriptionById('sub-1');

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findSubscriptionById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findSubscriptionsByEvent', () => {
    it('should return subscriptions for event', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'sub-1' }] });

      const result = await repository.findSubscriptionsByEvent('push');

      expect(result).toHaveLength(1);
    });

    it('should filter active only by default', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findSubscriptionsByEvent('push');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('s.active = true'),
        expect.arrayContaining(['push', 'active'])
      );
    });

    it('should include inactive when specified', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findSubscriptionsByEvent('push', false);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.not.stringContaining('s.active = true'),
        ['push']
      );
    });
  });

  describe('findSubscriptionsByEndpoint', () => {
    it('should return subscriptions for endpoint', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'sub-1' }] });

      const result = await repository.findSubscriptionsByEndpoint('ep-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'sub-1' }] });

      const result = await repository.updateSubscription('sub-1', { active: false });

      expect(result).toBeDefined();
    });

    it('should return current subscription when no updates', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'sub-1' }] });

      const result = await repository.updateSubscription('sub-1', {});

      expect(result).toBeDefined();
    });
  });

  describe('deleteSubscription', () => {
    it('should delete a subscription', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteSubscription('sub-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteSubscription('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== Deliveries ====================

  describe('recordDelivery', () => {
    it('should record a delivery', async () => {
      const mockRow = { id: 'del-1', subscription_id: 'sub-1', status: 'pending' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.recordDelivery({
        subscription_id: 'sub-1',
        event_id: 'evt-1',
        payload: { ref: 'main' },
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
    });
  });

  describe('findDeliveryById', () => {
    it('should return delivery by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'del-1' }] });

      const result = await repository.findDeliveryById('del-1');

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findDeliveryById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateDelivery', () => {
    it('should update delivery status', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'del-1' }] });

      const result = await repository.updateDelivery('del-1', { status: 'delivered' });

      expect(result).toBeDefined();
    });

    it('should update delivery with all fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'del-1' }] });

      await repository.updateDelivery('del-1', {
        status: 'delivered',
        attempt: 1,
        response_status: 200,
        response_body: 'OK',
        delivered_at: new Date(),
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('delivered_at'),
        expect.arrayContaining(['delivered', 1, 200, 'OK', expect.any(Date), 'del-1'])
      );
    });

    it('should return current delivery when no updates', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'del-1' }] });

      const result = await repository.updateDelivery('del-1', {});

      expect(result).toBeDefined();
    });
  });

  describe('findPendingDeliveries', () => {
    it('should return pending deliveries', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'del-1' }] });

      const result = await repository.findPendingDeliveries();

      expect(result).toHaveLength(1);
    });

    it('should apply custom limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findPendingDeliveries(10);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1'),
        [10]
      );
    });
  });

  describe('findDeliveriesBySubscription', () => {
    it('should return deliveries for subscription', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'del-1' }] });

      const result = await repository.findDeliveriesBySubscription('sub-1');

      expect(result).toHaveLength(1);
    });

    it('should apply custom limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findDeliveriesBySubscription('sub-1', 10);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['sub-1', 10]
      );
    });
  });

  describe('getEndpointWithSubscriptions', () => {
    it('should return endpoint with subscriptions', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'ep-1' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'sub-1' }] });

      const result = await repository.getEndpointWithSubscriptions('ep-1');

      expect(result.endpoint).toBeDefined();
      expect(result.subscriptions).toHaveLength(1);
    });

    it('should return null endpoint when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.getEndpointWithSubscriptions('non-existent');

      expect(result.endpoint).toBeNull();
      expect(result.subscriptions).toEqual([]);
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate connection refused errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repository.findEndpointById('ep-1')).rejects.toThrow('Connection refused');
    });

    it('should propagate timeout errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Query timeout'));

      await expect(repository.createEndpoint({ name: 'Test', url: 'https://example.com' })).rejects.toThrow('Query timeout');
    });
  });
});
