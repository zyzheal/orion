// orion-platform-service/src/services/auth/JwtKeyRotationService.ts
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import { JwtKeyRotationRepository, JwtKeyEntity } from '../../repositories/JwtKeyRotationRepository';
import { K8sSecretKeyStorage, k8sSecretStorage } from './K8sSecretKeyStorage';
import { OrionError, ErrorCode } from '../../errors';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('jwt-key-rotation');

export interface JwtKeyRotationConfig {
  rotationIntervalDays: number;
  overlapDays: number;
  keyStrength: '128-bit' | '192-bit' | '256-bit';
  rotationTrigger?: 'scheduled' | 'manual' | 'emergency';
}

export interface JwtKey {
  keyId: string;
  keyHash: string;
  keyStrength: string;
  status: 'pending' | 'active' | 'expiring' | 'expired';
  createdAt: Date;
  activatedAt?: Date;
  expiresAt?: Date;
}

const DEFAULT_CONFIG: JwtKeyRotationConfig = {
  rotationIntervalDays: 90,
  overlapDays: 7,
  keyStrength: '256-bit',
  rotationTrigger: 'scheduled',
};

/** Convert a DB entity to the service-level JwtKey interface */
function entityToJwtKey(entity: JwtKeyEntity): JwtKey {
  return {
    keyId: entity.keyId,
    keyHash: entity.keyHash,
    keyStrength: entity.keyStrength,
    status: entity.status,
    createdAt: entity.createdAt,
    activatedAt: entity.activatedAt ?? undefined,
    expiresAt: entity.expiresAt ?? undefined,
  };
}

