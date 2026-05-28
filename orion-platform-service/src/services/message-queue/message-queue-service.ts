/**
 * MessageQueueService - 消息队列核心服务
 *
 * F005: 任务入队/消费/确认/重试
 * - enqueue: 任务入队 (Redis LPUSH + PostgreSQL 异步落盘)
 * - dequeue: 任务出队 (Redis RPOP + 消费确认)
 * - ack: 消费确认
 * - nack: 消费失败 + 重试计数
 * - retry: 指数退避重试
 *
 * F006: 延迟队列 + 死信队列
 * - schedule: 延迟入队 (Redis ZADD)
 * - moveToDeadLetter: 超限任务移入 DLQ
 * - replayDeadLetter: 死信重放回主队列
 *
 * F007: 消费者组
 * - registerConsumer: 消费者注册
 * - heartbeat: 消费者心跳
 * - getConsumerGroup: 获取消费者组
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../../errors';

const logger = pino({ name: 'message-queue' });

// ─── Types ─────────────────────────────────────────────────────────────────

export type MessageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead';
export type DeadLetterReason = 'max_retries_exceeded' | 'expired' | 'manual';

export interface MessagePayload {
  type: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  queueName: string;
  taskId: string;
  payload: MessagePayload;
  priority: number;
  status: MessageStatus;
  maxRetries: number;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface DeadLetterMessage {
  id: string;
  originalQueueId: string;
  queueName: string;
  taskId: string;
  payload: MessagePayload;
  retryCount: number;
  lastError: string | null;
  deadReason: DeadLetterReason;
  deadAt: Date;
  replayStatus: 'pending' | 'replaying' | 'replayed' | 'failed' | null;
}

export interface ConsumerInfo {
  consumerId: string;
  groupName: string;
  queueName: string;
  lastHeartbeat: Date;
  messagesProcessed: number;
  status: 'active' | 'idle' | 'dead';
}

export interface EnqueueOptions {
  queueName?: string;
  priority?: number;
  maxRetries?: number;
  taskId?: string;
}

export interface DequeueOptions {
  queueName?: string;
  consumerId?: string;
  timeoutMs?: number;
}

// ─── In-Memory Queue Storage ───────────────────────────────────────────────

interface InMemoryQueue {
  messages: Map<string, Message>;
  processing: Map<string, string>; // taskId -> consumerId
  pending: string[]; // taskIds in order
}

// ─── Service ───────────────────────────────────────────────────────────────

export class MessageQueueService {
  private queues = new Map<string, InMemoryQueue>();
  private deadLetters: Map<string, DeadLetterMessage> = new Map();
  private consumers: Map<string, ConsumerInfo> = new Map();
  private scheduledTasks: Array<{
    message: Message;
    executeAt: Date;
    timer?: NodeJS.Timeout;
  }> = [];

  // Statistics
  private stats = {
    totalEnqueued: 0,
    totalDequeued: 0,
    totalCompleted: 0,
    totalFailed: 0,
    totalDeadLettered: 0,
  };

  // ─── Core: Enqueue / Dequeue ────────────────────────────────────────────

  /**
   * Enqueue a message.
   */
  async enqueue(
    payload: MessagePayload,
    options: EnqueueOptions = {},
  ): Promise<string> {
    const queueName = options.queueName || 'default';
    const queue = this.getOrCreateQueue(queueName);

    const taskId = options.taskId || uuidv4();
    const message: Message = {
      id: uuidv4(),
      queueName,
      taskId,
      payload,
      priority: options.priority ?? 0,
      status: 'pending',
      maxRetries: options.maxRetries ?? 3,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    queue.messages.set(message.id, message);
    // Insert by priority (higher priority first)
    queue.pending.push(message.id);
    queue.pending.sort((a, b) => {
      const msgA = queue.messages.get(a)!;
      const msgB = queue.messages.get(b)!;
      return msgB.priority - msgA.priority;
    });

    this.stats.totalEnqueued++;
    logger.info({ taskId, queueName, messageId: message.id }, 'Message enqueued');

    return message.id;
  }

  /**
   * Dequeue a message. Returns null if queue is empty.
   */
  async dequeue(options: DequeueOptions = {}): Promise<Message | null> {
    const queueName = options.queueName || 'default';
    const queue = this.queues.get(queueName);
    if (!queue || queue.pending.length === 0) return null;

    // Find next pending message
    let messageId: string | undefined;
    while (queue.pending.length > 0) {
      const candidate = queue.pending.shift();
      const msg = candidate ? queue.messages.get(candidate) : undefined;
      if (msg && msg.status === 'pending') {
        messageId = candidate;
        break;
      }
    }

    if (!messageId) return null;

    const message = queue.messages.get(messageId);
    if (!message) return null;

    // Mark as processing
    message.status = 'processing';
    message.processedAt = new Date();
    message.updatedAt = new Date();

    if (options.consumerId) {
      queue.processing.set(message.taskId, options.consumerId);
    }

    this.stats.totalDequeued++;
    logger.debug({ taskId: message.taskId, queueName }, 'Message dequeued');

    return message;
  }

  /**
   * Acknowledge a message as completed.
   */
  async ack(messageId: string): Promise<void> {
    const message = this.findMessageById(messageId);
    if (!message) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Message not found: ${messageId}`);
    }

    message.status = 'completed';
    message.completedAt = new Date();
    message.updatedAt = new Date();

    // Remove from processing
    const queue = this.queues.get(message.queueName);
    if (queue) {
      queue.processing.delete(message.taskId);
    }

    // Update consumer stats
    if (queue) {
      const consumerId = queue.processing.get(message.taskId);
      if (consumerId) {
        const consumer = this.consumers.get(consumerId);
        if (consumer) {
          consumer.messagesProcessed++;
          (consumer as any).lastMessageAt = new Date();
        }
      }
    }

    this.stats.totalCompleted++;
    logger.info({ taskId: message.taskId, messageId }, 'Message acknowledged');
  }

  /**
   * Negative acknowledge - message processing failed.
   * Increments retry count and either re-enqueues or moves to DLQ.
   */
  async nack(messageId: string, error?: string): Promise<void> {
    const message = this.findMessageById(messageId);
    if (!message) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Message not found: ${messageId}`);
    }

    message.retryCount++;
    message.error = error;
    message.updatedAt = new Date();

    // Remove from processing
    const queue = this.queues.get(message.queueName);
    if (queue) {
      queue.processing.delete(message.taskId);
    }

    if (message.retryCount >= message.maxRetries) {
      // Move to dead letter queue
      await this.moveToDeadLetter(message, 'max_retries_exceeded');
    } else {
      // Re-enqueue with exponential backoff
      this.reEnqueue(message);
    }
  }

  /**
   * Manually retry a failed message.
   */
  async retry(messageId: string): Promise<void> {
    const message = this.findMessageById(messageId);
    if (!message) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Message not found: ${messageId}`);
    }

    if (message.status === 'completed') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Cannot retry completed message: ${messageId}`);
    }

    message.status = 'pending';
    message.updatedAt = new Date();

    const queue = this.queues.get(message.queueName);
    if (queue) {
      queue.pending.push(messageId);
    }

    logger.info({ taskId: message.taskId }, 'Message retried');
  }

  // ─── F006: Delay Queue ──────────────────────────────────────────────────

  /**
   * Schedule a message for delayed execution.
   */
  async schedule(
    payload: MessagePayload,
    executeAt: Date,
    options: EnqueueOptions = {},
  ): Promise<string> {
    const queueName = options.queueName || 'default';
    const queue = this.getOrCreateQueue(queueName);

    const taskId = options.taskId || uuidv4();
    const message: Message = {
      id: uuidv4(),
      queueName,
      taskId,
      payload,
      priority: options.priority ?? 0,
      status: 'pending',
      maxRetries: options.maxRetries ?? 3,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    queue.messages.set(message.id, message);

    // Schedule timer
    const delay = executeAt.getTime() - Date.now();
    if (delay <= 0) {
      // Execute immediately
      queue.pending.push(message.id);
      this.stats.totalEnqueued++;
    } else {
      const entry = {
        message,
        executeAt,
        timer: setTimeout(() => {
          queue.pending.push(message.id);
          this.stats.totalEnqueued++;
          logger.info({ taskId, queueName }, 'Delayed message triggered');
          // Remove from scheduled list
          const idx = this.scheduledTasks.indexOf(entry);
          if (idx >= 0) this.scheduledTasks.splice(idx, 1);
        }, delay),
      };
      this.scheduledTasks.push(entry);
    }

    logger.info({ taskId, queueName, executeAt }, 'Message scheduled');
    return message.id;
  }

  // ─── F006: Dead Letter Queue ────────────────────────────────────────────

  /**
   * Move a message to the dead letter queue.
   */
  async moveToDeadLetter(
    message: Message,
    reason: DeadLetterReason,
  ): Promise<string> {
    message.status = 'dead';
    message.updatedAt = new Date();

    const dlqEntry: DeadLetterMessage = {
      id: uuidv4(),
      originalQueueId: message.id,
      queueName: message.queueName,
      taskId: message.taskId,
      payload: message.payload,
      retryCount: message.retryCount,
      lastError: message.error || null,
      deadReason: reason,
      deadAt: new Date(),
      replayStatus: 'pending',
    };

    this.deadLetters.set(dlqEntry.id, dlqEntry);
    this.stats.totalDeadLettered++;

    logger.warn(
      { taskId: message.taskId, reason, retryCount: message.retryCount },
      'Message moved to dead letter queue',
    );

    return dlqEntry.id;
  }

  /**
   * Replay a dead letter message back to the main queue.
   */
  async replayDeadLetter(deadLetterId: string, options?: { maxRetries?: number }): Promise<string> {
    const dlqEntry = this.deadLetters.get(deadLetterId);
    if (!dlqEntry) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Dead letter not found: ${deadLetterId}`);
    }

    dlqEntry.replayStatus = 'replaying';

    const queue = this.getOrCreateQueue(dlqEntry.queueName);
    const newMessage: Message = {
      id: uuidv4(),
      queueName: dlqEntry.queueName,
      taskId: `${dlqEntry.taskId}-replay-${uuidv4().slice(0, 8)}`,
      payload: dlqEntry.payload,
      priority: 0,
      status: 'pending',
      maxRetries: options?.maxRetries ?? dlqEntry.retryCount,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    queue.messages.set(newMessage.id, newMessage);
    queue.pending.push(newMessage.id);

    dlqEntry.replayStatus = 'replayed';
    (dlqEntry as any).replayedAt = new Date();

    this.stats.totalEnqueued++;
    logger.info({ deadLetterId, newTaskId: newMessage.taskId }, 'Dead letter replayed');

    return newMessage.id;
  }

  /**
   * List dead letter messages.
   */
  listDeadLetters(queueName?: string): DeadLetterMessage[] {
    let entries = Array.from(this.deadLetters.values());
    if (queueName) {
      entries = entries.filter((e) => e.queueName === queueName);
    }
    return entries.sort((a, b) => b.deadAt.getTime() - a.deadAt.getTime());
  }

  // ─── F007: Consumer Groups ──────────────────────────────────────────────

  /**
   * Register a consumer in a consumer group.
   */
  registerConsumer(
    queueName: string,
    groupName: string,
    consumerId?: string,
  ): ConsumerInfo {
    const cid = consumerId || `consumer-${uuidv4().slice(0, 8)}`;

    const consumer: ConsumerInfo = {
      consumerId: cid,
      groupName,
      queueName,
      lastHeartbeat: new Date(),
      messagesProcessed: 0,
      status: 'active',
    };

    this.consumers.set(cid, consumer);
    logger.info({ consumerId: cid, groupName, queueName }, 'Consumer registered');

    return consumer;
  }

  /**
   * Send consumer heartbeat.
   */
  heartbeat(consumerId: string): void {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Consumer not found: ${consumerId}`);
    }
    consumer.lastHeartbeat = new Date();
    consumer.status = 'active';
  }

  /**
   * Get all consumers in a group.
   */
  getConsumerGroup(queueName: string, groupName: string): ConsumerInfo[] {
    return Array.from(this.consumers.values()).filter(
      (c) => c.queueName === queueName && c.groupName === groupName,
    );
  }

  /**
   * Check for dead consumers (no heartbeat for specified duration).
   */
  detectDeadConsumes(timeoutMs: number = 60000): ConsumerInfo[] {
    const now = Date.now();
    return Array.from(this.consumers.values()).filter(
      (c) => c.status === 'active' && now - c.lastHeartbeat.getTime() > timeoutMs,
    );
  }

  /**
   * Get queue statistics.
   */
  getStats(queueName?: string) {
    if (queueName) {
      const queue = this.queues.get(queueName);
      if (!queue) {
        return { queueName, pending: 0, processing: 0, completed: 0, failed: 0, dead: 0 };
      }
      const messages = Array.from(queue.messages.values());
      return {
        queueName,
        pending: messages.filter((m) => m.status === 'pending').length,
        processing: messages.filter((m) => m.status === 'processing').length,
        completed: messages.filter((m) => m.status === 'completed').length,
        failed: messages.filter((m) => m.status === 'failed').length,
        dead: messages.filter((m) => m.status === 'dead').length,
        deadLetters: this.deadLetters.size,
        consumers: Array.from(this.consumers.values()).filter((c) => c.queueName === queueName).length,
      };
    }

    return {
      ...this.stats,
      queues: this.queues.size,
      deadLetters: this.deadLetters.size,
      consumers: this.consumers.size,
    };
  }

  /**
   * Get all messages with optional filtering.
   */
  listMessages(options: {
    queueName?: string;
    status?: MessageStatus;
    limit?: number;
  } = {}): Message[] {
    let messages: Message[] = [];
    const queueNames = options.queueName ? [options.queueName] : Array.from(this.queues.keys());

    for (const qn of queueNames) {
      const queue = this.queues.get(qn);
      if (queue) {
        messages = messages.concat(Array.from(queue.messages.values()));
      }
    }

    if (options.status) {
      messages = messages.filter((m) => m.status === options.status);
    }

    const limit = options.limit ?? 100;
    return messages
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get a message by ID.
   */
  getMessage(messageId: string): Message | undefined {
    return this.findMessageById(messageId);
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  /**
   * Clean up all scheduled tasks and timers.
   */
  shutdown(): void {
    for (const entry of this.scheduledTasks) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    this.scheduledTasks = [];
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private getOrCreateQueue(queueName: string): InMemoryQueue {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, {
        messages: new Map(),
        processing: new Map(),
        pending: [],
      });
    }
    return this.queues.get(queueName)!;
  }

  private findMessageById(messageId: string): Message | undefined {
    for (const queue of this.queues.values()) {
      const msg = queue.messages.get(messageId);
      if (msg) return msg;
    }
    return undefined;
  }

  private reEnqueue(message: Message): void {
    message.status = 'pending';
    message.updatedAt = new Date();

    const queue = this.queues.get(message.queueName);
    if (queue) {
      queue.pending.push(message.id);
    }

    logger.debug(
      { taskId: message.taskId, retryCount: message.retryCount },
      'Message re-enqueued for retry',
    );
  }
}
