/**
 * Token Refresh Guard Service
 *
 * Implements concurrent refresh protection using Redis Lua scripts
 * - Atomic token refresh operations
 * - Concurrent refresh detection (revoke all tokens)
 * - Anomalous login alerts
 */

import { FastifyInstance } from 'fastify';
import { DeviceFingerprintService, AnomalousLoginEvent } from './DeviceFingerprint';

export interface RefreshResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshTokenExpiresIn?: number;
  revoked?: boolean; // Token was revoked due to concurrent refresh
  anomalousLogin?: AnomalousLoginEvent;
}

export interface TokenRefreshAttempt {
  refreshToken: string;
  userId: string;
  deviceId?: string;
  fingerprint?: string;
  ip: string;
  userAgent?: string;
}

export interface RefreshAuditLog {
  userId: string;
  refreshToken: string;
  deviceId?: string;
  fingerprint?: string;
  ip: string;
  success: boolean;
  revoked: boolean;
  timestamp: number;
  reason?: string;
}

export class TokenRefreshGuard {
  private redisClient: any;
  private deviceFingerprintService: DeviceFingerprintService | null = null;
  private readonly REFRESH_TOKEN_PREFIX = 'refresh_token:';
  private readonly USED_JTI_PREFIX = 'used_jti:';
  private readonly CONCURRENT_PREFIX = 'concurrent_refresh:';
  private readonly AUDIT_LOG_PREFIX = 'refresh_audit:';
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly AUDIT_LOG_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Lua script for atomic token refresh with concurrent detection
  private readonly ATOMIC_REFRESH_SCRIPT = `
    local refreshTokenKey = KEYS[1]
    local usedJtiKey = KEYS[2]
    local concurrentKey = KEYS[3]
    local newTokenKey = KEYS[4]
    local deviceId = ARGV[1]
    local newJti = ARGV[2]
    local newTokenData = ARGV[3]
    local expires = tonumber(ARGV[4])
    local now = tonumber(ARGV[5])

    -- 1. Check if token is being concurrently refreshed
    local concurrentRefresh = redis.call('GET', concurrentKey)
    if concurrentRefresh and tonumber(concurrentRefresh) > (now - 5000) then
      -- Another refresh is in progress within last 5 seconds
      -- This is a concurrent refresh attack, revoke everything
      redis.call('DEL', refreshTokenKey)
      redis.call('DEL', concurrentKey)
      return {err = 'CONCURRENT_REFRESH', code = 1}
    end

    -- 2. Get current token data
    local tokenData = redis.call('GET', refreshTokenKey)
    if not tokenData then
      return {err = 'TOKEN_NOT_FOUND', code = 2}
    end

    local data = cjson.decode(tokenData)

    -- 3. Check device fingerprint if provided
    if deviceId and deviceId ~= '' and data.deviceId and data.deviceId ~= deviceId then
      redis.call('DEL', refreshTokenKey)
      return {err = 'DEVICE_MISMATCH', code = 3}
    end

    -- 4. Check if JTI is already used (replay attack)
    local existingJti = redis.call('GET', usedJtiKey)
    if existingJti then
      -- Token already used, this is a replay attack
      redis.call('DEL', refreshTokenKey)
      return {err = 'REPLAY_ATTACK', code = 4}
    end

    -- 5. Mark refresh as in progress
    redis.call('SET', concurrentKey, tostring(now), 'PX', 5000)

    -- 6. Mark old JTI as used
    local oldJti = data.jti
    if oldJti then
      redis.call('SET', 'used_jti:' .. oldJti, '1', 'PX', expires)
    end

    -- 7. Delete old refresh token
    redis.call('DEL', refreshTokenKey)

    -- 8. Store new token data
    redis.call('SET', newTokenKey, newTokenData, 'PX', expires)

    -- 9. Mark new JTI as used
    redis.call('SET', 'used_jti:' .. newJti, '1', 'PX', expires)

    -- 10. Return user info
    return {ok = cjson.encode({userId = data.userId, deviceId = data.deviceId, fingerprint = data.fingerprint})}
  `;

  // Lua script for detecting and handling concurrent refresh attacks
  private readonly DETECT_CONCURRENT_SCRIPT = `
    local userId = KEYS[1]
    local refreshToken = KEYS[2]
    local now = tonumber(ARGV[1])
    local windowMs = tonumber(ARGV[2])

    -- Get recent refresh attempts
    local key = 'refresh_attempts:' .. userId
    local attempts = redis.call('LRANGE', key, 0, -1)

    local recentAttempts = {}
    for i, attempt in ipairs(attempts) do
      local data = cjson.decode(attempt)
      if data.timestamp > (now - windowMs) then
        table.insert(recentAttempts, data)
      end
    end

    -- Check for concurrent attempts
    if #recentAttempts >= 2 then
      -- Multiple refresh attempts detected, check if different tokens
      local tokens = {}
      for i, attempt in ipairs(recentAttempts) do
        tokens[attempt.token] = true
      end

      if #recentAttempts >= 2 and next(tokens, next(tokens)) ~= nil then
        -- Different tokens being refreshed concurrently = attack
        return 'CONCURRENT_ATTACK'
      end
    end

    -- Record this attempt
    local currentAttempt = cjson.encode({token = refreshToken, timestamp = now})
    redis.call('LPUSH', key, currentAttempt)
    redis.call('LTRIM', key, 0, 9) -- Keep last 10 attempts
    redis.call('EXPIRE', key, math.floor(windowMs / 1000))

    return 'OK'
  `;

