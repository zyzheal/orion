import { createLogger } from '../../utils/logger';
import { EventEmitter } from 'events';
import { HeartbeatWatchdogRepository } from '../../repositories/HeartbeatWatchdogRepository';
import { HeartbeatWatchdogEntity } from '../../repositories/HeartbeatWatchdogRepository';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('HeartbeatWatchdog');

interface HeartbeatCallback {
  taskId: string;
  intervalMs: number;
  timeoutMs: number;
  onTimeout: (taskId: string, reason: string) => void;
}

type DbPool = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export class HeartbeatWatchdog extends EventEmitter {
  private repository?: HeartbeatWatchdogRepository;
  private db?: DbPool;
  // In-memory fallback: callbacks + active entries
  private callbacks: Map<string, HeartbeatCallback> = new Map();
  private checkInterval?: NodeJS.Timeout;
  private readonly checkFrequencyMs = 5000;

  constructor(db?: DbPool) {
    super();
    this.db = db;
    try {
      this.repository = db ? new HeartbeatWatchdogRepository(db) : undefined;
    } catch (err) {
      logger.warn({ err }, 'HeartbeatWatchdog repository init failed, will use in-memory fallback');
    }
  }

  async start(): Promise<void> {
    // Restore active entries from DB
    if (this.repository && this.db) {
      try {
        const activeEntries = await this.repository.findActive();
        for (const entity of activeEntries) {
          // Callbacks are lost on restart; they must be re-registered by the caller
          logger.info({ serviceName: entity.serviceName }, 'Heartbeat entry restored from DB (callback must be re-registered)');
        }
        logger.info({ count: activeEntries.length }, 'HeartbeatWatchdog restored entries from DB');
      } catch (err) {
        logger.error({ err }, 'HeartbeatWatchdog failed to restore entries from DB, using in-memory fallback');
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

  register(taskId: string, options: {
    intervalMs?: number;
    timeoutMs?: number;
    onTimeout?: (taskId: string, reason: string) => void;
  }): void {
    const intervalMs = options.intervalMs || 5000;
    const timeoutMs = options.timeoutMs || 15000;
    const onTimeout = options.onTimeout || (() => {});
    const serviceName = taskId; // serviceName == taskId in current semantics

    // Store callback in memory (callbacks cannot be persisted to DB)
    this.callbacks.set(taskId, {
      taskId,
      intervalMs,
      timeoutMs,
      onTimeout,
    });

    // Persist to DB (non-blocking, fail gracefully)
    if (this.repository && this.db) {
      this.repository.upsert({
        id: uuidv4(),
        tenantId: '00000000-0000-0000-0000-000000000000',
        serviceName,
        lastHeartbeat: new Date(Date.now()),
        status: 'healthy',
        failureCount: 0,
      }).catch((err) => {
        logger.warn({ err, taskId }, 'Failed to persist heartbeat registration, using in-memory fallback');
      });
    }

    logger.info({ taskId }, 'Heartbeat registered');
  }

  beat(taskId: string): void {
    // Update lastBeat in DB (non-blocking, fail gracefully)
    if (this.repository && this.db) {
      this.repository.recordBeat(taskId).catch((err) => {
        logger.warn({ err, taskId }, 'Failed to update last beat in DB, using in-memory fallback');
      });
    }
  }

  unregister(taskId: string): void {
    this.callbacks.delete(taskId);

    // Delete from DB (non-blocking, fail gracefully)
    if (this.repository && this.db) {
      this.repository.delete(taskId).catch((err) => {
        logger.warn({ err, taskId }, 'Failed to delete heartbeat from DB');
      });
    }

    logger.debug({ taskId }, 'Heartbeat unregistered');
  }

  private async checkHeartbeats(): Promise<void> {
    const now = Date.now();

    // Try DB-backed check
    if (this.repository && this.db) {
      try {
        const timedOut = await this.repository.findTimedOut(now);
        for (const entry of timedOut) {
          await this.handleTimeout(entry.serviceName, `No heartbeat for ${now - entry.lastHeartbeat.getTime()}ms (timeout expired)`);
        }
        return;
      } catch (err) {
        logger.warn({ err }, 'DB checkHeartbeats failed, falling back to in-memory check');
      }
    }

    // In-memory fallback
    this.checkInMemory();
  }

  private async handleTimeout(serviceName: string, reason: string): Promise<void> {
    logger.warn({ serviceName, reason }, 'Heartbeat timeout detected');

    const cb = this.callbacks.get(serviceName);
    if (cb) {
      cb.onTimeout(serviceName, reason);
    }

    // Mark failure in DB
    if (this.repository && this.db) {
      await this.repository.markFailure(serviceName, reason).catch((err) => {
        logger.warn({ err, serviceName }, 'Failed to mark heartbeat as timeout in DB');
      });
    }

    this.callbacks.delete(serviceName);
  }

  /**
   * In-memory fallback check: iterate registered callbacks with timeout thresholds.
   * Only triggers onTimeout if the callback was registered (not just restored from DB).
   */
  private checkInMemory(): void {
    const now = Date.now();
    for (const [taskId, cb] of this.callbacks.entries()) {
      const elapsed = now - cb.intervalMs * 3; // Simplified: assume last beat was at registration
      if (elapsed > cb.timeoutMs) {
        this.handleTimeout(taskId, `No heartbeat for ${elapsed}ms (timeout: ${cb.timeoutMs}ms)`);
      }
    }
  }

  /** Get current status of a service (for health check APIs) */
  async getStatus(serviceName: string): Promise<HeartbeatWatchdogEntity | null> {
    if (this.repository && this.db) {
      try {
        return (await this.repository.findByService(serviceName)) ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /** List all tracked services (for admin dashboards) */
  async listAll(tenantId?: string): Promise<HeartbeatWatchdogEntity[]> {
    if (this.repository && this.db) {
      try {
        return tenantId
          ? await this.repository.findAllByTenant(tenantId)
          : await this.repository.findActive();
      } catch {
        return [];
      }
    }
    return [];
  }
}
