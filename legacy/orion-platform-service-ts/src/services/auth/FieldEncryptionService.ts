/**
 * FieldEncryptionService — Tenant-Aware AES-256-GCM Field Encryption
 *
 * Provides field-level encryption for sensitive data at rest with tenant isolation.
 * Each tenant gets a derived encryption key, so data encrypted by tenant A cannot be
 * decrypted by tenant B even if they share the same global key.
 *
 * Key derivation: HMAC-SHA256(global_key, tenant_id) → 32-byte tenant key
 * Encryption:    AES-256-GCM via src/utils/encryption.ts (encryptValue/decryptValue)
 *
 * Usage:
 *   const encryption = new FieldEncryptionService('tenant-123');
 *   const encrypted = encryption.encryptField(plainText);
 *   const decrypted = encryption.decryptField(encrypted);
 */

import crypto from 'crypto';
import { OrionError, ErrorCode } from '../../errors';
import { encryptValue, decryptValue, isEncrypted } from '../../utils/encryption';

const TENANT_KEY_LENGTH = 32; // AES-256 = 32 bytes
const HMAC_DIGEST = 'sha256';

/**
 * Derive a tenant-specific encryption key from the global key and tenant_id.
 * Uses HMAC-SHA256 so the output is always exactly 32 bytes (AES-256).
 *
 * @param globalKey - The base encryption key (32 bytes)
 * @param tenantId - The tenant identifier (string or number)
 * @returns 32-byte Buffer derived for this tenant
 */
function deriveTenantKey(globalKey: Buffer, tenantId: string | number): Buffer {
  return crypto.createHmac(HMAC_DIGEST, globalKey).update(String(tenantId)).digest();
}

/**
 * Get the global encryption key (same source as encryptValue/decryptValue).
 * Lazily evaluated, cached for the process lifetime.
 */
let cachedGlobalKey: Buffer | null = null;

function getGlobalKey(): Buffer {
  if (!cachedGlobalKey) {
    // Re-use the same env var as utils/encryption.ts (ORION_ENCRYPTION_KEY)
    const envKey = process.env.ORION_ENCRYPTION_KEY;
    if (envKey) {
      if (envKey.length !== 64) {
        throw new OrionError(
          'ORION_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
          ErrorCode.VALIDATION_ERROR,
        );
      }
      cachedGlobalKey = Buffer.from(envKey, 'hex');
    } else {
      // Derive the same dev fallback as utils/encryption.ts
      cachedGlobalKey = crypto.pbkdf2Sync(
        'orion-dev-encryption-key-do-not-use-in-production',
        'orion-salt',
        100000,
        32,
        'sha256',
      );
    }
  }
  return cachedGlobalKey;
}

export class FieldEncryptionService {
  private tenantKey: Buffer;

  /**
   * @param tenantId - The tenant identifier. Used to derive a tenant-scoped encryption key.
   *                    Passing SYSTEM_TENANT_ID ('__system__') for background tasks is safe.
   */
  constructor(private tenantId: string | number) {
    const globalKey = getGlobalKey();
    this.tenantKey = deriveTenantKey(globalKey, tenantId);
  }

  /**
   * Encrypt a plaintext field value.
   *
   * Delegates to encryptValue after swapping the global key with the tenant-derived key
   * via the ENC:AES256: prefix protocol. The format produced is identical to encryptValue
   * so decryptValue can read it transparently once the same tenant key is in context.
   *
   * @param value - Plain text to encrypt (null/undefined/empty returns as-is)
   * @returns ENC:AES256:<base64(iv+ciphertext+authTag)> or the original value if encryption fails
   */
  encryptField(value: string | null | undefined): string {
    if (!value) return value || '';
    if (isEncrypted(value)) return value; // Already encrypted — idempotent

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.tenantKey, iv);
      cipher.setAAD(Buffer.from('orion-encryption'));

      let encrypted = cipher.update(value, 'utf-8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      const combined = Buffer.concat([
        iv,
        Buffer.from(encrypted, 'base64'),
        authTag,
      ]);
      return `ENC:AES256:${combined.toString('base64')}`;
    } catch (error) {
      // Fallback to plaintext on failure — caller must not store in production
      return value;
    }
  }

  /**
   * Decrypt an AES-256-GCM encrypted field value.
   *
   * Transparently decrypts values encrypted with the same tenant key.
   * Non-encrypted values are returned unchanged (idempotent).
   *
   * @param value - Encrypted value (ENC:AES256:...) or plain text
   * @returns Decrypted plain text, or the original value if not encrypted or decryption fails
   */
  decryptField(value: string | null | undefined): string {
    if (!value) return value || '';
    if (!isEncrypted(value)) return value; // Not encrypted — pass through

    try {
      const encoded = value.slice('ENC:AES256:'.length);
      const combined = Buffer.from(encoded, 'base64');

      const iv = combined.subarray(0, 16);
      const authTag = combined.subarray(combined.length - 16);
      const ciphertext = combined.subarray(16, combined.length - 16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.tenantKey, iv);
      decipher.setAAD(Buffer.from('orion-encryption'));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, undefined, 'utf-8');
      decrypted += decipher.final('utf-8');
      return decrypted;
    } catch {
      // Return as-is on failure (e.g., corrupted data or wrong key)
      return value;
    }
  }

  /**
   * Check whether a value is already encrypted (has the ENC:AES256: prefix).
   *
   * @param value - Value to check
   * @returns true if the value appears to be encrypted
   */
  isEncryptedField(value: string | null | undefined): boolean {
    return isEncrypted(value || '');
  }
}

export default FieldEncryptionService;
