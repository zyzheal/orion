/**
 * Authentication Cleanup Service
 *
 * Periodic background tasks for authentication hygiene:
 *   1. Clean expired blacklist entries (Redis + DB)
 *   2. Clean expired refresh tokens
 *   3. Auto-restore expired suspended users
 *   4. Clean expired SSO states
 *   5. Clean expired spans (distributed tracing)
 *   6. Clean expired slow queries (APM)
 *
 * Runs every 5 minutes via node-cron.
 */

import cron from 'node-cron';
import { DatabasePool } from '../../services/database';
import { TokenBlacklistService } from '../auth/TokenBlacklistService';
import { TracingService } from '../monitoring/TracingService';
import { DatabaseProfiler } from '../monitoring/DatabaseProfiler';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface AuthCleanupConfig {
  /** Cron schedule (default: every 5 minutes) */
  schedule?: string;
  /** Blacklist retention days (default: 7) */
  blacklistRetentionDays?: number;
  /** Span retention days (default: 7) */
  spanRetentionDays?: number;
  /** Slow query retention days (default: 30) */
  slowQueryRetentionDays?: number;
  /** SSO state retention minutes (default: 30) */
  ssoStateRetentionMinutes?: number;
}

const DEFAULT_CONFIG: Required<AuthCleanupConfig> = {
  schedule: '*/5 * * * *', // Every 5 minutes
  blacklistRetentionDays: 7,
  spanRetentionDays: 7,
  slowQueryRetentionDays: 30,
  ssoStateRetentionMinutes: 30,
};

export class AuthCleanupService {
  private pool: DatabasePool;
  private tokenBlacklist: TokenBlacklistService;
  private tracingService?: TracingService;
  private dbProfiler?: DatabaseProfiler;
  private config: Required<AuthCleanupConfig>;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(
    pool: DatabasePool,
    tokenBlacklist: TokenBlacklistService,
    options?: AuthCleanupConfig,
  ) {
    this.pool = pool;
    this.tokenBlacklist = tokenBlacklist;
    this.config = { ...DEFAULT_CONFIG, ...options };
  }

  /**
   * Set optional services (initialized after route registration)
   */
  setTracingService(service: TracingService): void {
    this.tracingService = service;
  }

  setDbProfiler(profiler: DatabaseProfiler): void {
    this.dbProfiler = profiler;
  }

  /**
   * Start the periodic cleanup job
   */
  start(): void {
    if (this.cronJob) {
      this.stop();
    }

    this.cronJob = cron.schedule(this.config.schedule, async () => {
      try {
        await this.runAllCleanup();
      } catch (error) {
        logger.error('[AuthCleanupService] Cleanup job failed:', error);
      }
    });

    // Allow process to exit without waiting for cron
    this.cronJob.unref?.();

    logger.info(`[AuthCleanupService] Started, runs on schedule: ${this.config.schedule}`);
  }

