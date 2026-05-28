/**
 * TASK-704: Backup Storage Manager
 *
 * Handles backup storage location management, compression, encryption,
 * checksum verification, and storage usage tracking.
 */

import { EventEmitter } from 'events';
import { StorageUsage } from './types';
import { OrionError, ErrorCode } from '../../../errors';

/**
 * Simulated in-memory storage for backup records.
 * In production, this would interface with S3, local filesystem, etc.
 */
export class BackupStorage extends EventEmitter {
  /** Storage base path */
  private storagePath: string;

  /** Stored backup data (simulated) */
  private storedBackups: Map<string, {
    id: string;
    data: Buffer;
    checksum: string;
    compressed: boolean;
    encrypted: boolean;
    size: number;
    storedAt: Date;
    planId: string;
  }> = new Map();

  /** Compression level (0-9) */
  private compressionLevel: number;

  /** Whether encryption is enabled */
  private encryptBackups: boolean;

  /** Encryption key */
  private encryptionKey?: string;

  /** Maximum storage bytes (0 = unlimited) */
  private maxStorageBytes: number;

  constructor(options?: {
    storagePath?: string;
    compressionLevel?: number;
    encryptBackups?: boolean;
    encryptionKey?: string;
    maxStorageBytes?: number;
  }) {
    super();
    this.storagePath = options?.storagePath || '/var/backups/orion';
    this.compressionLevel = options?.compressionLevel ?? 6;
    this.encryptBackups = options?.encryptBackups ?? false;
    this.encryptionKey = options?.encryptionKey;
    this.maxStorageBytes = options?.maxStorageBytes || 0;
  }

  // ==================== Storage Operations ====================

  /**
   * Store a backup
   */
  async store(
    backupId: string,
    planId: string,
    data: Buffer,
    options?: { compress?: boolean; encrypt?: boolean }
  ): Promise<{
    storageLocation: string;
    checksum: string;
    size: number;
    compressionRatio: number;
  }> {
    const shouldCompress = options?.compress ?? true;
    const shouldEncrypt = options?.encrypt ?? this.encryptBackups;

    let processedData = data;
    const originalSize = data.length;
    let compressionRatio = 1.0;

    // Compress
    if (shouldCompress) {
      processedData = this.compress(processedData);
      compressionRatio = originalSize / processedData.length;
    }

    // Encrypt
    if (shouldEncrypt && this.encryptionKey) {
      processedData = this.encrypt(processedData);
    }

    // Calculate checksum (after compression/encryption)
    const checksum = this.calculateChecksum(processedData);

    // Check storage limits
    if (this.maxStorageBytes > 0) {
      const currentUsage = this.getStorageUsage();
      if (currentUsage.usedSpace + processedData.length > this.maxStorageBytes) {
        throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Storage limit exceeded');
      }
    }

    // Generate storage location
    const storageLocation = `${this.storagePath}/${backupId}.bak`;

    // Store in memory (simulated)
    this.storedBackups.set(backupId, {
      id: backupId,
      data: processedData,
      checksum,
      compressed: shouldCompress,
      encrypted: shouldEncrypt,
      size: processedData.length,
      storedAt: new Date(),
      planId,
    });

    this.emit('backup:stored', { backupId, size: processedData.length });

    return {
      storageLocation,
      checksum,
      size: processedData.length,
      compressionRatio,
    };
  }

  /**
   * Retrieve a backup
   */
  async retrieve(backupId: string): Promise<Buffer | null> {
    const stored = this.storedBackups.get(backupId);
    if (!stored) return null;

    let data = stored.data;

    // Decrypt if needed
    if (stored.encrypted && this.encryptionKey) {
      data = this.decrypt(data);
    }

    // Decompress if needed
    if (stored.compressed) {
      data = this.decompress(data);
    }

    this.emit('backup:retrieved', backupId);
    return data;
  }

  /**
   * Delete a backup from storage
   */
  delete(backupId: string): boolean {
    const stored = this.storedBackups.get(backupId);
    if (!stored) return false;

    const size = stored.size;
    this.storedBackups.delete(backupId);

    this.emit('backup:deleted', { backupId, freedSpace: size });
    return true;
  }

  /**
   * Check if a backup exists in storage
   */
  exists(backupId: string): boolean {
    return this.storedBackups.has(backupId);
  }

  // ==================== Checksum Verification ====================

  /**
   * Verify the checksum of a stored backup
   */
  verifyChecksum(backupId: string): {
    valid: boolean;
    expected: string;
    actual?: string;
  } {
    const stored = this.storedBackups.get(backupId);
    if (!stored) {
      return { valid: false, expected: 'not-found' };
    }

    const actualChecksum = this.calculateChecksum(stored.data);
    const valid = actualChecksum === stored.checksum;

    return {
      valid,
      expected: stored.checksum,
      actual: actualChecksum,
    };
  }

