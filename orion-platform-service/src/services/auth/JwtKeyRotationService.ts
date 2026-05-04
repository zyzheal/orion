// orion-platform-service/src/services/auth/JwtKeyRotationService.ts
import crypto from 'crypto';
import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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

export class JwtKeyRotationService extends EventEmitter {
  private config: JwtKeyRotationConfig;
  private currentKey: JwtKey | null = null;
  private previousKey: JwtKey | null = null;
  private keys: Map<string, JwtKey> = new Map();
  private rotationTimer?: NodeJS.Timeout;

  constructor(config: Partial<JwtKeyRotationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    // Load existing keys from database
    const storedKeys = await this.loadKeysFromDatabase();

    if (storedKeys.length === 0) {
      // Generate initial key
      const initialKey = await this.generateNewKey();
      await this.activateKey(initialKey.keyId);
    } else {
      // Find active key
      const activeKey = storedKeys.find(k => k.status === 'active');
      if (activeKey) {
        this.currentKey = activeKey;
        this.keys.set(activeKey.keyId, activeKey);
      }

      // Find expiring key (overlap period)
      const expiringKey = storedKeys.find(k => k.status === 'expiring');
      if (expiringKey) {
        this.previousKey = expiringKey;
        this.keys.set(expiringKey.keyId, expiringKey);
      }
    }

    // Schedule next rotation
    this.scheduleNextRotation();

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

    const key: JwtKey = {
      keyId,
      keyHash,
      keyStrength: this.config.keyStrength,
      status: 'pending',
      createdAt: new Date(),
    };

    this.keys.set(keyId, key);

    // Store in database
    await this.storeKeyInDatabase(key);

    logger.info(`[JwtKeyRotation] Generated new key: ${keyId}`);
    return key;
  }

  async activateKey(keyId: string): Promise<void> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
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

  calculateNextRotationDate(fromDate: Date): Date {
    const nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + this.config.rotationIntervalDays);
    return nextDate;
  }

  private scheduleNextRotation(): void {
    if (!this.currentKey?.expiresAt) {
      return;
    }

    // Schedule rotation 7 days before expiration (overlap start)
    const overlapStart = new Date(this.currentKey.expiresAt);
    overlapStart.setDate(overlapStart.getDate() - this.config.overlapDays);

    const now = new Date();
    const delay = overlapStart.getTime() - now.getTime();

    if (delay > 0) {
      this.rotationTimer = setTimeout(async () => {
        await this.startRotation();
      }, delay);

      logger.info(`[JwtKeyRotation] Next rotation scheduled at: ${overlapStart.toISOString()}`);
    }
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
      this.scheduleNextRotation();
    } catch (error) {
      logger.error('[JwtKeyRotation] Rotation failed:', error);
      this.emit('rotation:failed', error);
    }
  }

  private async loadKeysFromDatabase(): Promise<JwtKey[]> {
    // Placeholder - would query jwt_key_rotation table
    // In production, this would use a repository to query the database
    return [];
  }

  private async storeKeyInDatabase(key: JwtKey): Promise<void> {
    // Placeholder - would insert into jwt_key_rotation table
    // In production, this would use a repository to insert into the database
    logger.debug(`[JwtKeyRotation] Storing key: ${key.keyId}`);
  }

  private async updateKeyInDatabase(key: JwtKey): Promise<void> {
    // Placeholder - would update jwt_key_rotation table
    // In production, this would use a repository to update the database
    logger.debug(`[JwtKeyRotation] Updating key: ${key.keyId}`);
  }

  shutdown(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
    }
    this.removeAllListeners();
  }
}