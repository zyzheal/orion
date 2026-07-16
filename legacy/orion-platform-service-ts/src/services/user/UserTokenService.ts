/**
 * UserTokenService - API Token management service
 *
 * Handles creation, validation, and management of user API tokens
 * for programmatic access to the platform.
 */

import { DatabasePool } from '../database';
import { randomBytes, createHash } from 'crypto';
import { promisify } from 'util';

const randomBytesAsync = promisify(randomBytes);

/**
 * API Token entity
 */
export interface UserToken {
  id: string;
  userId: string;
  name: string;
  token: string; // Only returned on creation
  tokenHash: string; // Stored hash
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

/**
 * Token without the raw token (for listing)
 */
export type UserTokenSummary = Omit<UserToken, 'token' | 'tokenHash'> & { tokenHash: string };

/**
 * Input for creating a new token
 */
export interface CreateTokenInput {
  userId: string;
  name: string;
  expiresInDays?: number;
}

/**
 * Service errors
 */
export class UserTokenServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'UserTokenServiceError';
  }
}

/**
 * UserTokenService - Business logic for API token management
 */
export class UserTokenService {
  private pool: DatabasePool;
  private readonly TOKEN_PREFIX = 'orion_';

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Create a new API token for a user
   */
  async createToken(input: CreateTokenInput): Promise<UserToken> {
    const { userId, name, expiresInDays } = input;

    // Validate input
    if (!userId || userId.trim().length === 0) {
      throw new UserTokenServiceError('User ID is required', 'INVALID_USER_ID');
    }

    if (!name || name.trim().length === 0) {
      throw new UserTokenServiceError('Token name is required', 'INVALID_NAME');
    }

    if (name.length > 100) {
      throw new UserTokenServiceError('Token name must be 100 characters or less', 'NAME_TOO_LONG');
    }

    // Generate token
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);

    // Calculate expiration
    let expiresAt: Date | undefined;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Insert into database
    const result = await this.pool.query(
      `INSERT INTO user_api_tokens (user_id, name, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, name, expires_at, last_used_at, created_at`,
      [userId, name.trim(), tokenHash, expiresAt || null]
    );

    if (result.rows.length === 0) {
      throw new UserTokenServiceError('Failed to create token', 'CREATE_FAILED');
    }

    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      token: rawToken, // Return raw token only on creation
      tokenHash,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Get all tokens for a user (without raw token)
   */
  async getTokens(userId: string): Promise<Omit<UserToken, 'token'>[]> {
    if (!userId || userId.trim().length === 0) {
      throw new UserTokenServiceError('User ID is required', 'INVALID_USER_ID');
    }

    const result = await this.pool.query(
      `SELECT id, user_id, name, token_hash, expires_at, last_used_at, created_at
       FROM user_api_tokens
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Delete an API token
   */
  async deleteToken(userId: string, tokenId: string): Promise<boolean> {
    if (!userId || userId.trim().length === 0) {
      throw new UserTokenServiceError('User ID is required', 'INVALID_USER_ID');
    }

    if (!tokenId || tokenId.trim().length === 0) {
      throw new UserTokenServiceError('Token ID is required', 'INVALID_TOKEN_ID');
    }

    const result = await this.pool.query(
      `DELETE FROM user_api_tokens
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [tokenId, userId]
    );

    if (result.rowCount === 0) {
      // Token not found or doesn't belong to user
      return false;
    }

    return true;
  }

  /**
   * Validate an API token
   *
   * This method:
   * 1. Hashes the provided token
   * 2. Looks up the token in the database
   * 3. Checks expiration
   * 4. Updates last_used_at timestamp
   */
  async validateToken(token: string): Promise<Omit<UserToken, 'token'> | null> {
    if (!token || token.trim().length === 0) {
      return null;
    }

    // Check prefix to avoid unnecessary hash computation
    if (!token.startsWith(this.TOKEN_PREFIX)) {
      return null;
    }

    const tokenHash = this.hashToken(token);

    const result = await this.pool.query(
      `SELECT id, user_id, name, token_hash, expires_at, last_used_at, created_at
       FROM user_api_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Check expiration
    if (row.expires_at) {
      const expiresAt = new Date(row.expires_at);
      if (expiresAt < new Date()) {
        // Token has expired
        return null;
      }
    }

    // Update last_used_at
    await this.pool.query(
      `UPDATE user_api_tokens
       SET last_used_at = NOW()
       WHERE id = $1`,
      [row.id]
    );

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Get a single token by ID (for admin purposes)
   */
  async getTokenById(tokenId: string): Promise<Omit<UserToken, 'token'> | null> {
    if (!tokenId || tokenId.trim().length === 0) {
      return null;
    }

    const result = await this.pool.query(
      `SELECT id, user_id, name, token_hash, expires_at, last_used_at, created_at
       FROM user_api_tokens
       WHERE id = $1`,
      [tokenId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Delete all tokens for a user
   */
  async deleteAllTokens(userId: string): Promise<number> {
    if (!userId || userId.trim().length === 0) {
      throw new UserTokenServiceError('User ID is required', 'INVALID_USER_ID');
    }

    const result = await this.pool.query(
      `DELETE FROM user_api_tokens WHERE user_id = $1 RETURNING id`,
      [userId]
    );

    return result.rowCount;
  }

  /**
   * Generate a new API token
   */
  private generateToken(): string {
    const randomPart = randomBytes(32).toString('hex');
    return `${this.TOKEN_PREFIX}${randomPart}`;
  }

  /**
   * Hash a token using SHA-256
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}