  /**
   * Calculate SHA-256 checksum of data
   * Using a simple hash simulation for Node.js compatibility
   */
  private calculateChecksum(data: Buffer): string {
    // Simulate SHA-256 with a deterministic hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      hash = ((hash << 5) - hash + byte) | 0;
    }
    // Convert to hex-like string for consistency
    return `sha256:${Math.abs(hash).toString(16).padStart(8, '0')}${data.length.toString(16).padStart(8, '0')}`;
  }

  // ==================== Compression ====================

  /**
   * Compress data (simulated)
   * In production, use zlib.gzipSync
   */
  compress(data: Buffer): Buffer {
    // Simulate compression by applying a simple reduction
    // In production, replace with: return zlib.gzipSync(data, { level: this.compressionLevel });
    const compressionFactor = 0.3 + (this.compressionLevel / 9) * 0.6; // 30%-90% reduction

    // For simulation: create a buffer that represents compressed data
    // We keep the original data but mark it as compressed
    // In a real implementation, actual compression would happen here
    const header = Buffer.from(`COMPRESSED_L${this.compressionLevel}_`);
    return Buffer.concat([header, data]);
  }

  /**
   * Decompress data (simulated)
   */
  decompress(data: Buffer): Buffer {
    const headerPrefix = 'COMPRESSED_L';
    const headerStr = data.toString('utf8', 0, 20);

    if (headerStr.startsWith(headerPrefix)) {
      const underscoreIndex = data.indexOf(0x5f, 12); // Find '_' after level
      if (underscoreIndex > 0) {
        return data.subarray(underscoreIndex + 1);
      }
    }

    return data;
  }

  // ==================== Encryption ====================

  /**
   * Encrypt data (simulated)
   * In production, use AES-256-GCM
   */
  encrypt(data: Buffer): Buffer {
    // Simulate encryption by XOR with key bytes
    // In production, use crypto.createCipheriv('aes-256-gcm', ...)
    if (!this.encryptionKey) {
      throw new Error('No encryption key configured');
    }

    const key = Buffer.from(this.encryptionKey);
    const encrypted = Buffer.alloc(data.length + 8); // +5 for IV header, +3 for END

    // Write "IV" (simulated)
    encrypted.write('ENCIV', 0, 5);

    // XOR encrypt
    for (let i = 0; i < data.length; i++) {
      encrypted[i + 5] = data[i] ^ key[i % key.length];
    }

    encrypted.write('END', data.length + 5, 3);
    return encrypted;
  }

  /**
   * Decrypt data (simulated)
   */
  decrypt(data: Buffer): Buffer {
    if (!this.encryptionKey) {
      throw new Error('No encryption key configured');
    }

    const key = Buffer.from(this.encryptionKey);

    // Check IV header
    if (data.toString('utf8', 0, 5) !== 'ENCIV') {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid encrypted data format');
    }

    const decrypted = Buffer.alloc(data.length - 8); // -5 IV, -3 END
    for (let i = 0; i < decrypted.length; i++) {
      decrypted[i] = data[i + 5] ^ key[i % key.length];
    }

    return decrypted;
  }

  // ==================== Storage Usage Tracking ====================

  /**
   * Get storage usage information
   */
  getStorageUsage(): StorageUsage {
    let totalSize = 0;
    let oldestBackup: Date | undefined;
    let newestBackup: Date | undefined;

    for (const stored of this.storedBackups.values()) {
      totalSize += stored.size;

      if (!oldestBackup || stored.storedAt < oldestBackup) {
        oldestBackup = stored.storedAt;
      }
      if (!newestBackup || stored.storedAt > newestBackup) {
        newestBackup = stored.storedAt;
      }
    }

    const totalCapacity = this.maxStorageBytes > 0 ? this.maxStorageBytes : totalSize * 2 || 10737418240; // Default 10GB
    const availableSpace = Math.max(0, totalCapacity - totalSize);
    const usagePercent = totalCapacity > 0 ? (totalSize / totalCapacity) * 100 : 0;

    return {
      totalCapacity,
      usedSpace: totalSize,
      availableSpace,
      usagePercent: Math.round(usagePercent * 100) / 100,
      usedHuman: this.formatBytes(totalSize),
      totalHuman: this.formatBytes(totalCapacity),
      fileCount: this.storedBackups.size,
      oldestBackup,
      newestBackup,
    };
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get all stored backup IDs
   */
  getAllBackupIds(): string[] {
    return Array.from(this.storedBackups.keys());
  }

  /**
   * Get stored backup info by ID
   */
  getStoredInfo(backupId: string): {
    id: string;
    size: number;
    checksum: string;
    compressed: boolean;
    encrypted: boolean;
    storedAt: Date;
    planId: string;
  } | null {
    const stored = this.storedBackups.get(backupId);
    if (!stored) return null;

    return {
      id: stored.id,
      size: stored.size,
      checksum: stored.checksum,
      compressed: stored.compressed,
      encrypted: stored.encrypted,
      storedAt: stored.storedAt,
      planId: stored.planId,
    };
  }

  /**
   * Get storage path
   */
  getStoragePath(): string {
    return this.storagePath;
  }
}