  /**
   * Stop the periodic cleanup job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('[AuthCleanupService] Stopped');
    }
  }

  /**
   * Run all cleanup tasks
   */
  async runAllCleanup(): Promise<void> {
    const results = await Promise.allSettled([
      this.cleanupExpiredBlacklist(),
      this.cleanupExpiredRefreshTokens(),
      this.cleanupExpiredSsoStates(),
      this.checkSuspensionExpiry(),
      this.cleanupExpiredSpans(),
      this.cleanupExpiredSlowQueries(),
    ]);

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`[AuthCleanupService] Task ${index} failed:`, result.reason);
      }
    });
  }

  /**
   * Clean expired entries from token blacklist
   */
  async cleanupExpiredBlacklist(): Promise<number> {
    return this.tokenBlacklist.cleanupExpired();
  }

  /**
   * Clean expired refresh tokens
   */
  async cleanupExpiredRefreshTokens(): Promise<number> {
    try {
      const result = await this.pool.query(
        'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
      );
      const count = result.rowCount ?? 0;
      if (count > 0) {
        logger.debug(`[AuthCleanup] Cleaned ${count} expired refresh tokens`);
      }
      return count;
    } catch (error) {
      logger.warn('[AuthCleanup] Failed to cleanup refresh tokens:', error);
      return 0;
    }
  }

  /**
   * Auto-restore users whose suspension period has expired
   */
  async checkSuspensionExpiry(): Promise<number> {
    try {
      const result = await this.pool.query(
        `UPDATE users
         SET status = 'active', updated_at = NOW()
         WHERE status = 'suspended'
           AND suspension_expires_at IS NOT NULL
           AND suspension_expires_at < NOW()
         RETURNING id, username`
      );

      const count = result.rowCount ?? 0;
      if (count > 0) {
        for (const user of result.rows) {
          logger.info(
            { userId: user.id, username: user.username },
            `[AuthCleanup] Auto-restored suspended user: ${user.username}`
          );

          // Log to audit trail
          await this.pool.query(
            `INSERT INTO user_status_history (user_id, old_status, new_status, reason, operator_id, changed_at)
             VALUES ($1, 'suspended', 'active', 'Suspension period expired, auto restored', 'system', NOW())`,
            [user.id]
          );
        }
      }

      return count;
    } catch (error) {
      logger.warn('[AuthCleanup] Failed to check suspension expiry:', error);
      return 0;
    }
  }

  /**
   * Clean expired SSO state entries
   */
  async cleanupExpiredSsoStates(): Promise<number> {
    try {
      const result = await this.pool.query(
        'DELETE FROM sso_states WHERE expires_at < NOW()'
      );
      const count = result.rowCount ?? 0;
      if (count > 0) {
        logger.debug(`[AuthCleanup] Cleaned ${count} expired SSO states`);
      }
      return count;
    } catch (error) {
      logger.warn('[AuthCleanup] Failed to cleanup SSO states:', error);
      return 0;
    }
  }

  /**
   * Clean expired distributed tracing spans
   */
  async cleanupExpiredSpans(): Promise<number> {
    if (!this.tracingService) {
      return 0;
    }

    try {
      const count = await this.tracingService.cleanupExpired(this.config.spanRetentionDays);
      if (count > 0) {
        logger.debug(`[AuthCleanup] Cleaned ${count} expired spans (> ${this.config.spanRetentionDays} days)`);
      }
      return count;
    } catch (error) {
      logger.warn('[AuthCleanup] Failed to cleanup spans:', error);
      return 0;
    }
  }

  /**
   * Clean expired slow query entries
   */
  async cleanupExpiredSlowQueries(): Promise<number> {
    if (!this.dbProfiler) {
      return 0;
    }

    try {
      const count = await this.dbProfiler.cleanupExpired(this.config.slowQueryRetentionDays);
      if (count > 0) {
        logger.debug(`[AuthCleanup] Cleaned ${count} expired slow queries (> ${this.config.slowQueryRetentionDays} days)`);
      }
      return count;
    } catch (error) {
      logger.warn('[AuthCleanup] Failed to cleanup slow queries:', error);
      return 0;
    }
  }

  /**
   * Run a one-time manual cleanup (for admin API or CLI)
   */
  async runManualCleanup(options?: {
    blacklist?: boolean;
    refreshTokens?: boolean;
    ssoStates?: boolean;
    spans?: boolean;
    slowQueries?: boolean;
    suspensionExpiry?: boolean;
  }): Promise<{
    blacklist: number;
    refreshTokens: number;
    ssoStates: number;
    spans: number;
    slowQueries: number;
    suspensionExpiry: number;
  }> {
    const opts = options || {
      blacklist: true,
      refreshTokens: true,
      ssoStates: true,
      spans: true,
      slowQueries: true,
      suspensionExpiry: true,
    };

    return {
      blacklist: opts.blacklist ? await this.cleanupExpiredBlacklist() : 0,
      refreshTokens: opts.refreshTokens ? await this.cleanupExpiredRefreshTokens() : 0,
      ssoStates: opts.ssoStates ? await this.cleanupExpiredSsoStates() : 0,
      spans: opts.spans ? await this.cleanupExpiredSpans() : 0,
      slowQueries: opts.slowQueries ? await this.cleanupExpiredSlowQueries() : 0,
      suspensionExpiry: opts.suspensionExpiry ? await this.checkSuspensionExpiry() : 0,
    };
  }
}