export class JwtKeyRotationService extends EventEmitter {
  private config: JwtKeyRotationConfig;
  private repository: JwtKeyRotationRepository | null;
  private k8sStorage: K8sSecretKeyStorage;
  private currentKey: JwtKey | null = null;
  private previousKey: JwtKey | null = null;
  private rotationTimer?: NodeJS.Timeout;
  // In-memory store of raw key secrets (never persisted to DB/K8s for security)
  private rawSecrets: Map<string, string> = new Map();

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } | null, config: Partial<JwtKeyRotationConfig> = {}, k8sStorage?: K8sSecretKeyStorage) {
    super();
    this.repository = db ? new JwtKeyRotationRepository(db) : null;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.k8sStorage = k8sStorage || k8sSecretStorage;
  }

  async initialize(): Promise<void> {
    // Try loading from K8s Secret first (preferred)
    let storedKeys: JwtKey[] = [];

    if (this.k8sStorage.isAvailable()) {
      storedKeys = await this.k8sStorage.loadKeys();
      logger.info('[JwtKeyRotation] Loaded keys from K8s Secret');
    }

    // Fallback to database if K8s Secret empty or unavailable
    if (storedKeys.length === 0) {
      storedKeys = await this.loadKeysFromDatabase();
      logger.info('[JwtKeyRotation] Loaded keys from Database fallback');
    }

    if (storedKeys.length === 0) {
      // Generate initial key
      const initialKey = await this.generateNewKey();
      await this.activateKey(initialKey.keyId);
    } else {
      // Find active key
      const activeKey = storedKeys.find(k => k.status === 'active');
      if (activeKey) {
        this.currentKey = activeKey;
      }

      // Find expiring key (overlap period)
      const expiringKey = storedKeys.find(k => k.status === 'expiring');
      if (expiringKey) {
        this.previousKey = expiringKey;
      }
    }

    // Schedule next rotation
    await this.scheduleNextRotation();

    logger.info('[JwtKeyRotation] Service initialized');
  }

  async generateNewKey(): Promise<JwtKey> {
    const keyId = `jwt_key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Generate key based on strength
    const byteLength = this.config.keyStrength === '256-bit' ? 32
                      : this.config.keyStrength === '192-bit' ? 24
                      : 16;

    const rawKey = crypto.randomBytes(byteLength);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // Retain the raw secret in memory for verifyWithAnyKey to use
    const rawSecret = rawKey.toString('hex');
    this.rawSecrets.set(keyId, rawSecret);

    const key: JwtKey = {
      keyId,
      keyHash,
      keyStrength: this.config.keyStrength,
      status: 'pending',
      createdAt: new Date(),
    };

    // Store in database via repository
    await this.storeKeyInDatabase(key);

    logger.info(`[JwtKeyRotation] Generated new key: ${keyId}`);
    return key;
  }

  async activateKey(keyId: string): Promise<void> {
    const key = await this.getKeyById(keyId);
    if (!key) {
      throw new OrionError(`Key not found: ${keyId}`, ErrorCode.NOT_FOUND);
    }

    // Mark previous key as expiring (overlap period)
    if (this.currentKey && this.currentKey.keyId !== keyId) {
      this.currentKey.status = 'expiring';
      this.currentKey.expiresAt = new Date(Date.now() + this.config.overlapDays * 24 * 60 * 60 * 1000);
      this.previousKey = this.currentKey;
      await this.updateKeyInDatabase(this.currentKey);
    }

    // Activate new key
    key.status = 'active';
    key.activatedAt = new Date();
    key.expiresAt = new Date(Date.now() + this.config.rotationIntervalDays * 24 * 60 * 60 * 1000);
    this.currentKey = key;

    await this.updateKeyInDatabase(key);

    this.emit('key:activated', key);
    logger.info(`[JwtKeyRotation] Key activated: ${keyId}`);

    // Emit rotation:completed if this was a rotation (previous key exists)
    if (this.previousKey) {
      this.emit('rotation:completed', {
        oldKey: this.previousKey.keyId,
        newKey: this.currentKey.keyId,
      });
    }
  }

  getCurrentActiveKey(): JwtKey | null {
    return this.currentKey;
  }

  getVerificationKeys(): JwtKey[] {
    const keys: JwtKey[] = [];

    if (this.currentKey) {
      keys.push(this.currentKey);
    }

    // Include previous key during overlap period
    if (this.previousKey && this.previousKey.status === 'expiring') {
      keys.push(this.previousKey);
    }

    return keys;
  }

  /**
   * Get the raw secret for a given keyId.
   * Returns undefined if the key was generated in a previous process instance
   * (raw secrets are only kept in memory, never persisted).
   */
  getRawSecret(keyId: string): string | undefined {
    return this.rawSecrets.get(keyId);
  }

  calculateNextRotationDate(fromDate: Date): Date {
    const nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + this.config.rotationIntervalDays);
    return nextDate;
  }

  private async scheduleNextRotation(): Promise<void> {
    if (!this.currentKey?.expiresAt) {
      return;
    }

    // Schedule rotation 7 days before expiration (overlap start)
    const overlapStart = new Date(this.currentKey.expiresAt);
    overlapStart.setDate(overlapStart.getDate() - this.config.overlapDays);

    const now = new Date();
    const delay = overlapStart.getTime() - now.getTime();

    if (delay > 0) {
      // Cap delay to avoid Node.js TimeoutOverflowWarning for very long intervals
      const maxDelay = 2147483647; // 2^31 - 1 ms (~24.8 days)
      const cappedDelay = Math.min(delay, maxDelay);

      this.rotationTimer = setTimeout(async () => {
        await this.startRotation();
      }, cappedDelay);

      logger.info(`[JwtKeyRotation] Next rotation scheduled at: ${overlapStart.toISOString()}`);
    } else {
      // Overlap window already started (e.g. process restarted past the scheduled time)
      // Trigger rotation immediately to avoid skipping the rotation cycle
      logger.warn(`[JwtKeyRotation] Overlap window already passed (${delay}ms), triggering rotation immediately`);
      await this.startRotation();
    }

    // C5 修复：定期清理过期密钥（每日一次）
    // 保留策略：过期后 7 天删除（与 overlapDays 一致）
    await this.scheduleExpiredKeyCleanup();
  }

  /**
   * C5 修复：清理已过期的 JWT 密钥
   * 保留策略：过期后 7 天删除，避免积累过多历史密钥
   */
  private async cleanupExpiredKeys(): Promise<number> {
    if (!this.repository) {
      logger.warn('[JwtKeyRotation] Cannot cleanup expired keys: repository not initialized');
      return 0;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.overlapDays);

      const allKeys = await this.repository.listKeys();
      const expiredKeys = allKeys.filter(key =>
        key.status === 'expired' &&
        key.expiresAt &&
        new Date(key.expiresAt) < cutoffDate
      );

      let deletedCount = 0;
      for (const key of expiredKeys) {
        try {
          await this.repository.deleteByKeyId(key.keyId);
          // 从内存中清除原始密钥
          this.rawSecrets.delete(key.keyId);
          deletedCount++;
          logger.info({ keyId: key.keyId, expiresAt: key.expiresAt }, '[JwtKeyRotation] Deleted expired key');
        } catch (error) {
          logger.error({ keyId: key.keyId, error }, '[JwtKeyRotation] Failed to delete expired key');
        }
      }

      if (deletedCount > 0) {
        logger.info({ deleted: deletedCount, total: expiredKeys.length }, '[JwtKeyRotation] Expired keys cleanup completed');
      }

      return deletedCount;
    } catch (error) {
      logger.error({ error }, '[JwtKeyRotation] Cleanup expired keys failed');
      return 0;
    }
  }

  /**
   * C5 修复：调度过期密钥清理任务（每日执行）
   */
  private async scheduleExpiredKeyCleanup(): Promise<void> {
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24 小时

    setInterval(async () => {
      await this.cleanupExpiredKeys();
    }, cleanupInterval);

    // 立即执行一次清理
    await this.cleanupExpiredKeys();
  }

  private async startRotation(): Promise<void> {
    logger.info('[JwtKeyRotation] Starting key rotation...');

    try {
      const newKey = await this.generateNewKey();
      await this.activateKey(newKey.keyId);

      this.emit('rotation:completed', {
        oldKey: this.previousKey?.keyId,
        newKey: this.currentKey?.keyId,
      });

      // Schedule next rotation
      await this.scheduleNextRotation();
    } catch (error) {
      logger.error('[JwtKeyRotation] Rotation failed:', error);
      this.emit('rotation:failed', error);
    }
  }

  /** Get a key by ID from repository */
  private async getKeyById(keyId: string): Promise<JwtKey | null> {
    if (!this.repository) return null;
    try {
      const entity = await this.repository.findByKeyId(keyId);
      return entity ? entityToJwtKey(entity) : null;
    } catch (error) {
      logger.error('[JwtKeyRotation] Failed to get key from repository:', error);
      return null;
    }
  }

  private async loadKeysFromDatabase(): Promise<JwtKey[]> {
    if (!this.repository) return [];
    try {
      const entities = await this.repository.findByStatuses(['active', 'expiring']);
      return entities.map(entityToJwtKey);
    } catch (error) {
      logger.error('[JwtKeyRotation] Failed to load keys from database:', error);
      return [];
    }
  }

  private async storeKeyInDatabase(key: JwtKey): Promise<void> {
    if (!this.repository) return;
    try {
      await this.repository.create({
        keyId: key.keyId,
        keyHash: key.keyHash,
        keyStrength: key.keyStrength,
        status: key.status,
        rotationTrigger: this.config.rotationTrigger || 'scheduled',
      });
      logger.debug(`[JwtKeyRotation] Stored key in database: ${key.keyId}`);

      // Also store in K8s Secret if available
      await this.k8sStorage.storeKey(key);
    } catch (error) {
      logger.error('[JwtKeyRotation] Failed to store key in database:', error);
      throw error;
    }
  }

  private async updateKeyInDatabase(key: JwtKey): Promise<void> {
    if (!this.repository) return;
    try {
      await this.repository.updateByKeyId(key.keyId, {
        status: key.status,
        activatedAt: key.activatedAt ?? null,
        expiresAt: key.expiresAt ?? null,
      });
      logger.debug(`[JwtKeyRotation] Updated key in database: ${key.keyId}`);

      // Also update in K8s Secret if available
      await this.k8sStorage.updateKey(key);
    } catch (error) {
      logger.error('[JwtKeyRotation] Failed to update key in database:', error);
      throw error;
    }
  }

  shutdown(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
    }
    this.removeAllListeners();
  }
}
