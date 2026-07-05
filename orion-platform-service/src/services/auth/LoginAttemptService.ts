/**
 * LoginAttemptService — Account Lockout and Login Failure Tracking
 *
 * Storage: Two-tier persistence:
 *   Layer 1: PostgreSQL via UserRepository (source-of-truth: failed_login_attempts, locked_until)
 *   Layer 2: FallbackStorageService (cross-restart in-memory cache with TTL)
 *   Layer 3: In-memory Map (fast synchronous read-through, write-through to storage)
 *
 * The in-memory Map provides synchronous fast reads during authentication.
 * FallbackStorageService provides persistence across process restarts.
 * PostgreSQL UserRepository is the authoritative source.
 *
 * Usage:
 *   const loginAttemptService = new LoginAttemptService(userRepository);
 *   await loginAttemptService.connect(); // init FallbackStorageService + warm cache
 *   await loginAttemptService.recordFailure(userId);
 *   const isLocked = await loginAttemptService.isLocked(userId);
 *   await loginAttemptService.recordSuccess(userId);
 *   await loginAttemptService.disconnect(); // cleanup
 */

import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { UserRepository, User } from '../user/UserRepository';
import { FallbackStorageService } from '../fallback/FallbackStorageService';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('login-attempt-service');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LoginAttemptConfig {
  /** Maximum consecutive failures before lockout (default: 5) */
  maxAttempts: number;
  /** Lockout duration in milliseconds (default: 15 minutes) */
  lockDurationMs: number;
  /** Stale entry cleanup interval in milliseconds (default: 10 minutes) */
  cleanupIntervalMs: number;
}

export const DEFAULT_LOGIN_ATTEMPT_CONFIG: LoginAttemptConfig = {
  maxAttempts: 5,
  lockDurationMs: 15 * 60 * 1000, // 15 minutes
  cleanupIntervalMs: 10 * 60 * 1000, // 10 minutes
};

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

interface LockState {
  userId: string;
  lockedUntil: Date;
  failureCount: number;
}

// ---------------------------------------------------------------------------
// LoginAttemptService
// ---------------------------------------------------------------------------

export class LoginAttemptService {
  private config: LoginAttemptConfig;
  private userRepository: UserRepository;

  // In-memory write-through cache (fast synchronous reads)
  private lockStates: Map<string, LockState> = new Map();

  // FallbackStorageService for cross-restart persistence
  private storage: FallbackStorageService;

