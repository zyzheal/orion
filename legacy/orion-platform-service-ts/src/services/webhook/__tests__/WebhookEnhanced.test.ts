/**
 * Webhook Enhanced Service Tests
 *
 * Tests for subscription model and dispatcher functionality.
 */

import { WebhookServiceEnhanced, BACKOFF_DELAYS } from '../WebhookService';
import { WebhookRepositoryEnhanced, WebhookEndpoint, WebhookSubscription, WebhookDeliveryEnhanced } from '../WebhookRepository';

// Mock database pool
const mockPool = {
  query: jest.fn(),
};

// Create test instance with mocked repository
const createEnhancedService = (): { service: WebhookServiceEnhanced; mockRepo: jest.Mocked<WebhookRepositoryEnhanced> } => {
  const mockRepo = {
    createEndpoint: jest.fn(),
    findEndpointById: jest.fn(),
    listEndpoints: jest.fn(),
    updateEndpoint: jest.fn(),
    deleteEndpoint: jest.fn(),
    createSubscription: jest.fn(),
    findSubscriptionById: jest.fn(),
    findSubscriptionsByEvent: jest.fn(),
    findSubscriptionsByEndpoint: jest.fn(),
    updateSubscription: jest.fn(),
    deleteSubscription: jest.fn(),
    recordDelivery: jest.fn(),
    findDeliveryById: jest.fn(),
    updateDelivery: jest.fn(),
    findPendingDeliveries: jest.fn(),
    findDeliveriesBySubscription: jest.fn(),
    getEndpointWithSubscriptions: jest.fn(),
  } as unknown as jest.Mocked<WebhookRepositoryEnhanced>;

  return {
    service: new WebhookServiceEnhanced(mockRepo),
    mockRepo,
  };
};

