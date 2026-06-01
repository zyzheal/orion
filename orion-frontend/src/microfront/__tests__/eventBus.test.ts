/**
 * EventBus 单元测试
 *
 * 测试 @orion-mf/core 的 Channel-based EventBus API。
 * EventBus 管理 Channel，Channel 提供 on/off/emit/clear/getListenerCount。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, eventBus } from '@orion-mf/core';

describe('EventBus', () => {
  let bus: InstanceType<typeof EventBus>;
  let channel: ReturnType<typeof bus.createChannel>;

  beforeEach(() => {
    // Use resetForTest to get a fresh instance each test
    (EventBus as any).resetForTest();
    bus = (EventBus as any).getInstance();
    channel = bus.createChannel('test-channel');
  });

  describe('Channel on / emit', () => {
    it('should call handler when event is emitted', () => {
      const handler = vi.fn();
      channel.on('test-event', handler);
      channel.emit('test-event', { data: 'hello' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        event: 'test-event',
        data: { data: 'hello' },
        version: expect.any(String),
      });
    });

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      channel.on('multi', handler1);
      channel.on('multi', handler2);
      channel.emit('multi', 'payload');

      expect(handler1).toHaveBeenCalledWith({
        event: 'multi',
        data: 'payload',
        version: expect.any(String),
      });
      expect(handler2).toHaveBeenCalledWith({
        event: 'multi',
        data: 'payload',
        version: expect.any(String),
      });
    });

    it('should support same handler for different events', () => {
      const handler = vi.fn();
      channel.on('event-a', handler);
      channel.on('event-b', handler);
      channel.emit('event-a', 'a');
      channel.emit('event-b', 'b');

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, {
        event: 'event-a',
        data: 'a',
        version: expect.any(String),
      });
      expect(handler).toHaveBeenNthCalledWith(2, {
        event: 'event-b',
        data: 'b',
        version: expect.any(String),
      });
    });

    it('should return an unsubscribe function from on()', () => {
      const handler = vi.fn();
      const unsub = channel.on('unsub-test', handler);
      channel.emit('unsub-test', 'before');
      unsub();
      channel.emit('unsub-test', 'after');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        event: 'unsub-test',
        data: 'before',
        version: expect.any(String),
      });
    });
  });

  describe('Channel off', () => {
    it('should remove handler from event', () => {
      const handler = vi.fn();
      channel.on('remove-test', handler);
      channel.off('remove-test', handler);
      channel.emit('remove-test');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not affect other handlers when removing one', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      channel.on('shared', handler1);
      channel.on('shared', handler2);
      channel.off('shared', handler1);
      channel.emit('shared', 'data');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith({
        event: 'shared',
        data: 'data',
        version: expect.any(String),
      });
    });

    it('should handle off for non-existent event gracefully', () => {
      // Should not throw
      expect(() => channel.off('non-existent', () => {})).not.toThrow();
    });
  });

  describe('Channel clear', () => {
    it('should remove all event handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      channel.on('event-1', handler1);
      channel.on('event-2', handler2);
      channel.clear();
      channel.emit('event-1');
      channel.emit('event-2');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('Channel getListenerCount', () => {
    it('should return correct number of listeners', () => {
      expect(channel.getListenerCount('count-event')).toBe(0);

      const h1 = () => {};
      const h2 = () => {};
      channel.on('count-event', h1);
      channel.on('count-event', h2);

      expect(channel.getListenerCount('count-event')).toBe(2);

      channel.off('count-event', h1);
      expect(channel.getListenerCount('count-event')).toBe(1);
    });
  });

  describe('Channel error handling', () => {
    it('should catch and log handler errors without breaking other handlers', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const goodHandler = vi.fn();
      const badHandler = () => {
        throw new Error('Handler error');
      };

      channel.on('error-event', badHandler);
      channel.on('error-event', goodHandler);
      channel.emit('error-event', 'data');

      expect(goodHandler).toHaveBeenCalledWith({
        event: 'error-event',
        data: 'data',
        version: expect.any(String),
      });
      expect(consoleError).toHaveBeenCalledWith(
        '[EventBus] Handler error for event "error-event":',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('Channel with owner', () => {
    it('should support owner-based cleanup', () => {
      const handler = vi.fn();
      channel.on('owned-event', handler, 'my-app');
      channel.clearByOwner('my-app');
      channel.emit('owned-event', 'data');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('EventBus channel management', () => {
    it('should create and retrieve channels', () => {
      const ch1 = bus.createChannel('ch1');
      const ch2 = bus.getChannel('ch1');
      expect(ch2).toBe(ch1);
    });

    it('should return undefined for non-existent channel', () => {
      expect(bus.getChannel('nope')).toBeUndefined();
    });

    it('should list channel keys', () => {
      bus.createChannel('a');
      bus.createChannel('b');
      expect(bus.getChannelKeys()).toEqual(expect.arrayContaining(['a', 'b']));
    });

    it('should remove a channel', () => {
      bus.createChannel('removable');
      bus.removeChannel('removable');
      expect(bus.getChannel('removable')).toBeUndefined();
    });

    it('should clear all channels', () => {
      bus.createChannel('x');
      bus.createChannel('y');
      bus.clearAll();
      expect(bus.getChannelKeys()).toEqual([]);
    });
  });

  describe('global eventBus instance', () => {
    it('should export a singleton eventBus instance', () => {
      expect(eventBus).toBeDefined();
      expect(typeof (eventBus as any).createChannel).toBe('function');
      expect(typeof (eventBus as any).getChannel).toBe('function');
      expect(typeof (eventBus as any).removeChannel).toBe('function');
      expect(typeof (eventBus as any).clearAll).toBe('function');
      expect(typeof (eventBus as any).cleanupByOwner).toBe('function');
      expect(typeof (eventBus as any).getChannelKeys).toBe('function');
    });
  });
});
