/**
 * JwtKeyManager Tests
 *
 * Tests for the centralized JWT key management service.
 */

import { JwtKeyManager } from '../JwtKeyManager';

describe('JwtKeyManager', () => {
  let manager: JwtKeyManager;

  beforeEach(() => {
    manager = new JwtKeyManager();
  });

  afterEach(() => {
    manager.shutdown();
  });

  describe('initialization', () => {
    it('should return fallback secret without initialization', () => {
      const secret = manager.getCurrentSecret();
      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);
    });

    it('should return empty verification keys without initialization', () => {
      const keys = manager.getVerificationKeys();
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBe(0);
    });

    it('should report not initialized before setup', () => {
      const status = manager.getKeyRotationStatus();
      expect(status.initialized).toBe(false);
    });

    it('should reject rotateKey before initialization', async () => {
      await expect(manager.rotateKey()).rejects.toThrow(
        'JwtKeyManager not initialized',
      );
    });
  });

  describe('verifyWithCurrentSecret', () => {
    it('should return null for invalid verification function', () => {
      const result = manager.verifyWithCurrentSecret(() => {
        throw new Error('invalid');
      });
      expect(result).toBeNull();
    });

    it('should return value from successful verification function', () => {
      const result = manager.verifyWithCurrentSecret((secret) => {
        return `verified:${secret}`;
      });
      expect(result).toBe(`verified:${manager.getCurrentSecret()}`);
    });
  });

  describe('getKeyInfo', () => {
    it('should return undefined for unknown key', () => {
      const info = manager.getKeyInfo('nonexistent');
      expect(info).toBeUndefined();
    });
  });

  describe('isKeyValid', () => {
    it('should return false for unknown key', () => {
      expect(manager.isKeyValid('nonexistent')).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should not throw when called multiple times', () => {
      manager.shutdown();
      manager.shutdown(); // Should be idempotent
    });
  });
});
