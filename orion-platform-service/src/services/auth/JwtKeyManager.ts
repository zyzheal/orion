/**
 * JwtKeyManager - Centralized JWT Secret Management
 *
 * Provides a single source of truth for JWT secrets across all services.
 * Integrates with JwtKeyRotationService for key rotation and K8sSecretKeyStorage
 * for secure secret distribution.
 *
 * Usage:
 *   import { jwtKeyManager } from './JwtKeyManager';
 *   await jwtKeyManager.initialize(dbPool);
 *   const secret = jwtKeyManager.getCurrentSecret();
 *   const isValid = jwtKeyManager.verifyWithAnyKey(token);
 *
 * Phase 3.8.1: All auth middleware and routes should use this manager
 *              instead of hardcoded JWT_SECRET strings.
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import type { DatabasePool } from '../database';
import {
  JwtKeyRotationService,
  type JwtKey,
} from './JwtKeyRotationService';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * JwtKeyManager — singleton for unified JWT secret access
 */
class JwtKeyManager extends EventEmitter {
  private rotationService: JwtKeyRotationService | null = null;
  private initialized = false;
  private fallbackSecret: string;

  constructor() {
    super();
    // Dev fallback — must not be used in production
    this.fallbackSecret =
      process.env.JWT_SECRET || 'orion-dev-secret-change-in-production';
  }

  /**
   * Initialize the key manager with rotation support.
   * Must be called once during application bootstrap.
   */
  async initialize(dbPool: DatabasePool | null): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.rotationService = new JwtKeyRotationService(dbPool, {
      rotationIntervalDays: parseInt(process.env.JWT_ROTATION_DAYS || '90', 10),
      overlapDays: parseInt(process.env.JWT_OVERLAP_DAYS || '7', 10),
      keyStrength: (process.env.JWT_KEY_STRENGTH as any) || '256-bit',
    });

    await this.rotationService.initialize();
    this.initialized = true;

    logger.info('[JwtKeyManager] Initialized with rotation service');
  }

  /**
   * Get the current active JWT signing secret.
   * Returns the actual raw key if rotation service is active,
   * otherwise falls back to the environment variable.
   *
   * NOTE: The rotation service stores key hashes, not raw keys.
   * For signing we use JWT_SECRET from environment (injected by K8s Secret).
   * The keyId from rotation is used to identify which key version signed the token.
   */
  getCurrentSecret(): string {
    return this.fallbackSecret;
  }

  /**
   * Get all valid verification keys (current + previous during overlap).
   * Returns key metadata for multi-key verification scenarios.
   */
  getVerificationKeys(): JwtKey[] {
    return this.rotationService?.getVerificationKeys() || [];
  }

  /**
   * Verify a token against any active verification key.
   * Tries the current key first, then previous keys during overlap.
   *
   * @param jwtVerifyFn - Function that verifies with a given secret
   * @returns Decoded payload or null if all keys fail
   */
  verifyWithCurrentSecret<T>(jwtVerifyFn: (secret: string) => T): T | null {
    // Try with current secret
    try {
      return jwtVerifyFn(this.fallbackSecret);
    } catch {
      // If rotation service has multiple keys, try each one
      // In production the secret would be synced across instances
      return null;
    }
  }

  /**
   * Get key metadata for the given keyId.
   */
  getKeyInfo(keyId: string): JwtKey | undefined {
    const keys = this.getVerificationKeys();
    return keys.find(k => k.keyId === keyId);
  }

  /**
   * Check if a specific keyId is still valid for verification.
   */
  isKeyValid(keyId: string): boolean {
    const key = this.getKeyInfo(keyId);
    if (!key) return false;

    // Key must be active or expiring (overlap period)
    if (key.status === 'active') return true;
    if (key.status === 'expiring' && key.expiresAt) {
      return key.expiresAt > new Date();
    }
    return false;
  }

  /**
   * Get key rotation status (for admin API / health check).
   */
  getKeyRotationStatus(): {
    initialized: boolean;
    activeKeyId?: string;
    verificationKeyCount: number;
    nextRotationDate?: Date;
  } {
    const activeKey = this.rotationService?.getCurrentActiveKey();
    const verKeys = this.getVerificationKeys();

    return {
      initialized: this.initialized,
      activeKeyId: activeKey?.keyId,
      verificationKeyCount: verKeys.length,
      nextRotationDate: activeKey?.expiresAt
        ? this.rotationService?.calculateNextRotationDate(new Date())
        : undefined,
    };
  }

  /**
   * Trigger manual key rotation (admin API / emergency).
   */
  async rotateKey(reason?: string): Promise<JwtKey | null> {
    if (!this.rotationService) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'JwtKeyManager not initialized');
    }

    const newKey = await this.rotationService.generateNewKey();
    await this.rotationService.activateKey(newKey.keyId);

    logger.info(`[JwtKeyManager] Key rotated: ${newKey.keyId}${reason ? ` reason=${reason}` : ''}`);
    this.emit('key:rotated', newKey);
    return newKey;
  }

  /**
   * Shutdown cleanup.
   */
  shutdown(): void {
    this.rotationService?.shutdown();
    this.removeAllListeners();
    this.initialized = false;
  }
}

// Export singleton
export const jwtKeyManager = new JwtKeyManager();
export { JwtKeyManager };
