/**
 * EncryptedField unit tests
 *
 * Covers: encrypt, decrypt, isEncrypted, idempotency, empty/null handling.
 */

import { EncryptedField } from '../EncryptedField';

describe('EncryptedField', () => {
  // Use a fixed field name for all tests
  const field = new EncryptedField('secret_token');

  describe('encrypt', () => {
    it('should encrypt a plain-text value', () => {
      const encrypted = field.encrypt('my-api-key-12345');
      expect(encrypted).not.toBe('my-api-key-12345');
      expect(encrypted).toMatch(/^ENC:AES256:/);
    });

    it('should return the same value if already encrypted', () => {
      const preEncrypted = 'ENC:AES256:abc123';
      const result = field.encrypt(preEncrypted);
      expect(result).toBe(preEncrypted);
    });

    it('should pass through null', () => {
      expect(field.encrypt(null)).toBeNull();
    });

    it('should pass through undefined', () => {
      expect(field.encrypt(undefined)).toBeUndefined();
    });

    it('should pass through empty string', () => {
      expect(field.encrypt('')).toBe('');
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted value back to plain text', () => {
      const encrypted = field.encrypt('my-api-key-12345');
      const decrypted = field.decrypt(encrypted);
      expect(decrypted).toBe('my-api-key-12345');
    });

    it('should return the same value if not encrypted', () => {
      const plain = 'plain-text-value';
      const result = field.decrypt(plain);
      expect(result).toBe(plain);
    });

    it('should pass through null', () => {
      expect(field.decrypt(null)).toBeNull();
    });

    it('should pass through undefined', () => {
      expect(field.decrypt(undefined)).toBeUndefined();
    });

    it('should pass through empty string', () => {
      expect(field.decrypt('')).toBe('');
    });
  });

  describe('isEncrypted', () => {
    it('should return true for new AES-256 encrypted values', () => {
      const encrypted = field.encrypt('some-value');
      expect(field.isEncrypted(encrypted)).toBe(true);
    });

    it('should return true for legacy ENC: prefixed values', () => {
      expect(field.isEncrypted('ENC:somebase64data')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(field.isEncrypted('plain-text')).toBe(false);
    });

    it('should return false for null', () => {
      expect(field.isEncrypted(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(field.isEncrypted(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(field.isEncrypted('')).toBe(false);
    });
  });

  describe('round-trip', () => {
    it('should survive encrypt -> decrypt round-trip for various values', () => {
      const testValues = [
        'simple',
        'with spaces and special chars !@#$%^&*()',
        'unicode: 你好世界 🚀',
        'json: {"key": "value"}',
        'very-long-' + 'a'.repeat(200),
      ];

      for (const original of testValues) {
        const encrypted = field.encrypt(original);
        const decrypted = field.decrypt(encrypted);
        expect(decrypted).toBe(original);
      }
    });
  });

  describe('fieldName isolation', () => {
    it('should track fieldName correctly', () => {
      const emailField = new EncryptedField('email');
      const tokenField = new EncryptedField('token');

      expect(emailField['fieldName']).toBe('email');
      expect(tokenField['fieldName']).toBe('token');
    });
  });
});
