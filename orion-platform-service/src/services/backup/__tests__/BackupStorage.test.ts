/**
 * TASK-704: BackupStorage Unit Tests
 */

import { BackupStorage } from '../BackupStorage';

describe('BackupStorage', () => {
  let storage: BackupStorage;

  beforeEach(() => {
    storage = new BackupStorage({
      storagePath: '/tmp/test-backups',
      compressionLevel: 6,
      encryptBackups: false,
    });
  });

  // ==================== Storage Operations ====================

  describe('store', () => {
    it('should store backup data', async () => {
      const data = Buffer.from('test backup data content');
      const result = await storage.store('backup-1', 'plan-1', data);

      expect(result.storageLocation).toBe('/tmp/test-backups/backup-1.bak');
      expect(result.checksum).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeDefined();
    });

    it('should store with compression', async () => {
      const data = Buffer.from('test backup data for compression testing');
      const result = await storage.store('backup-2', 'plan-1', data, { compress: true });

      expect(result.storageLocation).toContain('backup-2.bak');
    });

    it('should store without compression', async () => {
      const data = Buffer.from('uncompressed data');
      const result = await storage.store('backup-3', 'plan-1', data, { compress: false });

      expect(result.compressionRatio).toBe(1.0);
    });

    it('should emit backup:stored event', async () => {
      let stored = false;
      storage.on('backup:stored', () => { stored = true; });

      const data = Buffer.from('test data');
      await storage.store('backup-4', 'plan-1', data);

      expect(stored).toBe(true);
    });

    it('should throw error when storage limit exceeded', async () => {
      const limitedStorage = new BackupStorage({
        storagePath: '/tmp/test-backups',
        maxStorageBytes: 10,
      });

      const data = Buffer.alloc(100);
      await expect(limitedStorage.store('backup-big', 'plan-1', data))
        .rejects.toThrow('Storage limit exceeded');
    });
  });

  describe('retrieve', () => {
    it('should retrieve stored data', async () => {
      const originalData = Buffer.from('original test data');
      await storage.store('backup-1', 'plan-1', originalData, { compress: false });

      const retrieved = await storage.retrieve('backup-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.toString()).toBe('original test data');
    });

    it('should retrieve compressed data correctly', async () => {
      const originalData = Buffer.from('data to compress and decompress');
      await storage.store('backup-2', 'plan-1', originalData, { compress: true });

      const retrieved = await storage.retrieve('backup-2');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.toString()).toBe('data to compress and decompress');
    });

    it('should return null for non-existent backup', async () => {
      const retrieved = await storage.retrieve('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a stored backup', async () => {
      const data = Buffer.from('to be deleted');
      await storage.store('backup-1', 'plan-1', data);

      const deleted = storage.delete('backup-1');
      expect(deleted).toBe(true);

      const retrieved = await storage.retrieve('backup-1');
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent backup', () => {
      const deleted = storage.delete('non-existent');
      expect(deleted).toBe(false);
    });

    it('should emit backup:deleted event', async () => {
      let deletedId = '';
      storage.on('backup:deleted', (data: any) => { deletedId = data.backupId; });

      const data = Buffer.from('test');
      await storage.store('backup-del', 'plan-1', data);
      storage.delete('backup-del');

      expect(deletedId).toBe('backup-del');
    });
  });

  describe('exists', () => {
    it('should return true for existing backup', async () => {
      const data = Buffer.from('check exists');
      await storage.store('backup-exists', 'plan-1', data);

      expect(storage.exists('backup-exists')).toBe(true);
    });

    it('should return false for non-existent backup', () => {
      expect(storage.exists('non-existent')).toBe(false);
    });
  });

  // ==================== Checksum Verification ====================

  describe('verifyChecksum', () => {
    it('should verify checksum of stored backup', async () => {
      const data = Buffer.from('checksum test data');
      await storage.store('backup-chk', 'plan-1', data);

      const result = storage.verifyChecksum('backup-chk');
      expect(result.valid).toBe(true);
      expect(result.expected).toBeDefined();
    });

    it('should return false for non-existent backup', () => {
      const result = storage.verifyChecksum('non-existent');
      expect(result.valid).toBe(false);
    });
  });

  // ==================== Compression ====================

  describe('compress/decompress', () => {
    it('should compress and decompress data correctly', () => {
      const original = Buffer.from('Hello, World! This is test data for compression.');

      const compressed = storage.compress(original);
      const decompressed = storage.decompress(compressed);

      expect(decompressed.toString()).toBe('Hello, World! This is test data for compression.');
    });

    it('should handle empty data', () => {
      const original = Buffer.from('');
      const compressed = storage.compress(original);
      const decompressed = storage.decompress(compressed);

      expect(decompressed.toString()).toBe('');
    });

    it('should handle decompression of uncompressed data', () => {
      const original = Buffer.from('not compressed data');
      const decompressed = storage.decompress(original);

      expect(decompressed.toString()).toBe('not compressed data');
    });
  });

  // ==================== Encryption ====================

  describe('encrypt/decrypt', () => {
    let encryptedStorage: BackupStorage;

    beforeEach(() => {
      encryptedStorage = new BackupStorage({
        storagePath: '/tmp/test-encrypted',
        encryptionKey: 'test-encryption-key-12345678901234567890',
        encryptBackups: true,
      });
    });

    it('should encrypt and decrypt data correctly', () => {
      const original = Buffer.from('Secret data to encrypt');

      const encrypted = encryptedStorage.encrypt(original);
      const decrypted = encryptedStorage.decrypt(encrypted);

      expect(decrypted.toString()).toBe('Secret data to encrypt');
    });

    it('should throw error when no encryption key is set', () => {
      expect(() => storage.encrypt(Buffer.from('test'))).toThrow('No encryption key configured');
    });

    it('should throw error on invalid encrypted data', () => {
      expect(() => encryptedStorage.decrypt(Buffer.from('invalid data'))).toThrow('Invalid encrypted data format');
    });

    it('should round-trip through store and retrieve with encryption', async () => {
      const original = Buffer.from('encrypted backup content');

      await encryptedStorage.store('backup-enc', 'plan-1', original, {
        compress: false,
        encrypt: true,
      });

      const retrieved = await encryptedStorage.retrieve('backup-enc');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.toString()).toBe('encrypted backup content');
    });
  });

  // ==================== Storage Usage Tracking ====================

  describe('getStorageUsage', () => {
    it('should return storage usage info', async () => {
      const data1 = Buffer.from('backup data 1');
      const data2 = Buffer.from('backup data 2 - slightly longer content');

      await storage.store('backup-1', 'plan-1', data1);
      await storage.store('backup-2', 'plan-1', data2);

      const usage = storage.getStorageUsage();

      expect(usage.fileCount).toBe(2);
      expect(usage.usedSpace).toBeGreaterThan(0);
      expect(usage.usedHuman).toBeDefined();
      expect(usage.totalHuman).toBeDefined();
      expect(usage.usagePercent).toBeGreaterThanOrEqual(0);
      expect(usage.usagePercent).toBeLessThanOrEqual(100);
    });

    it('should return zero usage when no backups', () => {
      const usage = storage.getStorageUsage();

      expect(usage.fileCount).toBe(0);
      expect(usage.usedSpace).toBe(0);
    });

    it('should track oldest and newest backup', async () => {
      const data = Buffer.from('test data');

      await storage.store('backup-old', 'plan-1', data);
      await storage.store('backup-new', 'plan-1', data);

      const usage = storage.getStorageUsage();

      expect(usage.oldestBackup).toBeDefined();
      expect(usage.newestBackup).toBeDefined();
    });
  });

  // ==================== Utility Methods ====================

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(storage.formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(storage.formatBytes(512)).toContain('B');
    });

    it('should format kilobytes', () => {
      expect(storage.formatBytes(1024)).toContain('KB');
    });

    it('should format megabytes', () => {
      expect(storage.formatBytes(1024 * 1024)).toContain('MB');
    });

    it('should format gigabytes', () => {
      expect(storage.formatBytes(1024 * 1024 * 1024)).toContain('GB');
    });
  });

  describe('getAllBackupIds', () => {
    it('should return all stored backup IDs', async () => {
      await storage.store('backup-a', 'plan-1', Buffer.from('a'));
      await storage.store('backup-b', 'plan-1', Buffer.from('b'));

      const ids = storage.getAllBackupIds();
      expect(ids).toContain('backup-a');
      expect(ids).toContain('backup-b');
      expect(ids.length).toBe(2);
    });
  });

  describe('getStoredInfo', () => {
    it('should return stored backup info', async () => {
      await storage.store('backup-info', 'plan-1', Buffer.from('info test'));

      const info = storage.getStoredInfo('backup-info');
      expect(info).not.toBeNull();
      expect(info!.id).toBe('backup-info');
      expect(info!.planId).toBe('plan-1');
      expect(info!.size).toBeGreaterThan(0);
      expect(info!.checksum).toBeDefined();
    });

    it('should return null for non-existent backup', () => {
      const info = storage.getStoredInfo('non-existent');
      expect(info).toBeNull();
    });
  });

  describe('getStoragePath', () => {
    it('should return the configured storage path', () => {
      expect(storage.getStoragePath()).toBe('/tmp/test-backups');
    });
  });
});
