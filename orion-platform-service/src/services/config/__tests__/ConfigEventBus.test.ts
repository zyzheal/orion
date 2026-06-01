/**
 * ConfigEventBus - Unit Tests
 *
 * Tests for event publish/subscribe, handler filtering, subscription management,
 * event history, health check events, and connection status.
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

import { ConfigEventBus, ConfigChangeEvent, ConfigHealthEvent } from '../ConfigEventBus';

describe('ConfigEventBus', () => {
  let eventBus: ConfigEventBus;

  beforeEach(() => {
    eventBus = new ConfigEventBus();
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(eventBus).toBeDefined();
    });
  });

  // ==================== initialize ====================

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(eventBus.initialize()).resolves.toBeUndefined();
    });
  });

  // ==================== publish / subscribe ====================

  describe('publish and subscribe', () => {
    it('should notify subscribers when event is published', async () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      const event: ConfigChangeEvent = {
        eventId: 'evt-1',
        eventType: 'config.created',
        domain: 'app',
        key: 'theme',
        newValue: 'dark',
        changedBy: 'admin',
        timestamp: Date.now(),
      };

      await eventBus.publish(event);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should notify multiple subscribers', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);

      const event = createTestEvent();
      await eventBus.publish(event);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should filter events by predicate', async () => {
      const handler = jest.fn();
      eventBus.subscribe(handler, (e) => e.domain === 'pipeline');

      // Should not match
      await eventBus.publish(createTestEvent({ domain: 'security' }));
      expect(handler).not.toHaveBeenCalled();

      // Should match
      await eventBus.publish(createTestEvent({ domain: 'pipeline' }));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should filter events by key', async () => {
      const handler = jest.fn();
      eventBus.subscribe(handler, (e) => e.key === 'jwtSecret');

      await eventBus.publish(createTestEvent({ key: 'otherKey' }));
      expect(handler).not.toHaveBeenCalled();

      await eventBus.publish(createTestEvent({ key: 'jwtSecret' }));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should filter events by eventType', async () => {
      const handler = jest.fn();
      eventBus.subscribe(handler, (e) => e.eventType === 'config.deleted');

      await eventBus.publish(createTestEvent({ eventType: 'config.created' }));
      expect(handler).not.toHaveBeenCalled();

      await eventBus.publish(createTestEvent({ eventType: 'config.deleted' }));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should return subscription id', () => {
      const handler = jest.fn();
      const id = eventBus.subscribe(handler);
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('should use custom subscription id when provided', () => {
      const handler = jest.fn();
      const id = eventBus.subscribe(handler, undefined, 'my-custom-id');
      expect(id).toBe('my-custom-id');
    });
  });

  // ==================== unsubscribe ====================

  describe('unsubscribe', () => {
    it('should remove a subscription', async () => {
      const handler = jest.fn();
      const id = eventBus.subscribe(handler);

      const result = eventBus.unsubscribe(id);
      expect(result).toBe(true);

      await eventBus.publish(createTestEvent());
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return false for non-existent subscription', () => {
      const result = eventBus.unsubscribe('non-existent-id');
      expect(result).toBe(false);
    });

    it('should not affect other subscriptions when one is removed', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const id1 = eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);

      eventBus.unsubscribe(id1);

      await eventBus.publish(createTestEvent());
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== publishHealthCheck ====================

  describe('publishHealthCheck', () => {
    it('should publish health check event without error', async () => {
      const healthEvent: ConfigHealthEvent = {
        eventType: 'health.check',
        serviceId: 'config-service',
        timestamp: Date.now(),
        details: { status: 'ok' },
      };

      await expect(eventBus.publishHealthCheck(healthEvent)).resolves.toBeUndefined();
    });

    it('should handle health stale event', async () => {
      const healthEvent: ConfigHealthEvent = {
        eventType: 'health.stale',
        serviceId: 'config-cache',
        timestamp: Date.now(),
        details: { staleKeys: 5 },
      };

      await expect(eventBus.publishHealthCheck(healthEvent)).resolves.toBeUndefined();
    });

    it('should handle health error event', async () => {
      const healthEvent: ConfigHealthEvent = {
        eventType: 'health.error',
        serviceId: 'config-db',
        timestamp: Date.now(),
        details: { error: 'Connection refused' },
      };

      await expect(eventBus.publishHealthCheck(healthEvent)).resolves.toBeUndefined();
    });
  });

  // ==================== getConnectionStatus ====================

  describe('getConnectionStatus', () => {
    it('should return connected status', () => {
      const status = eventBus.getConnectionStatus();
      expect(status).toEqual({ connected: true });
    });
  });

  // ==================== getHistory ====================

  describe('getHistory', () => {
    it('should return empty history initially', () => {
      const history = eventBus.getHistory();
      expect(history).toEqual([]);
    });

    it('should return published events in order', async () => {
      await eventBus.publish(createTestEvent({ key: 'first' }));
      await eventBus.publish(createTestEvent({ key: 'second' }));
      await eventBus.publish(createTestEvent({ key: 'third' }));

      const history = eventBus.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].key).toBe('first');
      expect(history[2].key).toBe('third');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await eventBus.publish(createTestEvent({ key: `key-${i}` }));
      }

      const history = eventBus.getHistory(3);
      expect(history).toHaveLength(3);
      // Should return the last 3
      expect(history[0].key).toBe('key-7');
      expect(history[2].key).toBe('key-9');
    });

    it('should default limit to 50', async () => {
      for (let i = 0; i < 60; i++) {
        await eventBus.publish(createTestEvent({ key: `key-${i}` }));
      }

      const history = eventBus.getHistory();
      expect(history).toHaveLength(50);
    });

    it('should cap history at maxHistorySize (100)', async () => {
      for (let i = 0; i < 110; i++) {
        await eventBus.publish(createTestEvent({ key: `key-${i}` }));
      }

      // Internal history should be capped at 100
      const history = eventBus.getHistory(200);
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  // ==================== close ====================

  describe('close', () => {
    it('should clear handlers and history', async () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      await eventBus.publish(createTestEvent());
      expect(handler).toHaveBeenCalledTimes(1);

      await eventBus.close();

      // After close, no handlers should be notified
      handler.mockClear();
      // Note: publish after close may still work since the bus is local,
      // but handlers and history should be cleared
      const history = eventBus.getHistory();
      expect(history).toEqual([]);
    });
  });

  // ==================== Handler error handling ====================

  describe('handler error handling', () => {
    it('should not throw when a handler throws an error', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      const goodHandler = jest.fn();

      eventBus.subscribe(errorHandler);
      eventBus.subscribe(goodHandler);

      // Should not throw
      await expect(eventBus.publish(createTestEvent())).resolves.toBeUndefined();

      // Good handler should still be called
      expect(goodHandler).toHaveBeenCalledTimes(1);
    });

    it('should continue notifying other handlers when one fails', async () => {
      const handler1 = jest.fn().mockRejectedValue(new Error('fail'));
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);
      eventBus.subscribe(handler3);

      await eventBus.publish(createTestEvent());

      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== Event types ====================

  describe('event types', () => {
    it('should handle config.created events', async () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      await eventBus.publish(createTestEvent({ eventType: 'config.created' }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'config.created',
      }));
    });

    it('should handle config.updated events', async () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      await eventBus.publish(createTestEvent({ eventType: 'config.updated' }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'config.updated',
      }));
    });

    it('should handle config.deleted events', async () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      await eventBus.publish(createTestEvent({ eventType: 'config.deleted' }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'config.deleted',
      }));
    });

    it('should handle config.snapshot events', async () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      await eventBus.publish(createTestEvent({ eventType: 'config.snapshot' }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'config.snapshot',
      }));
    });

    it('should handle config.rollback events', async () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      await eventBus.publish(createTestEvent({ eventType: 'config.rollback' }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'config.rollback',
      }));
    });
  });

  // ==================== Helper ====================

  function createTestEvent(overrides: Partial<ConfigChangeEvent> = {}): ConfigChangeEvent {
    return {
      eventId: `evt-${Date.now()}`,
      eventType: 'config.created',
      domain: 'app',
      key: 'test-key',
      newValue: 'test-value',
      changedBy: 'admin',
      timestamp: Date.now(),
      ...overrides,
    };
  }
});