  // Lua script for atomic token revocation
  private readonly REVOKE_ALL_SCRIPT = `
    local pattern = ARGV[1]
    local userId = ARGV[2]

    local cursor = '0'
    local count = 0
    repeat
      local result = redis.call('SCAN', cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = result[1]
      local keys = result[2]

      for i, key in ipairs(keys) do
        local data = redis.call('GET', key)
        if data then
          local decoded = cjson.decode(data)
          if decoded.userId == userId then
            -- Delete the token
            redis.call('DEL', key)
            -- Delete the JTI record
            if decoded.jti then
              redis.call('DEL', 'used_jti:' .. decoded.jti)
            end
            count = count + 1
          end
        end
      end
    until cursor == '0'

    return count
  `;

  constructor(private app: FastifyInstance) {
    this.redisClient = null;
  }

  /**
   * Set Redis client
   */
  setRedisClient(client: any): void {
    this.redisClient = client;
  }

  /**
   * Set device fingerprint service
   */
  setDeviceFingerprintService(service: DeviceFingerprintService): void {
    this.deviceFingerprintService = service;
  }

  /**
   * Execute atomic refresh with Lua script
   */
  async executeAtomicRefresh(
    refreshToken: string,
    newJti: string,
    newRefreshToken: string,
    userId: string,
    deviceId?: string,
    fingerprint?: string,
    expiresAt?: number
  ): Promise<{ success: boolean; data?: any; error?: string; code?: number }> {
    if (!this.redisClient) {
      return { success: false, error: 'Redis not connected', code: 0 };
    }

    const now = Date.now();
    const expires = expiresAt || now + this.REFRESH_TOKEN_TTL;

    const newTokenData = JSON.stringify({
      userId,
      deviceId,
      fingerprint,
      jti: newJti,
      exp: expires,
    });

    try {
      const result = await this.redisClient.eval(
        this.ATOMIC_REFRESH_SCRIPT,
        4,
        `${this.REFRESH_TOKEN_PREFIX}${refreshToken}`,
        `${this.USED_JTI_PREFIX}${refreshToken}`,
        `${this.CONCURRENT_PREFIX}${refreshToken}`,
        `${this.REFRESH_TOKEN_PREFIX}${newRefreshToken}`,
        deviceId || '',
        newJti,
        newTokenData,
        String(expires - now),
        String(now)
      );

      if (result && result.ok) {
        const data = typeof result.ok === 'string' ? JSON.parse(result.ok) : result.ok;
        return { success: true, data };
      }

      if (result && result.err) {
        return { success: false, error: result.err, code: result.code };
      }

      return { success: false, error: 'Unknown error', code: 99 };
    } catch (error) {
      this.app.log.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Atomic refresh failed'
      );
      return { success: false, error: 'Redis error', code: 100 };
    }
  }

  /**
   * Check for concurrent refresh attempts
   */
  async detectConcurrentRefresh(
    userId: string,
    refreshToken: string,
    windowMs: number = 5000
  ): Promise<boolean> {
    if (!this.redisClient) {
      return false;
    }

    try {
      const result = await this.redisClient.eval(
        this.DETECT_CONCURRENT_SCRIPT,
        2,
        userId,
        refreshToken,
        String(Date.now()),
        String(windowMs)
      );

      return result === 'CONCURRENT_ATTACK';
    } catch (error) {
      this.app.log.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Concurrent detection failed'
      );
      return false;
    }
  }

  /**
   * Revoke all tokens for a user (used when concurrent attack detected)
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    if (!this.redisClient) {
      return 0;
    }

    try {
      const count = await this.redisClient.eval(
        this.REVOKE_ALL_SCRIPT,
        0,
        `${this.REFRESH_TOKEN_PREFIX}*`,
        userId
      );

      this.app.log.warn(
        { userId, count },
        'All user tokens revoked due to concurrent refresh attack'
      );

      return count;
    } catch (error) {
      this.app.log.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Revoke all tokens failed'
      );
      return 0;
    }
  }

  /**
   * Record refresh attempt for audit
   */
  async recordRefreshAttempt(
    userId: string,
    refreshToken: string,
    deviceId?: string,
    fingerprint?: string,
    ip?: string,
    success: boolean = true,
    revoked: boolean = false,
    reason?: string
  ): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    const log: RefreshAuditLog = {
      userId,
      refreshToken: refreshToken.substring(0, 8) + '...', // Truncate for security
      deviceId,
      fingerprint,
      ip: ip || 'unknown',
      success,
      revoked,
      timestamp: Date.now(),
      reason,
    };

    const key = `${this.AUDIT_LOG_PREFIX}${userId}`;
    await this.redisClient.lpush(key, JSON.stringify(log));
    await this.redisClient.ltrim(key, 0, 99); // Keep last 100 entries
    await this.redisClient.expire(key, Math.floor(this.AUDIT_LOG_TTL / 1000));
  }

  /**
   * Get refresh audit log for a user
   */
  async getRefreshAuditLog(userId: string, limit: number = 20): Promise<RefreshAuditLog[]> {
    if (!this.redisClient) {
      return [];
    }

    const key = `${this.AUDIT_LOG_PREFIX}${userId}`;
    const logs = await this.redisClient.lrange(key, 0, limit - 1);

    return logs.map((log: string) => JSON.parse(log));
  }

  /**
   * Validate refresh request before processing
   * Returns error message if validation fails, null if OK
   */
  async validateRefreshRequest(
    refreshToken: string,
    userId: string,
    deviceId?: string,
    fingerprint?: string,
    ip?: string
  ): Promise<{ valid: boolean; error?: string; anomalousEvent?: AnomalousLoginEvent }> {
    // Check for concurrent refresh attack
    const isConcurrent = await this.detectConcurrentRefresh(userId, refreshToken);
    if (isConcurrent) {
      // Revoke all user tokens
      await this.revokeAllUserTokens(userId);
      await this.recordRefreshAttempt(
        userId,
        refreshToken,
        deviceId,
        fingerprint,
        ip,
        false,
        true,
        'CONCURRENT_ATTACK'
      );

      return { valid: false, error: 'Concurrent refresh attack detected. All tokens revoked.' };
    }

    // Check for anomalous login if device fingerprint service is available
    if (this.deviceFingerprintService && fingerprint && ip) {
      const anomalousEvent = await this.deviceFingerprintService.detectAnomalousLogin(
        userId,
        fingerprint,
        ip
      );

      if (anomalousEvent) {
        // Log the anomalous login but don't block it
        // Instead, we notify the user or take other action
        this.app.log.warn(
          { event: anomalousEvent },
          'Anomalous login detected during refresh'
        );

        return { valid: true, anomalousEvent };
      }
    }

    return { valid: true };
  }

  /**
   * Handle token refresh with full guard protection
   */
  async handleRefresh(
    attempt: TokenRefreshAttempt,
    generateNewTokens: () => Promise<{ accessToken: string; refreshToken: string; jti: string }>
  ): Promise<RefreshResult> {
    const { refreshToken, userId, deviceId, fingerprint, ip, userAgent } = attempt;

    // Validate the refresh request
    const validation = await this.validateRefreshRequest(
      refreshToken,
      userId,
      deviceId,
      fingerprint,
      ip
    );

    if (!validation.valid) {
      return {
        success: false,
        revoked: true,
      };
    }

    // Generate new tokens
    const newTokens = await generateNewTokens();

    // Execute atomic refresh
    const result = await this.executeAtomicRefresh(
      refreshToken,
      newTokens.jti,
      newTokens.refreshToken,
      userId,
      deviceId,
      fingerprint
    );

    if (!result.success) {
      await this.recordRefreshAttempt(
        userId,
        refreshToken,
        deviceId,
        fingerprint,
        ip,
        false,
        false,
        result.error
      );

      // If concurrent refresh or replay attack, revoke all tokens
      if (result.code === 1 || result.code === 4) {
        await this.revokeAllUserTokens(userId);
        return {
          success: false,
          revoked: true,
        };
      }

      return {
        success: false,
        revoked: result.code === 3, // Device mismatch
      };
    }

    // Record successful refresh
    await this.recordRefreshAttempt(
      userId,
      refreshToken,
      deviceId,
      fingerprint,
      ip,
      true,
      false
    );

    return {
      success: true,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours
      refreshTokenExpiresIn: 7 * 24 * 60 * 60, // 7 days
      anomalousLogin: validation.anomalousEvent,
    };
  }

  /**
   * Add token to blacklist (for immediate revocation)
   */
  async blacklistToken(token: string, expiresAt: number): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    const key = `blacklist:${token}`;
    const ttl = Math.max(expiresAt - Date.now(), 0);

    if (ttl > 0) {
      await this.redisClient.set(key, '1', 'PX', ttl);
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    if (!this.redisClient) {
      return false;
    }

    const key = `blacklist:${token}`;
    const exists = await this.redisClient.exists(key);
    return exists === 1;
  }
}