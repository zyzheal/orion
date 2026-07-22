/**
 * MfaService — TOTP-based Multi-Factor Authentication (MFA/2FA)
 *
 * Features:
 *   - RFC 6238 TOTP generation and verification (pure Node.js crypto, no external TOTP library)
 *   - MFA enable/disable flow with provisioning URI for authenticator apps
 *   - Backup codes (10 one-time codes, SHA-256 hashed for storage)
 *   - MFA verification with both TOTP and backup code support
 *   - Password reset token generation and verification
 *
 * Storage: User table columns (migration 415)
 *   mfa_secret         - Base32-encoded TOTP secret
 *   mfa_enabled        - Whether MFA is active
 *   mfa_backup_codes   - JSON array of hashed backup codes
 *
 * Usage:
 *   const mfaService = new MfaService(userRepository, jwtKeyManager);
 *   await mfaService.enableMfa(userId, 'orion-platform');
 *   const result = await mfaService.verifyMfa(userId, userInput.code);
 */

import crypto from 'crypto';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import {
  UserRepository,
  User,
} from '../user/UserRepository';
import { getCurrentTraceId, getCurrentTenantId } from '../../db/tenant-context-storage';
import { FieldEncryptionService } from './FieldEncryptionService';

const logger = createLogger('mfa-service');

// ---------------------------------------------------------------------------
// TOTP Configuration
// ---------------------------------------------------------------------------

const TOTP_SECRET_LENGTH = 20;           // 20 bytes = 160 bits (RFC 4226 recommendation)
const TOTP_DIGITS = 6;                    // 6-digit OTP (standard)
const TOTP_PERIOD = 30;                   // 30-second time step (RFC 6238)
const TOTP_ALGORITHM = 'sha1';            // SHA-1 per RFC 6238
const TOTP_WINDOW = 1;                    // Allow ±1 time step for clock drift

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10;            // 10-character alphanumeric codes
const PASSWORD_RESET_TOKEN_LENGTH = 32;   // 64-char hex token
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ---------------------------------------------------------------------------
// Public Interfaces
// ---------------------------------------------------------------------------

export interface MfaSetupResult {
  secret: string;           // Base32-encoded TOTP secret (for QR code / manual entry)
  qrCodeUri: string;        // otpauth:// URI for authenticator app
  backupCodes: string[];    // Plaintext backup codes (shown once to user)
}

export interface MfaVerificationResult {
  success: boolean;
  usedBackupCode: boolean;  // true if a backup code was consumed
  remainingBackupCodes: number;
}

export interface PasswordResetResult {
  resetToken: string;       // The generated reset token
  expiresAt: Date;          // Expiry timestamp
}

// ---------------------------------------------------------------------------
// TOTP Implementation (RFC 6238, pure Node.js crypto)
// ---------------------------------------------------------------------------

/**
 * Base32 alphabet (RFC 4648)
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode raw bytes to Base32 string
 */
function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decode Base32 string to raw bytes
 */
function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new OrionError(`Invalid Base32 character: ${char}`, ErrorCode.INVALID_INPUT);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate a random Base32-encoded TOTP secret
 */
function generateTotpSecret(): string {
  const rawBytes = crypto.randomBytes(TOTP_SECRET_LENGTH);
  return base32Encode(rawBytes);
}

/**
 * Compute HMAC-SHA1 per RFC 2202
 */
function hmacSha1(key: Buffer, message: Buffer): Buffer {
  return crypto.createHmac('sha1', key).update(message).digest();
}

/**
 * Dynamic truncation per RFC 4226 §5.3
 */
function dynamicTruncation(hmacHash: Buffer): number {
  const offset = hmacHash[hmacHash.length - 1] & 0x0f;
  const binary =
    ((hmacHash[offset] & 0x7f) << 24) |
    ((hmacHash[offset + 1] & 0xff) << 16) |
    ((hmacHash[offset + 2] & 0xff) << 8) |
    (hmacHash[offset + 3] & 0xff);
  return binary % 10 ** TOTP_DIGITS;
}

/**
 * Generate TOTP value for a given secret and time step
 */
function generateTotpValue(secretBase32: string, counter: bigint): number {
  const secret = base32Decode(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);

  const hmac = hmacSha1(secret, counterBuffer);
  return dynamicTruncation(hmac);
}

/**
 * Get current TOTP counter (time steps since Unix epoch)
 */
function getCurrentCounter(): bigint {
  return BigInt(Math.floor(Date.now() / 1000 / TOTP_PERIOD));
}

/**
 * Format TOTP value as zero-padded string
 */