describe('WebhookServiceEnhanced', () => {
  let service: WebhookServiceEnhanced;
  let mockRepo: jest.Mocked<WebhookRepositoryEnhanced>;

  beforeEach(() => {
    const { service: s, mockRepo: r } = createEnhancedService();
    service = s;
    mockRepo = r;
  });

  describe('getNestedValue', () => {
    it('should get nested value using dot notation', () => {
      const obj = { a: { b: { c: 'hello' } }, d: 'world' };

      expect(service.getNestedValue(obj, 'a.b.c')).toBe('hello');
      expect(service.getNestedValue(obj, 'd')).toBe('world');
      expect(service.getNestedValue(obj, 'a.b')).toEqual({ c: 'hello' });
    });

    it('should return undefined for non-existent paths', () => {
      const obj = { a: { b: 1 } };

      expect(service.getNestedValue(obj, 'x.y.z')).toBeUndefined();
      expect(service.getNestedValue(obj, 'a.c')).toBeUndefined();
    });

    it('should handle null/undefined objects', () => {
      expect(service.getNestedValue(null as any, 'a.b')).toBeUndefined();
      expect(service.getNestedValue(undefined as any, 'a.b')).toBeUndefined();
    });
  });

  describe('matchesFilters', () => {
    it('should match simple equality filters', () => {
      const payload = { status: 'success', level: 'info' };

      expect(service.matchesFilters(payload, { status: 'success' })).toBe(true);
      expect(service.matchesFilters(payload, { status: 'failed' })).toBe(false);
    });

    it('should match eq operator', () => {
      const payload = { count: 10 };

      expect(service.matchesFilters(payload, { count: { eq: 10 } })).toBe(true);
      expect(service.matchesFilters(payload, { count: { eq: 20 } })).toBe(false);
    });

    it('should match ne operator', () => {
      const payload = { count: 10 };

      expect(service.matchesFilters(payload, { count: { ne: 20 } })).toBe(true);
      expect(service.matchesFilters(payload, { count: { ne: 10 } })).toBe(false);
    });

    it('should match gt/gte operators', () => {
      const payload = { count: 10 };

      expect(service.matchesFilters(payload, { count: { gt: 5 } })).toBe(true);
      expect(service.matchesFilters(payload, { count: { gt: 10 } })).toBe(false);
      expect(service.matchesFilters(payload, { count: { gte: 10 } })).toBe(true);
      expect(service.matchesFilters(payload, { count: { gte: 11 } })).toBe(false);
    });

    it('should match lt/lte operators', () => {
      const payload = { count: 10 };

      expect(service.matchesFilters(payload, { count: { lt: 20 } })).toBe(true);
      expect(service.matchesFilters(payload, { count: { lt: 10 } })).toBe(false);
      expect(service.matchesFilters(payload, { count: { lte: 10 } })).toBe(true);
      expect(service.matchesFilters(payload, { count: { lte: 9 } })).toBe(false);
    });

    it('should match in/nin operators', () => {
      const payload = { status: 'success' };

      expect(service.matchesFilters(payload, { status: { in: ['success', 'pending'] } })).toBe(true);
      expect(service.matchesFilters(payload, { status: { in: ['failed', 'pending'] } })).toBe(false);
      expect(service.matchesFilters(payload, { status: { nin: ['failed', 'pending'] } })).toBe(true);
      expect(service.matchesFilters(payload, { status: { nin: ['success', 'pending'] } })).toBe(false);
    });

    it('should match exists operator', () => {
      const payload = { present: 'value', absent: null };

      expect(service.matchesFilters(payload, { present: { exists: true } })).toBe(true);
      expect(service.matchesFilters(payload, { absent: { exists: true } })).toBe(false);
      expect(service.matchesFilters(payload, { absent: { exists: false } })).toBe(true);
      expect(service.matchesFilters(payload, { missing: { exists: false } })).toBe(true);
    });

    it('should match contains operator', () => {
      const payload = { message: 'Hello World' };

      expect(service.matchesFilters(payload, { message: { contains: 'Hello' } })).toBe(true);
      expect(service.matchesFilters(payload, { message: { contains: 'Goodbye' } })).toBe(false);
    });

    it('should match nested field filters', () => {
      const payload = { user: { role: 'admin', level: 5 } };

      expect(service.matchesFilters(payload, { 'user.role': 'admin' })).toBe(true);
      expect(service.matchesFilters(payload, { 'user.role': 'user' })).toBe(false);
      expect(service.matchesFilters(payload, { 'user.level': { gte: 3 } })).toBe(true);
    });

    it('should return true for empty filters', () => {
      const payload = { any: 'value' };

      expect(service.matchesFilters(payload, {})).toBe(true);
    });

    it('should match multiple filters with AND logic', () => {
      const payload = { status: 'success', count: 10 };

      expect(service.matchesFilters(payload, { status: 'success', count: { gt: 5 } })).toBe(true);
      expect(service.matchesFilters(payload, { status: 'failed', count: { gt: 5 } })).toBe(false);
    });
  });

  describe('dispatch', () => {
    const mockEndpoint: WebhookEndpoint = {
      id: 'endpoint-1',
      name: 'Test Endpoint',
      url: 'https://example.com/webhook',
      secret: 'test-secret',
      auth_type: 'none',
      auth_config: null,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const mockSubscription: WebhookSubscription = {
      id: 'sub-1',
      endpoint_id: 'endpoint-1',
      event_type: 'deployment.complete',
      filters: null,
      active: true,
      created_at: new Date(),
    };

    const mockDelivery: WebhookDeliveryEnhanced = {
      id: 'delivery-1',
      subscription_id: 'sub-1',
      event_id: 'event-1',
      payload: {},
      status: 'pending',
      attempt: 0,
      max_attempts: 5,
      next_retry_at: null,
      response_status: null,
      response_body: null,
      error_message: null,
      created_at: new Date(),
      delivered_at: null,
    };

    beforeEach(() => {
      mockRepo.findSubscriptionsByEvent.mockResolvedValue([mockSubscription]);
      mockRepo.getEndpointWithSubscriptions.mockResolvedValue({
        endpoint: mockEndpoint,
        subscriptions: [mockSubscription],
      });
      mockRepo.recordDelivery.mockResolvedValue(mockDelivery);
      mockRepo.updateDelivery.mockResolvedValue(mockDelivery);
    });

    it('should dispatch to matching subscriptions', async () => {
      const result = await service.dispatch('deployment.complete', 'event-1', { deployment: 'test' });

      expect(result).toBe(1);
      expect(mockRepo.findSubscriptionsByEvent).toHaveBeenCalledWith('deployment.complete', true);
      expect(mockRepo.recordDelivery).toHaveBeenCalled();
    });

    it('should filter out subscriptions with non-matching filters', async () => {
      const subscriptionWithFilter: WebhookSubscription = {
        ...mockSubscription,
        id: 'sub-2',
        filters: { status: 'success' },
      };

      mockRepo.findSubscriptionsByEvent.mockResolvedValue([subscriptionWithFilter]);

      // Payload doesn't match filter
      const result = await service.dispatch('deployment.complete', 'event-1', { status: 'failed' });

      expect(result).toBe(0);
      expect(mockRepo.recordDelivery).not.toHaveBeenCalled();
    });

    it('should filter out inactive endpoints', async () => {
      const inactiveEndpoint: WebhookEndpoint = { ...mockEndpoint, status: 'inactive' };
      mockRepo.getEndpointWithSubscriptions.mockResolvedValue({
        endpoint: inactiveEndpoint,
        subscriptions: [mockSubscription],
      });

      const result = await service.dispatch('deployment.complete', 'event-1', {});

      expect(result).toBe(0);
      expect(mockRepo.recordDelivery).not.toHaveBeenCalled();
    });

    it('should handle multiple subscriptions', async () => {
      const subscription2: WebhookSubscription = {
        ...mockSubscription,
        id: 'sub-2',
        endpoint_id: 'endpoint-2',
      };
      const endpoint2: WebhookEndpoint = { ...mockEndpoint, id: 'endpoint-2' };

      mockRepo.findSubscriptionsByEvent.mockResolvedValue([mockSubscription, subscription2]);
      mockRepo.getEndpointWithSubscriptions
        .mockResolvedValueOnce({ endpoint: mockEndpoint, subscriptions: [mockSubscription] })
        .mockResolvedValueOnce({ endpoint: endpoint2, subscriptions: [subscription2] });

      const result = await service.dispatch('deployment.complete', 'event-1', {});

      expect(result).toBe(2);
      expect(mockRepo.recordDelivery).toHaveBeenCalledTimes(2);
    });

    it('should skip subscriptions with matching filters', async () => {
      const subscriptionWithFilter: WebhookSubscription = {
        ...mockSubscription,
        filters: { 'metadata.environment': 'prod' },
      };

      mockRepo.findSubscriptionsByEvent.mockResolvedValue([subscriptionWithFilter]);
      mockRepo.getEndpointWithSubscriptions.mockResolvedValue({
        endpoint: mockEndpoint,
        subscriptions: [subscriptionWithFilter],
      });

      // Payload matches filter
      const result = await service.dispatch('deployment.complete', 'event-1', {
        metadata: { environment: 'prod' },
      });

      expect(result).toBe(1);
      expect(mockRepo.recordDelivery).toHaveBeenCalled();
    });
  });

  describe('BACKOFF_DELAYS', () => {
    it('should have correct initial delays', () => {
      expect(BACKOFF_DELAYS[0]).toBe(1000);    // 1s
      expect(BACKOFF_DELAYS[1]).toBe(2000);    // 2s
      expect(BACKOFF_DELAYS[2]).toBe(4000);    // 4s
      expect(BACKOFF_DELAYS[3]).toBe(8000);    // 8s
      expect(BACKOFF_DELAYS[4]).toBe(16000);   // 16s
    });

    it('should include max delay of 1 hour', () => {
      expect(BACKOFF_DELAYS).toContain(3600000);
    });

    it('should follow exponential pattern', () => {
      for (let i = 1; i < BACKOFF_DELAYS.length - 1; i++) {
        expect(BACKOFF_DELAYS[i]).toBe(BACKOFF_DELAYS[i - 1] * 2);
      }
    });
  });
});

describe('HMAC Signature Generation', () => {
  let service: WebhookServiceEnhanced;
  let mockRepo: jest.Mocked<WebhookRepositoryEnhanced>;

  beforeEach(() => {
    const { service: s, mockRepo: r } = createEnhancedService();
    service = s;
    mockRepo = r;
  });

  it('should generate consistent HMAC signatures', () => {
    const crypto = require('crypto');
    const secret = 'test-secret';
    const payload = JSON.stringify({ event: 'test', payload: { data: 'value' } });

    const signature1 = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const signature2 = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    expect(signature1).toBe(signature2);
  });

  it('should generate different signatures for different payloads', () => {
    const crypto = require('crypto');
    const secret = 'test-secret';

    const sig1 = crypto.createHmac('sha256', secret).update('payload1').digest('hex');
    const sig2 = crypto.createHmac('sha256', secret).update('payload2').digest('hex');

    expect(sig1).not.toBe(sig2);
  });

  it('should generate different signatures for different secrets', () => {
    const crypto = require('crypto');
    const payload = 'test-payload';

    const sig1 = crypto.createHmac('sha256', 'secret1').update(payload).digest('hex');
    const sig2 = crypto.createHmac('sha256', 'secret2').update(payload).digest('hex');

    expect(sig1).not.toBe(sig2);
  });
});

describe('Endpoint Management', () => {
  let service: WebhookServiceEnhanced;
  let mockRepo: jest.Mocked<WebhookRepositoryEnhanced>;

  beforeEach(() => {
    const { service: s, mockRepo: r } = createEnhancedService();
    service = s;
    mockRepo = r;
  });

  it('should create endpoint with required fields', async () => {
    const input = {
      name: 'My Endpoint',
      url: 'https://example.com/webhook',
    };

    const created: WebhookEndpoint = {
      ...input,
      id: 'new-id',
      secret: null,
      auth_type: 'none',
      auth_config: null,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockRepo.createEndpoint.mockResolvedValue(created);

    const result = await service.createEndpoint(input);

    expect(result.name).toBe('My Endpoint');
    expect(mockRepo.createEndpoint).toHaveBeenCalledWith(input);
  });

  it('should throw error when creating endpoint without name', async () => {
    await expect(
      service.createEndpoint({ name: '', url: 'https://example.com' })
    ).rejects.toThrow('Name and URL are required');
  });

  it('should throw error when creating endpoint without url', async () => {
    await expect(
      service.createEndpoint({ name: 'Test', url: '' })
    ).rejects.toThrow('Name and URL are required');
  });

  it('should get endpoint by id', async () => {
    const endpoint: WebhookEndpoint = {
      id: 'endpoint-1',
      name: 'Test',
      url: 'https://example.com',
      secret: null,
      auth_type: 'none',
      auth_config: null,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    mockRepo.findEndpointById.mockResolvedValue(endpoint);

    const result = await service.getEndpoint('endpoint-1');

    expect(result.id).toBe('endpoint-1');
  });

  it('should throw error when endpoint not found', async () => {
    mockRepo.findEndpointById.mockResolvedValue(null);

    await expect(service.getEndpoint('nonexistent')).rejects.toThrow('Endpoint not found');
  });
});

describe('Subscription Management', () => {
  let service: WebhookServiceEnhanced;
  let mockRepo: jest.Mocked<WebhookRepositoryEnhanced>;

  beforeEach(() => {
    const { service: s, mockRepo: r } = createEnhancedService();
    service = s;
    mockRepo = r;
  });

  it('should create subscription when endpoint exists', async () => {
    const endpoint: WebhookEndpoint = {
      id: 'endpoint-1',
      name: 'Test',
      url: 'https://example.com',
      secret: null,
      auth_type: 'none',
      auth_config: null,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const subscription: WebhookSubscription = {
      id: 'sub-1',
      endpoint_id: 'endpoint-1',
      event_type: 'deployment.complete',
      filters: null,
      active: true,
      created_at: new Date(),
    };

    mockRepo.findEndpointById.mockResolvedValue(endpoint);
    mockRepo.createSubscription.mockResolvedValue(subscription);

    const result = await service.createSubscription({
      endpoint_id: 'endpoint-1',
      event_type: 'deployment.complete',
    });

    expect(result.event_type).toBe('deployment.complete');
  });

  it('should throw error when endpoint not found', async () => {
    mockRepo.findEndpointById.mockResolvedValue(null);

    await expect(
      service.createSubscription({
        endpoint_id: 'nonexistent',
        event_type: 'test.event',
      })
    ).rejects.toThrow('Endpoint not found');
  });

  it('should throw error when required fields missing', async () => {
    await expect(
      service.createSubscription({
        endpoint_id: '',
        event_type: 'test.event',
      })
    ).rejects.toThrow('Endpoint ID and event type are required');
  });
});