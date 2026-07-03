/**
 * Password Hashing Utility - PBKDF2
 *
 * Unified password hashing for the Orion platform.
 * Format: pbkdf2$salt$iterations$hash
 *
 * Security parameters:
 * - Algorithm: PBKDF2 with SHA-256
 * - Salt length: 16 bytes (32 hex chars)
 * - Key length: 64 bytes (128 hex chars)
 * - Iterations: 100000
 */

import crypto from 'crypto';

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const HASH_PREFIX = 'pbkdf2$';

/**
 * Hash a password using PBKDF2 with SHA-256
 * @param password - Plain text password
 * @returns Hashed password in format: pbkdf2$salt$iterations$hash
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${HASH_PREFIX}${salt}$${PBKDF2_ITERATIONS}$${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify a password against a stored hash
 * Supports PBKDF2 format: pbkdf2$salt$iterations$hash
 *
 * @param password - Plain text password to verify
 * @param storedHash - Stored password hash
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !password) {
    return false;
  }

  // PBKDF2 format: pbkdf2$salt$iterations$hash
  if (storedHash.startsWith(HASH_PREFIX)) {
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

  // Legacy SHA-256 format (hex string without prefix)
  // This allows migration of existing users without forcing password reset
  const sha256Hash = crypto.createHash('sha256');
  sha256Hash.update(password);
  if (sha256Hash.digest('hex') === storedHash) {
    return true;
  }

  // No plaintext fallback for security
  // If the hash doesn't match any known format, authentication fails
  return false;
}

/**
 * Check if a password hash needs migration (legacy format)
 *
 * @param storedHash - Stored password hash
 * @returns true if hash is in legacy format and needs migration
 */
export function needsMigration(storedHash: string): boolean {
  if (!storedHash) return false;
  return !storedHash.startsWith(HASH_PREFIX);
}

/**
 * Password policy validation result
 */
export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
}

/**
 * Password policy configuration
 */
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialChar: boolean;
}

const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecialChar: true,
};

const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

/**
 * Validate password against policy
 *
 * @param password - Plain text password to validate
 * @param policy - Optional custom policy (defaults to DEFAULT_PASSWORD_POLICY)
 * @returns PasswordPolicyResult with valid flag and error messages
 */
export function validatePasswordPolicy(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): PasswordPolicyResult {
  const errors: string[] = [];

  if (!password || password.length < policy.minLength) {
    errors.push(`密码长度至少为 ${policy.minLength} 位`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含至少一个大写字母');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含至少一个小写字母');
  }

  if (policy.requireDigit && !/\d/.test(password)) {
    errors.push('密码必须包含至少一个数字');
  }

  if (policy.requireSpecialChar && !SPECIAL_CHAR_REGEX.test(password)) {
    errors.push('密码必须包含至少一个特殊字符 (!@#$%^&*等)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  hashPassword,
  verifyPassword,
  needsMigration,
  validatePasswordPolicy,
};
