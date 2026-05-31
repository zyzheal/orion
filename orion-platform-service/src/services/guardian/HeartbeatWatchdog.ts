import pino from 'pino';
import { EventEmitter } from 'events';
import { HeartbeatRegistryRepository } from '../../repositories/HeartbeatRegistryRepository';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface HeartbeatEntry {
  taskId: string;
  lastBeat: number;
  intervalMs: number;
  timeoutMs: number;
  onTimeout: (taskId: string, reason: string) => void;
}

export class HeartbeatWatchdog extends EventEmitter {
  private repository?: HeartbeatRegistryRepository;
  // In-memory callback map (callbacks cannot be persisted to DB)
  private callbacks: Map<string, (taskId: string, reason: string) => void> = new Map();
  private checkInterval?: NodeJS.Timeout;
  private readonly checkFrequencyMs = 5000;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super();
    if (db) {
      this.repository = new HeartbeatRegistryRepository(db);
    }
  }

  async start(): Promise<void> {
    // Restore active entries from DB
    if (this.repository) {
      try {
        const activeEntries = await this.repository.findActive();
        for (const entity of activeEntries) {
          // Callbacks are lost on restart; they must be re-registered by the caller
          logger.info({ taskId: entity.taskId }, 'Heartbeat entry restored from DB (callback must be re-registered)');
        }
        logger.info({ count: activeEntries.length }, 'HeartbeatWatchdog restored entries from DB');
      } catch (err) {
        logger.error({ err }, 'HeartbeatWatchdog failed to restore entries from DB');
      }
    }

    this.checkInterval = setInterval(() => this.checkHeartbeats(), this.checkFrequencyMs);
    this.checkInterval.unref();
    logger.info('HeartbeatWatchdog started');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    this.callbacks.clear();
    logger.info('HeartbeatWatchdog stopped');
  }

  register(taskId: string, options: { intervalMs?: number; timeoutMs?: number; onTimeout?: (taskId: string, reason: string) => void }): void {
    const intervalMs = options.intervalMs || 5000;
    const timeoutMs = options.timeoutMs || 15000;
    const onTimeout = options.onTimeout || (() => {});

    // Store callback in memory
    this.callbacks.set(taskId, onTimeout);

    // Persist to DB
    if (this.repository) {
      this.repository.create({
        id: uuidv4(),
        taskId,
        intervalMs,
        timeoutMs,
        lastBeat: Date.now(),
        status: 'active',
      }).catch((err) => {
        logger.warn({ err, taskId }, 'Failed to persist heartbeat registration');
      });
    }

    logger.info({ taskId }, 'Heartbeat registered');
  }

  beat(taskId: string): void {
    // Update lastBeat in DB
    if (this.repository) {
      this.repository.updateLastBeat(taskId, Date.now()).catch((err) => {
        logger.warn({ err, taskId }, 'Failed to update last beat in DB');
      });
    }
  }

  unregister(taskId: string): void {
    this.callbacks.delete(taskId);

    if (this.repository) {
      this.repository.deleteByTaskId(taskId).catch((err) => {
        logger.warn({ err, taskId }, 'Failed to delete heartbeat from DB');
      });
    }

    logger.debug({ taskId }, 'Heartbeat unregistered');
  }

  private async checkHeartbeats(): Promise<void> {
    const now = Date.now();

    if (this.repository) {
      try {
        const activeEntries = await this.repository.findActive();
        for (const entry of activeEntries) {
          const elapsed = now - entry.lastBeat;
          if (elapsed > entry.timeoutMs) {
            logger.warn({ taskId: entry.taskId, elapsed }, 'Heartbeat timeout detected');
            const callback = this.callbacks.get(entry.taskId);
            if (callback) {
              callback(entry.taskId, `No heartbeat for ${elapsed}ms (timeout: ${entry.timeoutMs}ms)`);
            }
            // Mark as timeout in DB
            await this.repository.markTimeout(entry.taskId).catch((err) => {
              logger.warn({ err, taskId: entry.taskId }, 'Failed to mark heartbeat as timeout');
            });
            this.callbacks.delete(entry.taskId);
          }
        }
        return;
      } catch (err) {
        logger.warn({ err }, 'DB checkHeartbeats failed, no fallback available');
      }
    }
  }
}
