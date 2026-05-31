/**
 * EventBus 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, eventBus } from '@orion-mf/core';

describe('EventBus', () => {
  let bus: any;

  beforeEach(() => {
    bus = new (EventBus as any)();
  });

  describe('on / emit', () => {
    it('should call handler when event is emitted', () => {
      const handler = vi.fn();
      bus.on('test-event', handler);
      bus.emit('test-event', { data: 'hello' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ data: 'hello' });
    });

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.on('multi', handler1);
      bus.on('multi', handler2);
      bus.emit('multi', 'payload');

      expect(handler1).toHaveBeenCalledWith('payload');
      expect(handler2).toHaveBeenCalledWith('payload');
    });

    it('should support same handler for different events', () => {
      const handler = vi.fn();
      bus.on('event-a', handler);
      bus.on('event-b', handler);
      bus.emit('event-a', 'a');
      bus.emit('event-b', 'b');

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, 'a');
      expect(handler).toHaveBeenNthCalledWith(2, 'b');
    });
  });

  describe('off', () => {
    it('should remove handler from event', () => {
      const handler = vi.fn();
      bus.on('remove-test', handler);
      bus.off('remove-test', handler);
      bus.emit('remove-test');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not affect other handlers when removing one', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.on('shared', handler1);
      bus.on('shared', handler2);
      bus.off('shared', handler1);
      bus.emit('shared', 'data');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith('data');
    });

    it('should handle off for non-existent event gracefully', () => {
      // Should not throw
      expect(() => bus.off('non-existent', () => {})).not.toThrow();
    });
  });

  describe('once', () => {
    it('should call handler only once', () => {
      const handler = vi.fn();
      bus.once('once-event', handler);
      bus.emit('once-event', 1);
      bus.emit('once-event', 2);
      bus.emit('once-event', 3);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(1);
    });
  });

  describe('clear', () => {
    it('should remove all event handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.on('event-1', handler1);
      bus.on('event-2', handler2);
      bus.clear();
      bus.emit('event-1');
      bus.emit('event-2');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('should return correct number of listeners', () => {
      expect(bus.listenerCount('count-event')).toBe(0);

      const h1 = () => {};
      const h2 = () => {};
      bus.on('count-event', h1);
      bus.on('count-event', h2);

      expect(bus.listenerCount('count-event')).toBe(2);

      bus.off('count-event', h1);
      expect(bus.listenerCount('count-event')).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should catch and log handler errors without breaking other handlers', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const goodHandler = vi.fn();
      const badHandler = () => {
        throw new Error('Handler error');
      };

      bus.on('error-event', badHandler);
      bus.on('error-event', goodHandler);
      bus.emit('error-event', 'data');

      expect(goodHandler).toHaveBeenCalledWith('data');
      expect(consoleError).toHaveBeenCalledWith(
        '[EventBus] Error in handler for event "error-event":',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('global eventBus instance', () => {
    it('should export a singleton eventBus instance', () => {
      expect(eventBus).toBeDefined();
      expect(typeof (eventBus as any).on).toBe('function');
      expect(typeof (eventBus as any).emit).toBe('function');
      expect(typeof (eventBus as any).off).toBe('function');
      expect(typeof (eventBus as any).once).toBe('function');
      expect(typeof (eventBus as any).clear).toBe('function');
      expect(typeof (eventBus as any).listenerCount).toBe('function');
    });
  });
});
