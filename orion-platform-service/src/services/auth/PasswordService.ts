/**
 * PasswordService - Centralized password hashing using bcrypt
 *
 * Unified password hashing for the Orion platform.
 * Replaces scattered PBKDF2/scrypt implementations with a single bcrypt-based service.
 *
 * Security parameters:
 * - Algorithm: bcrypt
 * - Rounds: 12
 * - Supports legacy PBKDF2 and scrypt formats for backward compatibility during migration
 */

// @ts-ignore
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password string
 */
export async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a plain text password with a bcrypt hash
 * @param password - Plain text password
 * @param hashedPassword - Bcrypt hashed password
 * @returns true if password matches, false otherwise
 */
export async function compare(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Check if a hash needs rehashing (e.g., rounds changed)
 * @param hashedPassword - Hashed password string
 * @returns true if hash needs rehashing
 */
export function needsRehash(hashedPassword: string): boolean {
  return bcrypt.getRounds(hashedPassword) < BCRYPT_ROUNDS;
}

/**
 * Legacy PBKDF2 hash verification for backward compatibility
 * Supports format: pbkdf2$salt$iterations$hash
 */
async function verifyPbkdf2(password: string, storedHash: string): Promise<boolean> {
  const crypto = await import('crypto');
  const HASH_PREFIX = 'pbkdf2$';
  const KEY_LENGTH = 64;

  if (!storedHash.startsWith(HASH_PREFIX)) {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 4) {
    return false;
  }

  const [, salt, iterationsStr, expectedHash] = parts;
  const iterations = parseInt(iterationsStr, 10);

  if (!salt || !expectedHash || isNaN(iterations) || iterations <= 0) {
    return false;
  }

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, KEY_LENGTH, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex') === expectedHash);
    });
  });
}

/**
 * Legacy scrypt hash verification for backward compatibility
 * Supports format: salt:hash
 */
async function verifyScrypt(password: string, storedHash: string): Promise<boolean> {
  const crypto = await import('crypto');
  const { promisify } = await import('util');
  const { scrypt, timingSafeEqual } = crypto;
  const scryptAsync = promisify(scrypt);

  const [salt, key] = storedHash.split(':');
  if (!salt || !key) {
    return false;
  }

  const keyBuffer = Buffer.from(key, 'hex');
  const suppliedHash = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(keyBuffer, suppliedHash);
}

/**
 * Verify a password against a stored hash.
 * Supports bcrypt (new), PBKDF2 (legacy), and scrypt (legacy) formats.
 *
 * @param password - Plain text password to verify
 * @param storedHash - Stored password hash
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !password) {
    return false;
  }

  // bcrypt format (new standard): starts with $2a$ or $2b$ or $2y$
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return compare(password, storedHash);
  }

  // PBKDF2 format: pbkdf2$salt$iterations$hash
  if (storedHash.startsWith('pbkdf2$')) {
    return verifyPbkdf2(password, storedHash);
  }

  // scrypt format: salt:hash (from routes-auth.ts)
  if (storedHash.includes(':')) {
    return verifyScrypt(password, storedHash);
  }

  // Legacy SHA-256 format (hex string without prefix)
  const crypto = await import('crypto');
  const sha256Hash = crypto.createHash('sha256');
  sha256Hash.update(password);
  if (sha256Hash.digest('hex') === storedHash) {
    return true;
  }

  return false;
}

/**
 * Check if a password hash needs migration to bcrypt
 * @param storedHash - Stored password hash
 * @returns true if hash is in legacy format and needs migration
 */
export function needsMigration(storedHash: string): boolean {
  if (!storedHash) return false;
  // bcrypt hashes start with $2a$/$2b$/$2y$
  return !(storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$'));
}

/**
 * PasswordService class for dependency injection
 */
export class PasswordService {
  async hash(password: string): Promise<string> {
    return hash(password);
  }

  async compare(password: string, hashedPassword: string): Promise<boolean> {
    return compare(password, hashedPassword);
  }

  needsRehash(hashedPassword: string): boolean {
    return needsRehash(hashedPassword);
  }

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    return verifyPassword(password, storedHash);
  }

  needsMigration(storedHash: string): boolean {
    return needsMigration(storedHash);
  }
}

export default PasswordService;