  // Periodic cleanup timer for in-memory Map
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    userRepository: UserRepository,
    config: Partial<LoginAttemptConfig> = {},
    storage?: FallbackStorageService,
  ) {
    this.config = { ...DEFAULT_LOGIN_ATTEMPT_CONFIG, ...config };
    this.userRepository = userRepository;

    // Initialize FallbackStorageService with login-attempt-specific prefix
    // TTL matches lockDurationMs so entries auto-expire when lock expires
    this.storage = storage ?? new FallbackStorageService({
      prefix: 'login:lock',
      maxSize: 1000,
      ttlMs: this.config.lockDurationMs,
      persistToDb: false,
      tenantId: 'global',
    });
  }

  // ======================== Lifecycle ========================

  /**
   * Connect — initialize FallbackStorageService and warm cache from storage.
   * Call this after construction to enable FallbackStorageService-backed caching.
   */
  async connect(): Promise<void> {
    this.storage.start();
    await this.loadFromStorage();
    this.startPeriodicCleanup();
    logger.info(
      {
        maxAttempts: this.config.maxAttempts,
        lockDurationMs: this.config.lockDurationMs,
        traceId: getCurrentTraceId(),
      },
      '[LoginAttemptService] Connected',
    );
  }

  /**
   * Disconnect — clear in-memory cache and FallbackStorageService.
   */
  async disconnect(): Promise<void> {
    this.stopPeriodicCleanup();
    this.lockStates.clear();
    await this.storage.clear();
    logger.info(
      { traceId: getCurrentTraceId() },
      '[LoginAttemptService] Disconnected',
    );
  }

  /**
   * Start the service (begin periodic cleanup).
   * Legacy sync method — prefer connect() for full FallbackStorageService init.
   */
  start(): void {
    this.stopPeriodicCleanup();
    this.startPeriodicCleanup();
    logger.info(
      {
        maxAttempts: this.config.maxAttempts,
        lockDurationMs: this.config.lockDurationMs,
        traceId: getCurrentTraceId(),
      },
      '[LoginAttemptService] Started',
    );
  }

  /**
   * Stop the service (clear timer and cache).
   * Legacy sync method — prefer disconnect() for full FallbackStorageService cleanup.
   */
  stop(): void {
    this.stopPeriodicCleanup();
    this.lockStates.clear();
    logger.info(
      { traceId: getCurrentTraceId() },
      '[LoginAttemptService] Stopped',
    );
  }

  // ======================== Core API ========================

  /**
   * Record a failed login attempt for a user.
   * Returns lock status after recording the failure.
   *
   * @param userId - User ID that failed to authenticate
   * @returns Object with attempts count and whether the account is now locked
   */
  async recordFailure(userId: string): Promise<{
    attempts: number;
    locked: boolean;
    lockedUntil: Date | null;
  }> {
    // Load current user state and atomically increment the failure counter
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new OrionError(`User not found: ${userId}`, ErrorCode.NOT_FOUND);
    }

    const newAttempts = (user.failed_login_attempts || 0) + 1;
    const lockedUntil = newAttempts >= this.config.maxAttempts
      ? new Date(Date.now() + this.config.lockDurationMs)
      : null;

    await this.userRepository.update(userId, {
      failed_login_attempts: newAttempts,
      locked_until: lockedUntil,
    });

    const result = { attempts: newAttempts, lockedUntil };

    // Update in-memory write-through cache + FallbackStorageService
    if (result.lockedUntil) {
      const lockState: LockState = {
        userId,
        lockedUntil: result.lockedUntil,
        failureCount: result.attempts,
      };
      this.lockStates.set(userId, lockState);
      await this.storage.set(userId, lockState, this.config.lockDurationMs);
    } else {
      // Update or remove the cache entry
      const existing = this.lockStates.get(userId);
      if (existing) {
        existing.failureCount = result.attempts;
        if (result.attempts === 0) {
          this.lockStates.delete(userId);
          await this.storage.delete(userId);
        } else {
          await this.storage.set(userId, existing, this.config.lockDurationMs);
        }
      }
    }

    const locked = result.lockedUntil !== null && result.lockedUntil > new Date();

    if (locked) {
      logger.warn(
        {
          userId,
          attempts: result.attempts,
          lockedUntil: result.lockedUntil,
          traceId: getCurrentTraceId(),
        },
        '[LoginAttemptService] Account locked due to excessive failed logins',
      );
    }

    return {
      attempts: result.attempts,
      locked,
      lockedUntil: result.lockedUntil,
    };
  }

  /**
   * Record a successful login for a user. Resets failure counter and clears lock.
   *
   * @param userId - User ID that successfully authenticated
   */
  async recordSuccess(userId: string): Promise<void> {
    // Reset in-memory write-through cache + FallbackStorageService
    this.lockStates.delete(userId);
    await this.storage.delete(userId);

    // Reset DB state
    await this.userRepository.resetLoginAttempts(userId);

    logger.debug(
      { userId, traceId: getCurrentTraceId() },
      '[LoginAttemptService] Login success recorded, counter reset',
    );
  }

  /**
   * Check if a user's account is currently locked.
   *
   * @param userId - User ID to check
   * @returns true if account is locked (lock not expired)
   */
  async isLocked(userId: string): Promise<boolean> {
    // Check in-memory write-through cache first (fastest)
    const cached = this.lockStates.get(userId);
    if (cached) {
      if (cached.lockedUntil > new Date()) {
        return true;
      }
      // Cache entry expired — remove and fall through
      this.lockStates.delete(userId);
    }

    // Fall back to FallbackStorageService (handles its own TTL expiry)
    const stored = await this.storage.get<LockState>(userId);
    if (stored) {
      const lockState: LockState = {
        userId: stored.userId,
        lockedUntil: new Date(stored.lockedUntil),
        failureCount: stored.failureCount,
      };
      if (lockState.lockedUntil > new Date()) {
        // Re-populate in-memory cache for subsequent fast reads
        this.lockStates.set(userId, lockState);
        return true;
      }
      // Expired in storage — clean up
      await this.storage.delete(userId);
    }

    // Fall back to DB
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return false;
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      // Update caches
      const lockState: LockState = {
        userId,
        lockedUntil: new Date(user.locked_until),
        failureCount: user.failed_login_attempts || 0,
      };
      this.lockStates.set(userId, lockState);
      await this.storage.set(userId, lockState, this.config.lockDurationMs);
      return true;
    }

    // Lock expired in DB but not yet reset — clean it up
    if (user.locked_until && new Date(user.locked_until) <= new Date()) {
      await this.userRepository.resetLoginAttempts(userId);
    }

    return false;
  }

  /**
   * Get remaining lockout time in milliseconds (0 if not locked).
   *
   * @param userId - User ID to check
   * @returns Milliseconds until lock expires, or 0
   */
  async getRemainingLockTime(userId: string): Promise<number> {
    // Check in-memory cache first
    const cached = this.lockStates.get(userId);
    if (cached) {
      const remaining = cached.lockedUntil.getTime() - Date.now();
      return Math.max(0, remaining);
    }

    // Fall back to FallbackStorageService
    const stored = await this.storage.get<LockState>(userId);
    if (stored) {
      const lockedUntil = new Date(stored.lockedUntil);
      if (lockedUntil > new Date()) {
        const remaining = lockedUntil.getTime() - Date.now();
        return Math.max(0, remaining);
      }
      await this.storage.delete(userId);
    }

    const user = await this.userRepository.findById(userId);
    if (!user || !user.locked_until) {
      return 0;
    }

    const remaining = new Date(user.locked_until).getTime() - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Manually unlock a user account (admin operation).
   * Clears lock state in both cache and database.
   *
   * @param userId - User ID to unlock
   */
  async unlockAccount(userId: string): Promise<void> {
    this.lockStates.delete(userId);
    await this.storage.delete(userId);
    await this.userRepository.resetLoginAttempts(userId);

    logger.info(
      { userId, traceId: getCurrentTraceId() },
      '[LoginAttemptService] Account manually unlocked',
    );
  }

  /**
   * Get current failure count for a user.
   *
   * @param userId - User ID
   * @returns Current consecutive failure count
   */
  async getFailureCount(userId: string): Promise<number> {
    // Check in-memory cache first
    const cached = this.lockStates.get(userId);
    if (cached) {
      return cached.failureCount;
    }

    // Fall back to FallbackStorageService
    const stored = await this.storage.get<LockState>(userId);
    if (stored) {
      return stored.failureCount;
    }

    const user = await this.userRepository.findById(userId);
    return user?.failed_login_attempts || 0;
  }

  /**
   * Pre-check before authentication: returns early if account is locked.
   * Use this at the start of the login flow to short-circuit.
   *
   * @param userId - User ID attempting to login
   * @throws OrionError (UNAUTHORIZED) if account is locked
   */
  async requireNotLocked(userId: string): Promise<void> {
    if (await this.isLocked(userId)) {
      const remainingMs = await this.getRemainingLockTime(userId);
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      throw new OrionError(
        `账户已被锁定，请在 ${remainingMinutes} 分钟后重试或联系管理员解锁`,
        ErrorCode.UNAUTHORIZED,
        false,
        {
          userId,
          locked: true,
          remainingMs,
          remainingMinutes,
        },
      );
    }
  }

  // ======================== Internal ========================

  /**
   * Start periodic cleanup of stale in-memory Map entries.
   * FallbackStorageService handles its own TTL expiry automatically.
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleEntries();
    }, this.config.cleanupIntervalMs);

    // Allow process exit without waiting for timer
    this.cleanupTimer.unref?.();
  }

  private stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Load persisted lock states from FallbackStorageService into in-memory cache.
   * Called during connect() for cache warming.
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const keys = await this.storage.keys();
      let loaded = 0;
      for (const key of keys) {
        const stored = await this.storage.get<LockState>(key);
        if (stored) {
          this.lockStates.set(key, {
            userId: stored.userId,
            lockedUntil: new Date(stored.lockedUntil),
            failureCount: stored.failureCount,
          });
          loaded++;
        }
      }
      if (loaded > 0) {
        logger.debug(
          { loaded, traceId: getCurrentTraceId() },
          '[LoginAttemptService] Cache warmed from FallbackStorageService',
        );
      }
    } catch (error) {
      logger.warn(
        { error, traceId: getCurrentTraceId() },
        '[LoginAttemptService] Failed to load from FallbackStorageService',
      );
    }
  }

  /**
   * Remove stale lock state entries whose lock has expired from in-memory Map.
   * FallbackStorageService TTL handles its own expiry automatically.
   */
  private cleanupStaleEntries(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [userId, state] of this.lockStates.entries()) {
      if (state.lockedUntil <= now) {
        this.lockStates.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(
        { cleaned, traceId: getCurrentTraceId() },
        '[LoginAttemptService] Cleaned stale lock entries',
      );
    }
  }
}