function formatTotp(value: number): string {
  return value.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Validate Base32-encoded TOTP secret
 */
function isValidBase32(secret: string): boolean {
  if (!secret || secret.length < 16) return false;
  const cleaned = secret.replace(/\s/g, '').toUpperCase();
  return /^[A-Z2-7]+=*$/.test(cleaned);
}

// ---------------------------------------------------------------------------
// MfaService
// ---------------------------------------------------------------------------

export class MfaService {
  private userRepository: UserRepository;
  private fieldEncryption: FieldEncryptionService;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
    // Derive a tenant-specific encryption key from the current request context
    this.fieldEncryption = new FieldEncryptionService(getCurrentTenantId());
  }

  // ======================== Helpers ========================

  /**
   * Resolve tenant_id for the current user.
   * Prefers the user.tenant_id column (set via tenant_users join), falls back to the
   * current request's tenant context. Returns '__system__' as a last resort.
   */
  private resolveTenantId(user: User): string {
    return (user as any).tenant_id || getCurrentTenantId();
  }

  /**
   * Lazily re-derive the field encryption instance when tenant context changes
   * (e.g. when operating on a user from a different tenant than the current request).
   */
  private getFieldEncryption(user: User): FieldEncryptionService {
    const tenantId = this.resolveTenantId(user);
    // Re-create per-call so we always use the correct tenant key
    return new FieldEncryptionService(tenantId);
  }

  // ======================== Setup ========================

  /**
   * Enable MFA for a user. Generates a new TOTP secret and backup codes.
   *
   * @param userId   - User ID to enable MFA for
   * @param issuer   - Issuer name for the TOTP URI (e.g. 'orion-platform')
   * @returns MfaSetupResult with secret, qrCodeUri, and backupCodes
   */
  async enableMfa(userId: string, issuer: string = 'orion-platform'): Promise<MfaSetupResult> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new OrionError(`User not found: ${userId}`, ErrorCode.NOT_FOUND);
    }

    if (user.mfa_enabled) {
      throw new OrionError(
        'MFA is already enabled for this user',
        ErrorCode.ALREADY_EXISTS,
        false,
        { userId },
      );
    }

    // Generate new TOTP secret (plaintext, will be encrypted before DB storage)
    const plaintextSecret = generateTotpSecret();

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(BACKUP_CODE_COUNT);
    const hashedBackupCodes = backupCodes.map((code) => this.hashBackupCode(code));

    // Generate QR code URI (uses plaintext secret for URI)
    const qrCodeUri = this.buildQrCodeUri(plaintextSecret, issuer, user.username || user.email || userId);

    // Encrypt the TOTP secret before persisting (tenant-isolated AES-256-GCM)
    const encryption = this.getFieldEncryption(user);
    const encryptedSecret = encryption.encryptField(plaintextSecret);

    // Persist to database (not yet enabled until verified)
    await this.userRepository.update(userId, {
      mfa_secret: encryptedSecret,
      mfa_enabled: false,      // remains disabled until user verifies first code
      mfa_backup_codes: JSON.stringify(hashedBackupCodes),
    });

    logger.info(
      { userId, traceId: getCurrentTraceId() },
      '[MfaService] MFA setup initiated, awaiting verification',
    );

    return {
      secret: plaintextSecret,   // Return plaintext only to the caller for QR setup
      qrCodeUri,
      backupCodes,
    };
  }

  /**
   * Disable MFA for a user. Requires valid MFA code for confirmation.
   *
   * @param userId - User ID
   * @param code   - Current valid TOTP or backup code (proof of possession)
   */
  async disableMfa(userId: string, code: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new OrionError(`User not found: ${userId}`, ErrorCode.NOT_FOUND);
    }

    if (!user.mfa_enabled && !user.mfa_secret) {
      throw new OrionError('MFA is not enabled for this user', ErrorCode.OPERATION_FAILED, false, { userId });
    }

    // Require valid MFA code as confirmation
    const verification = await this.verifyMfaCode(user, code);
    if (!verification.success) {
      throw new OrionError('Invalid MFA code, cannot disable MFA', ErrorCode.UNAUTHORIZED, false, { userId });
    }

    await this.userRepository.update(userId, {
      mfa_secret: null,
      mfa_enabled: false,
      mfa_backup_codes: null,
    });

    logger.info({ userId, traceId: getCurrentTraceId() }, '[MfaService] MFA disabled');
  }

  // ======================== Verification ========================

  /**
   * Verify an MFA code for a user. Supports TOTP and backup codes.
   *
   * @param userId - User ID
   * @param code   - 6-digit TOTP code or backup code
   * @returns MfaVerificationResult
   */
  async verifyMfa(userId: string, code: string): Promise<MfaVerificationResult> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new OrionError(`User not found: ${userId}`, ErrorCode.NOT_FOUND);
    }

    if (!user.mfa_secret) {
      throw new OrionError('MFA is not set up for this user', ErrorCode.OPERATION_FAILED, false, { userId });
    }

    // Decrypt mfa_secret before TOTP computation — never pass encrypted bytes to generateTotpValue
    const encryption = this.getFieldEncryption(user);
    const decryptedUser = {
      ...user,
      mfa_secret: encryption.decryptField(user.mfa_secret),
    };

    return this.verifyMfaCode(decryptedUser, code);
  }

  /**
   * Verify an MFA code against a user object. Used internally.
   */
  private async verifyMfaCode(user: User, code: string): Promise<MfaVerificationResult> {
    if (!user.mfa_secret) {
      return { success: false, usedBackupCode: false, remainingBackupCodes: 0 };
    }

    const normalizedCode = code.replace(/\s/g, '');

    // Try TOTP first (6-digit numeric code)
    if (/^\d{6}$/.test(normalizedCode)) {
      const totpValue = generateTotpValue(user.mfa_secret, getCurrentCounter());
      if (formatTotp(totpValue) === normalizedCode) {
        // Enable MFA on first successful verification (during setup phase)
        if (!user.mfa_enabled) {
          await this.userRepository.update(user.id, { mfa_enabled: true });
          logger.info(
            { userId: user.id, traceId: getCurrentTraceId() },
            '[MfaService] MFA activated after successful verification',
          );
        }
        return { success: true, usedBackupCode: false, remainingBackupCodes: 0 };
      }

      // Allow ±1 time step for clock drift
      const prevCounter = getCurrentCounter() - 1n;
      const nextCounter = getCurrentCounter() + 1n;
      for (const counter of [prevCounter, nextCounter]) {
        const driftValue = generateTotpValue(user.mfa_secret, counter);
        if (formatTotp(driftValue) === normalizedCode) {
          if (!user.mfa_enabled) {
            await this.userRepository.update(user.id, { mfa_enabled: true });
          }
          return { success: true, usedBackupCode: false, remainingBackupCodes: 0 };
        }
      }
    }

    // Try backup codes
    const backupResult = await this.verifyBackupCode(user, normalizedCode);
    if (backupResult.success) {
      return {
        success: true,
        usedBackupCode: true,
        remainingBackupCodes: backupResult.remainingCodes,
      };
    }

    return { success: false, usedBackupCode: false, remainingBackupCodes: 0 };
  }

  // ======================== Backup Codes ========================

  /**
   * Regenerate backup codes for a user. Invalidates all previous codes.
   *
   * @param userId - User ID
   * @returns Array of plaintext backup codes (show to user once)
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new OrionError(`User not found: ${userId}`, ErrorCode.NOT_FOUND);
    }

    if (!user.mfa_enabled && !user.mfa_secret) {
      throw new OrionError('MFA is not enabled for this user', ErrorCode.OPERATION_FAILED, false, { userId });
    }

    const backupCodes = this.generateBackupCodes(BACKUP_CODE_COUNT);
    const hashedCodes = backupCodes.map((code) => this.hashBackupCode(code));

    await this.userRepository.update(userId, {
      mfa_backup_codes: JSON.stringify(hashedCodes),
    });

    logger.info({ userId, traceId: getCurrentTraceId() }, '[MfaService] Backup codes regenerated');

    return backupCodes;
  }

  /**
   * Get remaining backup code count (for UI display)
   */
  async getRemainingBackupCodeCount(userId: string): Promise<number> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.mfa_backup_codes) return 0;

    try {
      const codes: string[] = JSON.parse(user.mfa_backup_codes);
      return codes.length;
    } catch {
      return 0;
    }
  }

  // ======================== Password Reset ========================

  /**
   * Generate a password reset token for a user.
   * Returns null if user does not exist (avoid leaking valid usernames).
   *
   * @param email - User email address
   * @returns PasswordResetResult or null
   */
  async generatePasswordResetToken(email: string): Promise<PasswordResetResult | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Return null without revealing whether email exists (security best practice)
      logger.warn(
        { email, traceId: getCurrentTraceId() },
        '[MfaService] Password reset requested for non-existent email',
      );
      return null;
    }

    const resetToken = crypto.randomBytes(PASSWORD_RESET_TOKEN_LENGTH).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.userRepository.update(user.id, {
      password_reset_token: resetToken,
      password_reset_expires: expiresAt,
    });

    logger.info(
      { userId: user.id, traceId: getCurrentTraceId() },
      '[MfaService] Password reset token generated',
    );

    return { resetToken, expiresAt };
  }

  /**
   * Verify a password reset token is valid and return the associated user.
   */
  async verifyPasswordResetToken(token: string): Promise<User | null> {
    if (!token || token.length < 32) {
      return null;
    }

    const user = await this.userRepository.findByPasswordResetToken(token);
    if (!user) {
      return null;
    }

    // Double-check expiry
    if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
      return null;
    }

    return user;
  }

  /**
   * Reset password using a valid reset token.
   */
  async resetPassword(token: string, newPasswordHash: string): Promise<void> {
    const user = await this.verifyPasswordResetToken(token);
    if (!user) {
      throw new OrionError('Invalid or expired password reset token', ErrorCode.UNAUTHORIZED);
    }

    if (!newPasswordHash || newPasswordHash.length < 8) {
      throw new OrionError('Invalid new password hash', ErrorCode.INVALID_INPUT);
    }

    await this.userRepository.updatePassword(user.id, newPasswordHash);

    // Clear any login lockout on password reset
    await this.userRepository.resetLoginAttempts(user.id);

    logger.info(
      { userId: user.id, traceId: getCurrentTraceId() },
      '[MfaService] Password reset completed',
    );
  }

  // ======================== Query Helpers ========================

  /**
   * Check if MFA is enabled for a user
   */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) return false;

    const encryption = this.getFieldEncryption(user);
    const decryptedSecret = encryption.decryptField(user.mfa_secret);

    return user.mfa_enabled === true && !!decryptedSecret;
  }

  /**
   * Get MFA status for a user (for admin / profile API)
   * Never returns the decrypted secret — only a boolean enabled flag.
   */
  async getMfaStatus(userId: string): Promise<{
    enabled: boolean;
    hasBackupCodes: boolean;
    remainingBackupCodes: number;
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new OrionError(`User not found: ${userId}`, ErrorCode.NOT_FOUND);
    }

    // Decrypt mfa_secret to determine if MFA is truly active — do not expose the secret
    const encryption = this.getFieldEncryption(user);
    const decryptedSecret = encryption.decryptField(user.mfa_secret);

    const remainingBackupCodes = await this.getRemainingBackupCodeCount(userId);

    return {
      enabled: user.mfa_enabled === true && !!decryptedSecret,
      hasBackupCodes: !!(user.mfa_backup_codes && user.mfa_backup_codes !== '[]'),
      remainingBackupCodes,
    };
  }

  // ======================== Private Helpers ========================

  /**
   * Generate N one-time backup codes (alphanumeric, no ambiguous chars)
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    // Use unambiguous characters: remove 0, O, I, l, 1
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const alphabetBuffer = Buffer.from(alphabet, 'ascii');

    for (let i = 0; i < count; i++) {
      const randomBytes = crypto.randomBytes(BACKUP_CODE_LENGTH);
      const code = Array.from(randomBytes)
        .map((b) => alphabetBuffer[b % alphabetBuffer.length])
        .join('')
        .match(/.{1,5}/g)
        ?.join('-') ?? '';
      codes.push(code);
    }

    return codes;
  }

  /**
   * SHA-256 hash a backup code for storage (never store plaintext)
   */
  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Verify a backup code against stored hashes, removing it on first use.
   */
  private async verifyBackupCode(
    user: User,
    code: string,
  ): Promise<{ success: boolean; remainingCodes: number }> {
    if (!user.mfa_backup_codes) {
      return { success: false, remainingCodes: 0 };
    }

    let storedCodes: string[];
    try {
      storedCodes = JSON.parse(user.mfa_backup_codes);
    } catch {
      return { success: false, remainingCodes: 0 };
    }

    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    const inputHash = this.hashBackupCode(normalizedCode);

    const matchIndex = storedCodes.indexOf(inputHash);
    if (matchIndex === -1) {
      return { success: false, remainingCodes: storedCodes.length };
    }

    // Remove used backup code (one-time use)
    storedCodes.splice(matchIndex, 1);
    const remainingCodes = storedCodes.length;

    await this.userRepository.update(user.id, {
      mfa_backup_codes: JSON.stringify(storedCodes),
    });

    logger.info(
      { userId: user.id, remainingCodes, traceId: getCurrentTraceId() },
      '[MfaService] Backup code consumed',
    );

    return { success: true, remainingCodes };
  }

  /**
   * Build otpauth:// URI for QR code generation
   * Format: otpauth://totp/{issuer}:{account}?secret={secret}&issuer={issuer}&period=30&digits=6&algorithm=SHA1
   */
  private buildQrCodeUri(secret: string, issuer: string, account: string): string {
    const params = new URLSearchParams({
      secret,
      issuer,
      period: String(TOTP_PERIOD),
      digits: String(TOTP_DIGITS),
      algorithm: TOTP_ALGORITHM,
    });

    const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
    return `otpauth://totp/${label}?${params.toString()}`;
  }
}
