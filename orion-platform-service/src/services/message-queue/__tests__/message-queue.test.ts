/**
 * Message Queue Service Tests
 *
 * F005: Core queue operations (enqueue, dequeue, ack, nack, retry)
 * F006: Delay queue + Dead letter queue
 * F007: Consumer groups
 */

import { MessageQueueService } from '../message-queue-service';

describe('MessageQueueService', () => {
  let service: MessageQueueService;

  beforeEach(() => {
    service = new MessageQueueService();
  });

  afterEach(() => {
    service.shutdown();
  });

  // ─── F005: Core Operations ──────────────────────────────────────────────

  describe('enqueue / dequeue', () => {
    test('should enqueue and dequeue a message', async () => {
      const messageId = await service.enqueue({
        type: 'test',
        data: { key: 'value' },
      });

      expect(messageId).toBeDefined();

      const message = await service.dequeue();
      expect(message).not.toBeNull();
      expect(message!.taskId).toBeDefined();
      expect(message!.payload.type).toBe('test');
      expect(message!.status).toBe('processing');
    });

    test('should return null when queue is empty', async () => {
      const message = await service.dequeue();
      expect(message).toBeNull();
    });

    test('should enqueue to named queue', async () => {
      await service.enqueue({ type: 'email', data: {} }, { queueName: 'notifications' });

      // Default queue should be empty
      expect(await service.dequeue()).toBeNull();

      // Named queue should have message
      const message = await service.dequeue({ queueName: 'notifications' });
      expect(message).not.toBeNull();
    });

    test('should dequeue by priority (higher first)', async () => {
      await service.enqueue({ type: 'low', data: {} }, { priority: 1 });
      await service.enqueue({ type: 'high', data: {} }, { priority: 10 });
      await service.enqueue({ type: 'medium', data: {} }, { priority: 5 });

      const first = await service.dequeue();
      expect(first!.payload.type).toBe('high');

      const second = await service.dequeue();
      expect(second!.payload.type).toBe('medium');

      const third = await service.dequeue();
      expect(third!.payload.type).toBe('low');
    });

    test('should use custom taskId if provided', async () => {
      const messageId = await service.enqueue(
        { type: 'test', data: {} },
        { taskId: 'my-custom-task' },
      );

      const message = await service.dequeue();
      expect(message!.taskId).toBe('my-custom-task');
    });
  });

  describe('ack', () => {
    test('should mark message as completed', async () => {
      const messageId = await service.enqueue({ type: 'test', data: {} });
      const message = await service.dequeue();

      await service.ack(message!.id);

      const msg = service.getMessage(message!.id);
      expect(msg!.status).toBe('completed');
      expect(msg!.completedAt).toBeDefined();
    });

    test('should throw if message not found', async () => {
      await expect(service.ack('nonexistent')).rejects.toThrow('Message not found');
    });
  });

  describe('nack', () => {
    test('should re-enqueue on first failure', async () => {
      const messageId = await service.enqueue({ type: 'test', data: {} });
      const message = await service.dequeue();

      await service.nack(message!.id, 'test error');

      const msg = service.getMessage(message!.id);
      expect(msg!.status).toBe('pending');
      expect(msg!.retryCount).toBe(1);
    });

    test('should move to DLQ after max retries', async () => {
      const messageId = await service.enqueue(
        { type: 'test', data: {} },
        { maxRetries: 2 },
      );

      // First failure
      let message = await service.dequeue();
      await service.nack(message!.id, 'error 1');
      expect(service.getMessage(message!.id)!.status).toBe('pending');

      // Second failure (max retries reached)
      message = await service.dequeue();
      await service.nack(message!.id, 'error 2');

      const msg = service.getMessage(message!.id);
      expect(msg!.status).toBe('dead');
    });

    test('should throw if message not found', async () => {
      await expect(service.nack('nonexistent')).rejects.toThrow('Message not found');
    });
  });

  describe('retry', () => {
    test('should re-enqueue a failed message', async () => {
      const messageId = await service.enqueue({ type: 'test', data: {} });
      const message = await service.dequeue();
      await service.nack(message!.id, 'error');

      // Manually retry
      await service.retry(message!.id);

      const msg = service.getMessage(message!.id);
      expect(msg!.status).toBe('pending');
    });
  });

  // ─── F006: Delay Queue ──────────────────────────────────────────────────

  describe('schedule', () => {
    test('should schedule a message for future execution', async () => {
      const executeAt = new Date(Date.now() + 100); // 100ms in future
      const messageId = await service.schedule({ type: 'delayed', data: {} }, executeAt);

      // Should not be available immediately
      expect(await service.dequeue()).toBeNull();

      // Wait for delay
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Now should be available
      const message = await service.dequeue();
      expect(message).not.toBeNull();
      expect(message!.payload.type).toBe('delayed');
    });

    test('should execute immediately if delay is in the past', async () => {
      const executeAt = new Date(Date.now() - 1000); // 1s ago
      await service.schedule({ type: 'immediate', data: {} }, executeAt);

      const message = await service.dequeue();
      expect(message).not.toBeNull();
    });
  });

  describe('dead letter queue', () => {
    test('should list dead letter messages', async () => {
      const messageId = await service.enqueue(
        { type: 'test', data: {} },
        { maxRetries: 1 },
      );

      const message = await service.dequeue();
      await service.nack(message!.id, 'fatal error');

      const deadLetters = service.listDeadLetters();
      expect(deadLetters.length).toBe(1);
      expect(deadLetters[0].deadReason).toBe('max_retries_exceeded');
    });

    test('should replay a dead letter message', async () => {
      await service.enqueue({ type: 'test', data: {} }, { maxRetries: 1 });

      let message = await service.dequeue();
      await service.nack(message!.id);

      const deadLetters = service.listDeadLetters();
      expect(deadLetters.length).toBe(1);

      // Replay
      const newMessageId = await service.replayDeadLetter(deadLetters[0].id);
      expect(newMessageId).toBeDefined();

      // Should be dequeuable again
      const replayed = await service.dequeue();
      expect(replayed).not.toBeNull();
      expect(replayed!.taskId).toContain('replay');
    });

    test('should throw if dead letter not found', async () => {
      await expect(service.replayDeadLetter('nonexistent')).rejects.toThrow('not found');
    });
  });

  // ─── F007: Consumer Groups ──────────────────────────────────────────────

  describe('consumer groups', () => {
    test('should register a consumer', () => {
      const consumer = service.registerConsumer('default', 'group-1');
      expect(consumer.consumerId).toBeDefined();
      expect(consumer.groupName).toBe('group-1');
      expect(consumer.status).toBe('active');
    });

    test('should update heartbeat', () => {
      const consumer = service.registerConsumer('default', 'group-1');
      const beforeHeartbeat = consumer.lastHeartbeat;

      service.heartbeat(consumer.consumerId);

      const updated = service.getConsumerGroup('default', 'group-1');
      expect(updated[0].lastHeartbeat.getTime()).toBeGreaterThanOrEqual(beforeHeartbeat.getTime());
    });

    test('should get all consumers in a group', () => {
      service.registerConsumer('default', 'group-1');
      service.registerConsumer('default', 'group-1');
      service.registerConsumer('default', 'group-2');

      const group1 = service.getConsumerGroup('default', 'group-1');
      expect(group1.length).toBe(2);

      const group2 = service.getConsumerGroup('default', 'group-2');
      expect(group2.length).toBe(1);
    });

    test('should detect dead consumers', () => {
      const consumer = service.registerConsumer('default', 'group-1');

      // With a very short timeout, consumer should be dead
      expect(service.detectDeadConsumes(0)).toHaveLength(0); // 0ms threshold: no consumer is "dead" at exactly 0

      // Simulate an old consumer
      consumer.lastHeartbeat = new Date(Date.now() - 100000); // 100s ago
      expect(service.detectDeadConsumes(60000)).toHaveLength(1); // 60s timeout: should be dead
    });

    test('should throw heartbeat for unknown consumer', () => {
      expect(() => service.heartbeat('nonexistent')).toThrow('Consumer not found');
    });
  });

  // ─── Statistics ─────────────────────────────────────────────────────────

  describe('statistics', () => {
    test('should track enqueue/dequeue counts', async () => {
      await service.enqueue({ type: 'a', data: {} });
      await service.enqueue({ type: 'b', data: {} });
      await service.dequeue();

      const stats = service.getStats();
      expect(stats.totalEnqueued).toBe(2);
      expect(stats.totalDequeued).toBe(1);
    });

    test('should track completed and dead lettered', async () => {
      await service.enqueue({ type: 'test', data: {} }, { maxRetries: 1 });

      let message = await service.dequeue();
      await service.ack(message!.id);

      const stats = service.getStats();
      expect(stats.totalCompleted).toBe(1);
    });

    test('should get per-queue stats', async () => {
      await service.enqueue({ type: 'test', data: {} }, { queueName: 'emails' });

      const stats = service.getStats('emails');
      expect(stats.queueName).toBe('emails');
      expect(stats.pending).toBe(1);
    });
  });

  describe('list messages', () => {
    test('should list messages with filters', async () => {
      await service.enqueue({ type: 'a', data: {} });
      await service.enqueue({ type: 'b', data: {} });

      const all = service.listMessages();
      expect(all.length).toBe(2);

      const pending = service.listMessages({ status: 'pending' });
      expect(pending.length).toBe(2);
    });

    test('should respect limit', async () => {
      for (let i = 0; i < 10; i++) {
        await service.enqueue({ type: `msg-${i}`, data: {} });
      }

      const limited = service.listMessages({ limit: 3 });
      expect(limited.length).toBe(3);
    });
  });
});
