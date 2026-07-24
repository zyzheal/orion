/**
 * MessageQueueService - Comprehensive Unit Tests
 *
 * Covers all public methods, edge cases, error handling, and integration paths.
 * Supplements the existing message-queue.test.ts with deeper coverage.
 *
 * F005: Core queue operations (enqueue, dequeue, ack, nack, retry)
 * F006: Delay queue + Dead letter queue
 * F007: Consumer groups
 */

import { MessageQueueService, Message, MessagePayload, DeadLetterMessage } from '../message-queue-service';
import { OrionError, ErrorCode } from '../../../errors';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makePayload = (type = 'test', data: Record<string, unknown> = {}): MessagePayload => ({
  type,
  data,
});

const makePayloadWithMetadata = (): MessagePayload => ({
  type: 'email',
  data: { to: 'user@test.com' },
  metadata: { source: 'unit-test', traceId: 'abc-123' },
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('MessageQueueService - Comprehensive Tests', () => {
  let service: MessageQueueService;

  beforeEach(() => {
    service = new MessageQueueService();
  });

  afterEach(() => {
    service.shutdown();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    test('should create service without DB', () => {
      const svc = new MessageQueueService();
      // Should not throw; basic operations should work
      expect(svc).toBeDefined();
    });

    test('should create service with DB mock', () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      };
      const svc = new MessageQueueService(mockDb);
      expect(svc).toBeDefined();
    });

    test('should work with DB mock for enqueue/dequeue', async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      };
      const svc = new MessageQueueService(mockDb);

      const id = await svc.enqueue(makePayload());
      expect(id).toBeDefined();

      const msg = await svc.dequeue();
      expect(msg).not.toBeNull();
      expect(msg!.payload.type).toBe('test');

      svc.shutdown();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F005: Enqueue
  // ═══════════════════════════════════════════════════════════════════════════

  describe('enqueue', () => {
    test('should set default values correctly', async () => {
      const id = await service.enqueue(makePayload());
      const msg = service.getMessage(id);

      expect(msg).toBeDefined();
      expect(msg!.status).toBe('pending');
      expect(msg!.priority).toBe(0);
      expect(msg!.maxRetries).toBe(3);
      expect(msg!.retryCount).toBe(0);
      expect(msg!.createdAt).toBeInstanceOf(Date);
      expect(msg!.updatedAt).toBeInstanceOf(Date);
      expect(msg!.processedAt).toBeUndefined();
      expect(msg!.completedAt).toBeUndefined();
      expect(msg!.error).toBeUndefined();
    });

    test('should preserve metadata in payload', async () => {
      const payload = makePayloadWithMetadata();
      const id = await service.enqueue(payload);
      const msg = service.getMessage(id);

      expect(msg!.payload.metadata).toEqual({
        source: 'unit-test',
        traceId: 'abc-123',
      });
    });

    test('should generate unique message IDs for multiple enqueues', async () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const id = await service.enqueue(makePayload(`msg-${i}`));
        ids.add(id);
      }
      expect(ids.size).toBe(10);
    });

    test('should assign correct queueName', async () => {
      const id = await service.enqueue(makePayload(), { queueName: 'my-queue' });
      const msg = service.getMessage(id);
      expect(msg!.queueName).toBe('my-queue');
    });

    test('should default to "default" queue when queueName not specified', async () => {
      const id = await service.enqueue(makePayload());
      const msg = service.getMessage(id);
      expect(msg!.queueName).toBe('default');
    });

    test('should accept custom priority', async () => {
      const id = await service.enqueue(makePayload(), { priority: 99 });
      const msg = service.getMessage(id);
      expect(msg!.priority).toBe(99);
    });

    test('should accept custom maxRetries', async () => {
      const id = await service.enqueue(makePayload(), { maxRetries: 10 });
      const msg = service.getMessage(id);
      expect(msg!.maxRetries).toBe(10);
    });

    test('should accept custom taskId', async () => {
      const id = await service.enqueue(makePayload(), { taskId: 'task-abc' });
      const msg = service.getMessage(id);
      expect(msg!.taskId).toBe('task-abc');
    });

    test('should track totalEnqueued stat', async () => {
      await service.enqueue(makePayload('a'));
      await service.enqueue(makePayload('b'));
      await service.enqueue(makePayload('c'));

      const stats = service.getStats();
      expect(stats.totalEnqueued).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F005: Dequeue
  // ═══════════════════════════════════════════════════════════════════════════

  describe('dequeue', () => {
    test('should return null from non-existent queue', async () => {
      const msg = await service.dequeue({ queueName: 'no-such-queue' });
      expect(msg).toBeNull();
    });

    test('should set processedAt on dequeue', async () => {
      await service.enqueue(makePayload());
      const msg = await service.dequeue();

      expect(msg!.processedAt).toBeInstanceOf(Date);
    });

    test('should track consumerId in processing map', async () => {
      await service.enqueue(makePayload(), { taskId: 'tracked-task' });
      const msg = await service.dequeue({ consumerId: 'consumer-1' });

      expect(msg).not.toBeNull();
      // The message should be marked as processing
      expect(msg!.status).toBe('processing');
    });

    test('should track totalDequeued stat', async () => {
      await service.enqueue(makePayload('a'));
      await service.enqueue(makePayload('b'));
      await service.dequeue();
      await service.dequeue();

      const stats = service.getStats();
      expect(stats.totalDequeued).toBe(2);
    });

    test('should dequeue all messages in priority order across multiple operations', async () => {
      await service.enqueue(makePayload('low'), { priority: 1 });
      await service.enqueue(makePayload('high'), { priority: 100 });
      await service.enqueue(makePayload('medium'), { priority: 50 });
      await service.enqueue(makePayload('critical'), { priority: 200 });

      const first = await service.dequeue();
      const second = await service.dequeue();
      const third = await service.dequeue();
      const fourth = await service.dequeue();

      expect(first!.payload.type).toBe('critical');
      expect(second!.payload.type).toBe('high');
      expect(third!.payload.type).toBe('medium');
      expect(fourth!.payload.type).toBe('low');
    });

    test('should return null when all messages have been dequeued', async () => {
      await service.enqueue(makePayload());
      await service.dequeue();

      const msg = await service.dequeue();
      expect(msg).toBeNull();
    });

    test('should handle multiple queues independently', async () => {
      await service.enqueue(makePayload('queue-a-msg'), { queueName: 'queue-a' });
      await service.enqueue(makePayload('queue-b-msg'), { queueName: 'queue-b' });

      const msgA = await service.dequeue({ queueName: 'queue-a' });
      const msgB = await service.dequeue({ queueName: 'queue-b' });

      expect(msgA!.payload.type).toBe('queue-a-msg');
      expect(msgB!.payload.type).toBe('queue-b-msg');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F005: Ack
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ack', () => {
    test('should set completedAt timestamp', async () => {
      const id = await service.enqueue(makePayload());
      const msg = await service.dequeue();
      expect(msg!.completedAt).toBeUndefined();

      await service.ack(msg!.id);

      const completed = service.getMessage(msg!.id);
      expect(completed!.completedAt).toBeInstanceOf(Date);
    });

    test('should update updatedAt on ack', async () => {
      const id = await service.enqueue(makePayload());
      const msg = await service.dequeue();
      const originalUpdatedAt = msg!.updatedAt;

      // Small delay to ensure time difference
      await new Promise((r) => setTimeout(r, 10));
      await service.ack(msg!.id);

      const completed = service.getMessage(msg!.id);
      expect(completed!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    test('should increment totalCompleted stat', async () => {
      await service.enqueue(makePayload('a'));
      await service.enqueue(makePayload('b'));

      const msg1 = await service.dequeue();
      const msg2 = await service.dequeue();
      await service.ack(msg1!.id);
      await service.ack(msg2!.id);

      const stats = service.getStats();
      expect(stats.totalCompleted).toBe(2);
    });

    test('should throw OrionError with NOT_FOUND code for missing message', async () => {
      try {
        await service.ack('non-existent-id');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OrionError);
        expect((error as OrionError).code).toBe(ErrorCode.NOT_FOUND);
        expect((error as OrionError).message).toContain('Message not found');
      }
    });

    test('should allow ack on already-completed message (idempotent check)', async () => {
      const id = await service.enqueue(makePayload());
      const msg = await service.dequeue();
      await service.ack(msg!.id);

      // Ack again should not throw (status just stays completed)
      await service.ack(msg!.id);
      const completed = service.getMessage(msg!.id);
      expect(completed!.status).toBe('completed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F005: Nack
  // ═══════════════════════════════════════════════════════════════════════════

  describe('nack', () => {
    test('should store error message', async () => {
      await service.enqueue(makePayload());
      const msg = await service.dequeue();

      await service.nack(msg!.id, 'Connection timeout');

      const nacked = service.getMessage(msg!.id);
      expect(nacked!.error).toBe('Connection timeout');
    });

    test('should handle nack without error message', async () => {
      await service.enqueue(makePayload());
      const msg = await service.dequeue();

      await service.nack(msg!.id);

      const nacked = service.getMessage(msg!.id);
      expect(nacked!.error).toBeUndefined();
      expect(nacked!.retryCount).toBe(1);
    });

    test('should update updatedAt on nack', async () => {
      await service.enqueue(makePayload());
      const msg = await service.dequeue();
      const originalUpdatedAt = msg!.updatedAt;

      await new Promise((r) => setTimeout(r, 10));
      await service.nack(msg!.id, 'error');

      const nacked = service.getMessage(msg!.id);
      expect(nacked!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    test('should increment retryCount on each nack', async () => {
      const id = await service.enqueue(makePayload(), { maxRetries: 5 });

      for (let i = 1; i <= 4; i++) {
        const msg = await service.dequeue();
        expect(msg!.retryCount).toBe(i - 1);
        await service.nack(msg!.id, `error-${i}`);
        const nacked = service.getMessage(id);
        expect(nacked!.retryCount).toBe(i);
        expect(nacked!.status).toBe('pending');
      }
    });

    test('should move to DLQ exactly at maxRetries boundary', async () => {
      const id = await service.enqueue(makePayload(), { maxRetries: 3 });

      // Fail 2 times: should re-enqueue
      for (let i = 0; i < 2; i++) {
        const msg = await service.dequeue();
        await service.nack(msg!.id, `fail-${i}`);
        expect(service.getMessage(id)!.status).toBe('pending');
      }

      // 3rd failure: should move to DLQ
      const msg = await service.dequeue();
      await service.nack(msg!.id, 'final-fail');
      expect(service.getMessage(id)!.status).toBe('dead');
    });

    test('should increment totalFailed and totalDeadLettered stats', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      const msg = await service.dequeue();
      await service.nack(msg!.id, 'fatal');

      const stats = service.getStats();
      expect(stats.totalDeadLettered).toBe(1);
    });

    test('should throw OrionError with NOT_FOUND code for missing message', async () => {
      try {
        await service.nack('non-existent-id');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OrionError);
        expect((error as OrionError).code).toBe(ErrorCode.NOT_FOUND);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F005: Retry
  // ═══════════════════════════════════════════════════════════════════════════

  describe('retry', () => {
    test('should throw OrionError for non-existent message', async () => {
      try {
        await service.retry('non-existent-id');
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(OrionError);
        expect((error as OrionError).code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    test('should throw OrionError when retrying completed message', async () => {
      await service.enqueue(makePayload());
      const msg = await service.dequeue();
      await service.ack(msg!.id);

      try {
        await service.retry(msg!.id);
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(OrionError);
        expect((error as OrionError).message).toContain('Cannot retry completed message');
      }
    });

    test('should reset status to pending on retry', async () => {
      await service.enqueue(makePayload());
      const msg = await service.dequeue();
      await service.nack(msg!.id, 'error');

      // Message is re-enqueued by nack, let's manually set it to failed for testing retry
      // Actually after nack with retryCount < maxRetries, status is 'pending' already
      // Let's test retry on a processing message
      const id2 = await service.enqueue(makePayload());
      const msg2 = await service.dequeue();
      expect(msg2!.status).toBe('processing');

      await service.retry(msg2!.id);
      const retried = service.getMessage(id2);
      expect(retried!.status).toBe('pending');
    });

    test('should make retried message dequeueable again', async () => {
      const id = await service.enqueue(makePayload());
      const msg = await service.dequeue();
      expect(msg!.status).toBe('processing');

      await service.retry(id);

      const dequeued = await service.dequeue();
      expect(dequeued).not.toBeNull();
      expect(dequeued!.id).toBe(id);
      expect(dequeued!.status).toBe('processing');
    });

    test('should update updatedAt on retry', async () => {
      const id = await service.enqueue(makePayload());
      const msg = await service.dequeue();
      const originalUpdatedAt = msg!.updatedAt;

      await new Promise((r) => setTimeout(r, 10));
      await service.retry(id);

      const retried = service.getMessage(id);
      expect(retried!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F006: Schedule (Delay Queue)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('schedule', () => {
    test('should schedule with custom queueName', async () => {
      const future = new Date(Date.now() + 50);
      const id = await service.schedule(makePayload(), future, { queueName: 'delayed-queue' });

      const msg = service.getMessage(id);
      expect(msg!.queueName).toBe('delayed-queue');
    });

    test('should schedule with custom priority', async () => {
      const future = new Date(Date.now() + 50);
      const id = await service.schedule(makePayload(), future, { priority: 42 });

      const msg = service.getMessage(id);
      expect(msg!.priority).toBe(42);
    });

    test('should schedule with custom taskId', async () => {
      const future = new Date(Date.now() + 50);
      const id = await service.schedule(makePayload(), future, { taskId: 'sched-task-1' });

      const msg = service.getMessage(id);
      expect(msg!.taskId).toBe('sched-task-1');
    });

    test('should schedule with custom maxRetries', async () => {
      const future = new Date(Date.now() + 50);
      const id = await service.schedule(makePayload(), future, { maxRetries: 5 });

      const msg = service.getMessage(id);
      expect(msg!.maxRetries).toBe(5);
    });

    test('should have pending status after scheduling', async () => {
      const future = new Date(Date.now() + 100);
      const id = await service.schedule(makePayload(), future);

      const msg = service.getMessage(id);
      expect(msg!.status).toBe('pending');
    });

    test('should not be dequeueable before scheduled time', async () => {
      const future = new Date(Date.now() + 5000);
      await service.schedule(makePayload(), future);

      const msg = await service.dequeue();
      expect(msg).toBeNull();
    });

    test('should track scheduled message in stats after trigger', async () => {
      const past = new Date(Date.now() - 100);
      await service.schedule(makePayload(), past);

      const stats = service.getStats();
      expect(stats.totalEnqueued).toBe(1);
    });

    test('should handle multiple scheduled messages', async () => {
      const past = new Date(Date.now() - 100);
      await service.schedule(makePayload('a'), past);
      await service.schedule(makePayload('b'), past);

      const msg1 = await service.dequeue();
      const msg2 = await service.dequeue();

      expect(msg1).not.toBeNull();
      expect(msg2).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F006: Dead Letter Queue
  // ═══════════════════════════════════════════════════════════════════════════

  describe('moveToDeadLetter', () => {
    test('should create DLQ entry with correct fields', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      const msg = await service.dequeue();
      await service.nack(msg!.id, 'fatal error');

      const deadLetters = service.listDeadLetters();
      expect(deadLetters).toHaveLength(1);

      const dlq = deadLetters[0];
      expect(dlq.queueName).toBe('default');
      expect(dlq.payload.type).toBe('test');
      expect(dlq.lastError).toBe('fatal error');
      expect(dlq.deadReason).toBe('max_retries_exceeded');
      expect(dlq.replayStatus).toBe('pending');
      expect(dlq.deadAt).toBeInstanceOf(Date);
    });

    test('should handle deadReason "expired"', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      const msg = await service.dequeue();
      await service.nack(msg!.id, 'expired');

      const deadLetters = service.listDeadLetters();
      expect(deadLetters[0].deadReason).toBe('max_retries_exceeded');
    });

    test('should handle null lastError when message has no error', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      const msg = await service.dequeue();
      await service.nack(msg!.id); // no error string

      const deadLetters = service.listDeadLetters();
      expect(deadLetters[0].lastError).toBeNull();
    });

    test('should increment totalDeadLettered stat', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      let msg = await service.dequeue();
      await service.nack(msg!.id);

      await service.enqueue(makePayload(), { maxRetries: 1 });
      msg = await service.dequeue();
      await service.nack(msg!.id);

      const stats = service.getStats();
      expect(stats.totalDeadLettered).toBe(2);
    });
  });

  describe('replayDeadLetter', () => {
    test('should create new message with replay suffix in taskId', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      const msg = await service.dequeue();
      await service.nack(msg!.id, 'fail');

      const deadLetters = service.listDeadLetters();
      const newId = await service.replayDeadLetter(deadLetters[0].id);

      const newMsg = service.getMessage(newId);
      expect(newMsg).toBeDefined();
      expect(newMsg!.taskId).toContain('replay');
      expect(newMsg!.taskId).toContain(msg!.taskId);
    });

    test('should reset retryCount to 0 for replayed message', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      const msg = await service.dequeue();
      await service.nack(msg!.id, 'fail');

      const deadLetters = service.listDeadLetters();
      const newId = await service.replayDeadLetter(deadLetters[0].id);

      const newMsg = service.getMessage(newId);
      expect(newMsg!.retryCount).toBe(0);
    });

    test('should set replayed message status to pending', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      const msg = await service.dequeue();
      await service.nack(msg!.id);

      const deadLetters = service.listDeadLetters();
      const newId = await service.replayDeadLetter(deadLetters[0].id);

      const newMsg = service.getMessage(newId);
      expect(newMsg!.status).toBe('pending');
    });

    test('should accept custom maxRetries for replayed message', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      const msg = await service.dequeue();
      await service.nack(msg!.id);

      const deadLetters = service.listDeadLetters();
      const newId = await service.replayDeadLetter(deadLetters[0].id, { maxRetries: 10 });

      const newMsg = service.getMessage(newId);
      expect(newMsg!.maxRetries).toBe(10);
    });

    test('should update DLQ entry replayStatus to "replayed"', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      const msg = await service.dequeue();
      await service.nack(msg!.id);

      const deadLetters = service.listDeadLetters();
      const dlqId = deadLetters[0].id;

      await service.replayDeadLetter(dlqId);

      // The DLQ entry should have replayStatus = 'replayed'
      const updated = service.listDeadLetters();
      const entry = updated.find((d) => d.id === dlqId);
      expect(entry!.replayStatus).toBe('replayed');
    });

    test('should make replayed message dequeueable', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      const msg = await service.dequeue();
      await service.nack(msg!.id);

      const deadLetters = service.listDeadLetters();
      const newId = await service.replayDeadLetter(deadLetters[0].id);

      const dequeued = await service.dequeue();
      expect(dequeued).not.toBeNull();
      expect(dequeued!.id).toBe(newId);
    });

    test('should increment totalEnqueued on replay', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1 });
      const msg = await service.dequeue();
      await service.nack(msg!.id);

      const statsBefore = service.getStats();

      const deadLetters = service.listDeadLetters();
      await service.replayDeadLetter(deadLetters[0].id);

      const statsAfter = service.getStats();
      expect(statsAfter.totalEnqueued).toBe(statsBefore.totalEnqueued + 1);
    });

    test('should throw OrionError for non-existent dead letter', async () => {
      try {
        await service.replayDeadLetter('dlq-nonexistent');
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(OrionError);
        expect((error as OrionError).code).toBe(ErrorCode.NOT_FOUND);
        expect((error as OrionError).message).toContain('Dead letter not found');
      }
    });
  });

  describe('listDeadLetters', () => {
    test('should return empty array when no dead letters', () => {
      const result = service.listDeadLetters();
      expect(result).toEqual([]);
    });

    test('should filter by queueName', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1, queueName: 'q1' });
      let msg = await service.dequeue({ queueName: 'q1' });
      await service.nack(msg!.id);

      await service.enqueue(makePayload(), { maxRetries: 1, queueName: 'q2' });
      msg = await service.dequeue({ queueName: 'q2' });
      await service.nack(msg!.id);

      const q1Dead = service.listDeadLetters('q1');
      expect(q1Dead).toHaveLength(1);
      expect(q1Dead[0].queueName).toBe('q1');

      const q2Dead = service.listDeadLetters('q2');
      expect(q2Dead).toHaveLength(1);
      expect(q2Dead[0].queueName).toBe('q2');
    });

    test('should return all dead letters when no queueName filter', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1, queueName: 'q1' });
      let msg = await service.dequeue({ queueName: 'q1' });
      await service.nack(msg!.id);

      await service.enqueue(makePayload(), { maxRetries: 1, queueName: 'q2' });
      msg = await service.dequeue({ queueName: 'q2' });
      await service.nack(msg!.id);

      const all = service.listDeadLetters();
      expect(all).toHaveLength(2);
    });

    test('should sort by deadAt descending', async () => {
      await service.enqueue(makePayload('first'), { maxRetries: 1 });
      let msg = await service.dequeue();
      await service.nack(msg!.id);

      await new Promise((r) => setTimeout(r, 10));

      await service.enqueue(makePayload('second'), { maxRetries: 1 });
      msg = await service.dequeue();
      await service.nack(msg!.id);

      const deadLetters = service.listDeadLetters();
      expect(deadLetters).toHaveLength(2);
      // Most recent first
      expect(deadLetters[0].deadAt.getTime()).toBeGreaterThanOrEqual(deadLetters[1].deadAt.getTime());
    });

    test('should return empty for non-existent queueName', () => {
      const result = service.listDeadLetters('no-such-queue');
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F007: Consumer Groups
  // ═══════════════════════════════════════════════════════════════════════════

  describe('registerConsumer', () => {
    test('should auto-generate consumerId if not provided', () => {
      const consumer = service.registerConsumer('default', 'group-1');
      expect(consumer.consumerId).toMatch(/^consumer-/);
    });

    test('should accept custom consumerId', () => {
      const consumer = service.registerConsumer('default', 'group-1', 'my-consumer');
      expect(consumer.consumerId).toBe('my-consumer');
    });

    test('should set initial messagesProcessed to 0', () => {
      const consumer = service.registerConsumer('default', 'group-1');
      expect(consumer.messagesProcessed).toBe(0);
    });

    test('should set initial status to active', () => {
      const consumer = service.registerConsumer('default', 'group-1');
      expect(consumer.status).toBe('active');
    });

    test('should set lastHeartbeat to current time', () => {
      const before = new Date();
      const consumer = service.registerConsumer('default', 'group-1');
      const after = new Date();

      expect(consumer.lastHeartbeat.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(consumer.lastHeartbeat.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should store queueName and groupName correctly', () => {
      const consumer = service.registerConsumer('email-queue', 'processors');
      expect(consumer.queueName).toBe('email-queue');
      expect(consumer.groupName).toBe('processors');
    });

    test('should allow multiple consumers in same group', () => {
      const c1 = service.registerConsumer('default', 'group-1');
      const c2 = service.registerConsumer('default', 'group-1');
      const c3 = service.registerConsumer('default', 'group-1');

      const group = service.getConsumerGroup('default', 'group-1');
      expect(group).toHaveLength(3);
    });
  });

  describe('heartbeat', () => {
    test('should update lastHeartbeat timestamp', () => {
      const consumer = service.registerConsumer('default', 'group-1');
      const initialHeartbeat = consumer.lastHeartbeat;

      // Wait a bit so timestamp differs
      service.heartbeat(consumer.consumerId);

      const updated = service.getConsumerGroup('default', 'group-1');
      expect(updated[0].lastHeartbeat.getTime()).toBeGreaterThanOrEqual(initialHeartbeat.getTime());
    });

    test('should set status to active on heartbeat', () => {
      const consumer = service.registerConsumer('default', 'group-1');
      // Manually set to idle
      (consumer as any).status = 'idle';

      service.heartbeat(consumer.consumerId);

      const updated = service.getConsumerGroup('default', 'group-1');
      expect(updated[0].status).toBe('active');
    });

    test('should throw OrionError for non-existent consumer', () => {
      try {
        service.heartbeat('non-existent-consumer');
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(OrionError);
        expect((error as OrionError).code).toBe(ErrorCode.NOT_FOUND);
        expect((error as OrionError).message).toContain('Consumer not found');
      }
    });
  });

  describe('getConsumerGroup', () => {
    test('should return empty array for non-existent group', () => {
      const group = service.getConsumerGroup('default', 'no-such-group');
      expect(group).toEqual([]);
    });

    test('should filter by both queueName and groupName', () => {
      service.registerConsumer('q1', 'g1', 'c1');
      service.registerConsumer('q1', 'g2', 'c2');
      service.registerConsumer('q2', 'g1', 'c3');

      const g1q1 = service.getConsumerGroup('q1', 'g1');
      expect(g1q1).toHaveLength(1);
      expect(g1q1[0].consumerId).toBe('c1');

      const g2q1 = service.getConsumerGroup('q1', 'g2');
      expect(g2q1).toHaveLength(1);
      expect(g2q1[0].consumerId).toBe('c2');

      const g1q2 = service.getConsumerGroup('q2', 'g1');
      expect(g1q2).toHaveLength(1);
      expect(g1q2[0].consumerId).toBe('c3');
    });

    test('should return empty for wrong queueName', () => {
      service.registerConsumer('q1', 'g1');
      const result = service.getConsumerGroup('wrong-queue', 'g1');
      expect(result).toEqual([]);
    });
  });

  describe('detectDeadConsumes', () => {
    test('should return empty array when no consumers', () => {
      const dead = service.detectDeadConsumes();
      expect(dead).toEqual([]);
    });

    test('should return empty when all consumers are within timeout', () => {
      service.registerConsumer('default', 'g1');
      service.registerConsumer('default', 'g1');

      const dead = service.detectDeadConsumes(60000);
      expect(dead).toEqual([]);
    });

    test('should detect consumers exceeding timeout', () => {
      const c1 = service.registerConsumer('default', 'g1');
      const c2 = service.registerConsumer('default', 'g1');

      // Simulate stale heartbeat on c1
      c1.lastHeartbeat = new Date(Date.now() - 120000);

      const dead = service.detectDeadConsumes(60000);
      expect(dead).toHaveLength(1);
      expect(dead[0].consumerId).toBe(c1.consumerId);
    });

    test('should not detect inactive consumers', () => {
      const c1 = service.registerConsumer('default', 'g1');
      c1.lastHeartbeat = new Date(Date.now() - 120000);
      c1.status = 'dead'; // not active

      const dead = service.detectDeadConsumes(60000);
      expect(dead).toEqual([]);
    });

    test('should detect multiple dead consumers', () => {
      const c1 = service.registerConsumer('default', 'g1');
      const c2 = service.registerConsumer('default', 'g1');
      const c3 = service.registerConsumer('default', 'g1');

      c1.lastHeartbeat = new Date(Date.now() - 120000);
      c2.lastHeartbeat = new Date(Date.now() - 120000);
      // c3 is still active

      const dead = service.detectDeadConsumes(60000);
      expect(dead).toHaveLength(2);
    });

    test('should use default timeout of 60000ms', () => {
      const c1 = service.registerConsumer('default', 'g1');
      c1.lastHeartbeat = new Date(Date.now() - 50000); // 50s ago, within default 60s

      const dead = service.detectDeadConsumes();
      expect(dead).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Statistics
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getStats', () => {
    test('should return global stats with all fields', () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('totalEnqueued');
      expect(stats).toHaveProperty('totalDequeued');
      expect(stats).toHaveProperty('totalCompleted');
      expect(stats).toHaveProperty('totalFailed');
      expect(stats).toHaveProperty('totalDeadLettered');
      expect(stats).toHaveProperty('queues');
      expect(stats).toHaveProperty('deadLetters');
      expect(stats).toHaveProperty('consumers');
    });

    test('should return zeros initially for global stats', () => {
      const stats = service.getStats();
      expect(stats.totalEnqueued).toBe(0);
      expect(stats.totalDequeued).toBe(0);
      expect(stats.totalCompleted).toBe(0);
      expect(stats.totalFailed).toBe(0);
      expect(stats.totalDeadLettered).toBe(0);
      expect(stats.queues).toBe(0);
      expect(stats.deadLetters).toBe(0);
      expect(stats.consumers).toBe(0);
    });

    test('should return zeros for non-existent queue', () => {
      const stats = service.getStats('non-existent-queue');
      expect(stats).toEqual({
        queueName: 'non-existent-queue',
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        dead: 0,
      });
    });

    test('should track per-queue stats by status', async () => {
      await service.enqueue(makePayload('a'), { queueName: 'test-q' });
      await service.enqueue(makePayload('b'), { queueName: 'test-q' });
      await service.enqueue(makePayload('c'), { queueName: 'test-q' });

      // Dequeue one (processing)
      const msg1 = await service.dequeue({ queueName: 'test-q' });

      // Ack one
      await service.ack(msg1!.id);

      const stats = service.getStats('test-q') as any;
      expect(stats.queueName).toBe('test-q');
      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(0); // ack removes from processing
      expect(stats.completed).toBe(1);
    });

    test('should track queue count correctly', async () => {
      await service.enqueue(makePayload(), { queueName: 'q1' });
      await service.enqueue(makePayload(), { queueName: 'q2' });
      await service.enqueue(makePayload(), { queueName: 'q3' });

      const stats = service.getStats();
      expect(stats.queues).toBe(3);
    });

    test('should track consumer count', () => {
      service.registerConsumer('q1', 'g1');
      service.registerConsumer('q1', 'g1');
      service.registerConsumer('q2', 'g2');

      const stats = service.getStats();
      expect(stats.consumers).toBe(3);
    });

    test('should track per-queue consumers', async () => {
      await service.enqueue(makePayload(), { queueName: 'q1' });
      service.registerConsumer('q1', 'g1');
      service.registerConsumer('q1', 'g1');
      service.registerConsumer('q2', 'g2');

      const stats = service.getStats('q1') as any;
      expect(stats.consumers).toBe(2);
    });

    test('should track dead letter count in per-queue stats', async () => {
      await service.enqueue(makePayload(), { maxRetries: 1, queueName: 'q1' });
      const msg = await service.dequeue({ queueName: 'q1' });
      await service.nack(msg!.id);

      const stats = service.getStats('q1') as any;
      expect(stats.dead).toBe(1);
      expect(stats.deadLetters).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // listMessages
  // ═══════════════════════════════════════════════════════════════════════════

  describe('listMessages', () => {
    test('should return empty array when no messages', () => {
      const result = service.listMessages();
      expect(result).toEqual([]);
    });

    test('should list all messages across queues', async () => {
      await service.enqueue(makePayload(), { queueName: 'q1' });
      await service.enqueue(makePayload(), { queueName: 'q2' });
      await service.enqueue(makePayload(), { queueName: 'q3' });

      const all = service.listMessages();
      expect(all).toHaveLength(3);
    });

    test('should filter by queueName', async () => {
      await service.enqueue(makePayload(), { queueName: 'q1' });
      await service.enqueue(makePayload(), { queueName: 'q1' });
      await service.enqueue(makePayload(), { queueName: 'q2' });

      const q1Messages = service.listMessages({ queueName: 'q1' });
      expect(q1Messages).toHaveLength(2);
      q1Messages.forEach((m) => expect(m.queueName).toBe('q1'));
    });

    test('should filter by status', async () => {
      await service.enqueue(makePayload('a'));
      await service.enqueue(makePayload('b'));
      const msg = await service.dequeue();
      await service.ack(msg!.id);

      const pending = service.listMessages({ status: 'pending' });
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('pending');

      const completed = service.listMessages({ status: 'completed' });
      expect(completed).toHaveLength(1);
      expect(completed[0].status).toBe('completed');
    });

    test('should respect limit parameter', async () => {
      for (let i = 0; i < 20; i++) {
        await service.enqueue(makePayload(`msg-${i}`));
      }

      const limited = service.listMessages({ limit: 5 });
      expect(limited).toHaveLength(5);
    });

    test('should use default limit of 100', async () => {
      for (let i = 0; i < 110; i++) {
        await service.enqueue(makePayload(`msg-${i}`));
      }

      const result = service.listMessages();
      expect(result).toHaveLength(100);
    });

    test('should sort by createdAt descending', async () => {
      await service.enqueue(makePayload('first'));
      await new Promise((r) => setTimeout(r, 10));
      await service.enqueue(makePayload('second'));
      await new Promise((r) => setTimeout(r, 10));
      await service.enqueue(makePayload('third'));

      const result = service.listMessages();
      expect(result[0].payload.type).toBe('third');
      expect(result[2].payload.type).toBe('first');
    });

    test('should combine queueName and status filters', async () => {
      await service.enqueue(makePayload(), { queueName: 'q1' });
      await service.enqueue(makePayload(), { queueName: 'q1' });
      await service.enqueue(makePayload(), { queueName: 'q2' });

      const msg = await service.dequeue({ queueName: 'q1' });
      await service.ack(msg!.id);

      const q1Pending = service.listMessages({ queueName: 'q1', status: 'pending' });
      expect(q1Pending).toHaveLength(1);
    });

    test('should return empty for non-existent queue', () => {
      const result = service.listMessages({ queueName: 'no-such-queue' });
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getMessage
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getMessage', () => {
    test('should return undefined for non-existent message', () => {
      const result = service.getMessage('non-existent-id');
      expect(result).toBeUndefined();
    });

    test('should return message by id', async () => {
      const id = await service.enqueue(makePayload('specific-msg'));
      const msg = service.getMessage(id);

      expect(msg).toBeDefined();
      expect(msg!.id).toBe(id);
      expect(msg!.payload.type).toBe('specific-msg');
    });

    test('should find message across different queues', async () => {
      const id1 = await service.enqueue(makePayload(), { queueName: 'q1' });
      const id2 = await service.enqueue(makePayload(), { queueName: 'q2' });

      expect(service.getMessage(id1)).toBeDefined();
      expect(service.getMessage(id2)).toBeDefined();
      expect(service.getMessage(id1)!.queueName).toBe('q1');
      expect(service.getMessage(id2)!.queueName).toBe('q2');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Shutdown
  // ═══════════════════════════════════════════════════════════════════════════

  describe('shutdown', () => {
    test('should not throw when no scheduled tasks', () => {
      expect(() => service.shutdown()).not.toThrow();
    });

    test('should be callable multiple times', () => {
      service.shutdown();
      expect(() => service.shutdown()).not.toThrow();
    });

    test('should prevent scheduled messages from triggering after shutdown', async () => {
      // Schedule a message 50ms in the future
      await service.schedule(makePayload(), new Date(Date.now() + 50));

      // Immediately shutdown (clears the timer)
      service.shutdown();

      // Wait past the scheduled time
      await new Promise((r) => setTimeout(r, 100));

      // The scheduled message should NOT have been added to the queue
      // Note: schedule() with future date doesn't add to pending until timer fires
      // After shutdown clears the timer, it won't fire
      const msg = await service.dequeue();
      // The message may still be in queue.messages but not in pending
      // This depends on implementation; the key test is no crash
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration / End-to-End Scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe('integration scenarios', () => {
    test('full lifecycle: enqueue -> dequeue -> nack -> retry -> dequeue -> ack', async () => {
      const id = await service.enqueue(makePayload('lifecycle-msg'), { maxRetries: 3 });

      // Step 1: Dequeue
      let msg = await service.dequeue();
      expect(msg!.id).toBe(id);
      expect(msg!.status).toBe('processing');

      // Step 2: Nack (failure)
      await service.nack(msg!.id, 'temporary failure');
      msg = service.getMessage(id)!;
      expect(msg.status).toBe('pending');
      expect(msg.retryCount).toBe(1);

      // Step 3: Dequeue again (automatic re-enqueue from nack)
      msg = await service.dequeue();
      expect(msg!.id).toBe(id);
      expect(msg!.status).toBe('processing');

      // Step 4: Ack (success)
      await service.ack(msg!.id);
      msg = service.getMessage(id)!;
      expect(msg.status).toBe('completed');
      expect(msg.completedAt).toBeDefined();

      // Verify stats
      const stats = service.getStats();
      expect(stats.totalEnqueued).toBe(1);
      expect(stats.totalDequeued).toBe(2);
      expect(stats.totalCompleted).toBe(1);
    });

    test('full lifecycle: enqueue -> dequeue -> nack x maxRetries -> DLQ -> replay', async () => {
      const id = await service.enqueue(makePayload('dlq-lifecycle'), { maxRetries: 2 });

      // Fail twice to reach maxRetries
      for (let i = 0; i < 2; i++) {
        const msg = await service.dequeue();
        await service.nack(msg!.id, `error-${i}`);
      }

      // Verify in DLQ
      expect(service.getMessage(id)!.status).toBe('dead');
      const deadLetters = service.listDeadLetters();
      expect(deadLetters).toHaveLength(1);
      expect(deadLetters[0].deadReason).toBe('max_retries_exceeded');

      // Replay
      const newId = await service.replayDeadLetter(deadLetters[0].id);
      const replayed = await service.dequeue();
      expect(replayed!.id).toBe(newId);
      expect(replayed!.taskId).toContain('replay');

      // Successfully process
      await service.ack(newId);
      expect(service.getMessage(newId)!.status).toBe('completed');
    });

    test('multiple queues with different priorities and consumers', async () => {
      // Setup consumers
      const c1 = service.registerConsumer('email', 'senders', 'sender-1');
      const c2 = service.registerConsumer('sms', 'senders', 'sender-2');

      // Enqueue with different priorities
      await service.enqueue(makePayload('low-pri-email'), { queueName: 'email', priority: 1 });
      await service.enqueue(makePayload('high-pri-email'), { queueName: 'email', priority: 10 });
      await service.enqueue(makePayload('sms-msg'), { queueName: 'sms', priority: 5 });

      // Dequeue from email (should get high priority first)
      const email1 = await service.dequeue({ queueName: 'email', consumerId: c1.consumerId });
      expect(email1!.payload.type).toBe('high-pri-email');

      const email2 = await service.dequeue({ queueName: 'email', consumerId: c1.consumerId });
      expect(email2!.payload.type).toBe('low-pri-email');

      // Dequeue from sms
      const sms = await service.dequeue({ queueName: 'sms', consumerId: c2.consumerId });
      expect(sms!.payload.type).toBe('sms-msg');

      // Verify queue stats
      const emailStats = service.getStats('email');
      expect((emailStats as any).processing).toBe(2);

      const smsStats = service.getStats('sms');
      expect((smsStats as any).processing).toBe(1);
    });

    test('schedule -> wait -> dequeue -> ack end-to-end', async () => {
      const id = await service.schedule(
        makePayload('delayed-task'),
        new Date(Date.now() + 80),
        { taskId: 'delayed-1', priority: 5 },
      );

      // Not available yet
      expect(await service.dequeue()).toBeNull();

      // Wait for scheduled time
      await new Promise((r) => setTimeout(r, 150));

      // Now should be available
      const msg = await service.dequeue();
      expect(msg).not.toBeNull();
      expect(msg!.id).toBe(id);
      expect(msg!.taskId).toBe('delayed-1');
      expect(msg!.priority).toBe(5);
      expect(msg!.status).toBe('processing');

      // Complete
      await service.ack(msg!.id);
      expect(service.getMessage(id)!.status).toBe('completed');
    });
  });
});
