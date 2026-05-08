import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface HeartbeatEntry {
  taskId: string;
  lastBeat: number;
  intervalMs: number;
  timeoutMs: number;
  onTimeout: (taskId: string, reason: string) => void;
}

export class HeartbeatWatchdog extends EventEmitter {
  private entries: Map<string, HeartbeatEntry> = new Map();
  private checkInterval?: NodeJS.Timeout;
  private readonly checkFrequencyMs = 5000;

  start(): void {
    this.checkInterval = setInterval(() => this.checkHeartbeats(), this.checkFrequencyMs);
    logger.info('HeartbeatWatchdog started');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    this.entries.clear();
    logger.info('HeartbeatWatchdog stopped');
  }

  register(taskId: string, options: { intervalMs?: number; timeoutMs?: number; onTimeout?: (taskId: string, reason: string) => void }): void {
    this.entries.set(taskId, {
      taskId,
      lastBeat: Date.now(),
      intervalMs: options.intervalMs || 5000,
      timeoutMs: options.timeoutMs || 15000,
      onTimeout: options.onTimeout || (() => {}),
    });
    logger.info({ taskId }, 'Heartbeat registered');
  }

  beat(taskId: string): void {
    const entry = this.entries.get(taskId);
    if (entry) {
      entry.lastBeat = Date.now();
    }
  }

  unregister(taskId: string): void {
    this.entries.delete(taskId);
    logger.debug({ taskId }, 'Heartbeat unregistered');
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    for (const [taskId, entry] of this.entries) {
      const elapsed = now - entry.lastBeat;
      if (elapsed > entry.timeoutMs) {
        logger.warn({ taskId, elapsed }, 'Heartbeat timeout detected');
        entry.onTimeout(taskId, `No heartbeat for ${elapsed}ms (timeout: ${entry.timeoutMs}ms)`);
        this.entries.delete(taskId);
      }
    }
  }
}
