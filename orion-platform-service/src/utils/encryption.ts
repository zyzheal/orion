/**
 * Encryption Utility - AES-256-GCM
 *
 * Provides static encryption/decryption for sensitive data at rest.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * Key derivation: PBKDF2 with SHA-256
 * The encryption key should be provided via ORION_ENCRYPTION_KEY env variable.
 * Key format: 64-character hex string (32 bytes)
 */

import crypto from 'crypto';
import { OrionError, ErrorCode } from '../errors';
import { createLogger } from './logger';

const logger = createLogger('encryption');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
const ENCODING = 'base64';
const PREFIX = 'ENC:AES256:';

/**
 * Get the encryption key from environment or derive from a default
 * In production, ORION_ENCRYPTION_KEY must be set
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ORION_ENCRYPTION_KEY;
  if (envKey) {
    // Validate key length (64 hex chars = 32 bytes)
    if (envKey.length !== 64) {
      throw new OrionError('ORION_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)', ErrorCode.VALIDATION_ERROR);
    }
    return Buffer.from(envKey, 'hex');
  }

  // Development fallback: derive key from a constant (NOT for production!)
  // This allows the system to work without env var in development
  const devKey = crypto.pbkdf2Sync('orion-dev-encryption-key-do-not-use-in-production', 'orion-salt', PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  return devKey;
}

/**
 * Derive a key from password and salt using PBKDF2
 */
function deriveKey(password: string | Buffer, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a string value using AES-256-GCM
 *
 * Format: ENC:AES256:<base64(IV + ciphertext + authTag)>
 *
 * @param value - Plain text to encrypt
 * @returns Encrypted value with ENC:AES256: prefix
 */
export function encryptValue(value: string): string {
  if (!value) return value;
  if (value.startsWith('ENC:')) return value; // Already encrypted

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from('orion-encryption'));

    let encrypted = cipher.update(value, 'utf-8', ENCODING);
    encrypted += cipher.final(ENCODING);
    const authTag = cipher.getAuthTag();

    // Combine: IV + ciphertext + authTag
    const combined = Buffer.concat([iv, Buffer.from(encrypted, ENCODING), authTag]);
    return `${PREFIX}${combined.toString(ENCODING)}`;
  } catch (error) {
    logger.error({ err: error as Error, stack: (error as Error).stack }, '[Encryption] Encryption failed');
    throw new OrionError('Encryption failed', ErrorCode.INTERNAL_ERROR);
  }
}

/**
 * Decrypt an encrypted value
 *
 * @param value - Encrypted value with ENC:AES256: prefix
 * @returns Decrypted plain text
 */
export function decryptValue(value: string): string {
  if (!value) return value;
  if (!value.startsWith(PREFIX)) return value; // Not encrypted

  try {
    const key = getEncryptionKey();
    const encoded = value.slice(PREFIX.length);
    const combined = Buffer.from(encoded, ENCODING);

    // Extract: IV (16 bytes) + ciphertext + authTag (16 bytes)
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(Buffer.from('orion-encryption'));
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, undefined, 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  } catch (error) {
    logger.error({ err: error as Error, stack: (error as Error).stack }, '[Encryption] Decryption failed');
    return value; // Return encrypted value on error
  }
}

/**
 * Check if a value is encrypted with AES-256
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith(PREFIX) ?? false;
}

/**
 * Rotate encryption key (re-encrypt all data with new key)
 * This requires a key migration pass - not implemented here
 */
export function rotateKey(_newKey: string): void {
  throw new OrionError('Key rotation requires a database migration pass. Use the migration script instead.', ErrorCode.INTERNAL_ERROR);
}

export default {
  encrypt: encryptValue,
  decrypt: decryptValue,
  isEncrypted,
  rotateKey,
};

/**
 * Hash a plaintext value using HMAC-SHA256 (for webhook secret verification)
 * Returns a base64-encoded HMAC digest suitable for storage in secret_hash columns.
 */
export function hashValue(value: string): string {
  if (!value) return value;
  try {
    const key = getEncryptionKey();
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(value, 'utf-8');
    return hmac.digest('base64');
  } catch (error) {
    logger.error({ err: error as Error, stack: (error as Error).stack }, '[Encryption] hashValue failed');
    throw new OrionError('Failed to hash value', ErrorCode.INTERNAL_ERROR);
  }
}

/**
 * Compare a plaintext value against a stored HMAC-SHA256 hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function compareHash(plaintext: string, storedHash: string): boolean {
  if (!plaintext || !storedHash) return false;
  try {
    const computed = hashValue(plaintext);
    const a = Buffer.from(computed, 'base64');
    const b = Buffer.from(storedHash, 'base64');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (error) {
    logger.error({ err: error as Error, stack: (error as Error).stack }, '[Encryption] compareHash failed');
    return false;
  }
}
