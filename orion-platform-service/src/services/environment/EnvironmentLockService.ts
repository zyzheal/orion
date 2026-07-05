/**
 * EnvironmentLockService - Lock/unlock deployment environments
 *
 * Provides environment lock protection to prevent accidental deployments
 * to locked environments (especially production). When an environment is
 * locked, any deployment attempt will be rejected with a clear error message.
 *
 * Quick Win: Environment Lock/Protection
 */

import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

export interface LockInfo {
  locked: boolean;
  lockedBy?: string;
  lockedAt?: Date;
  reason?: string;
}

export interface DeploymentAllowedResult {
  allowed: boolean;
  reason?: string;
  lockInfo?: LockInfo;
}

export class EnvironmentLockService {
  constructor(private pool: DatabasePool) {}

  /**
   * Lock an environment to prevent deployments.
   */
  async lockEnvironment(
    envId: string,
    lockedBy: string,
    reason: string
  ): Promise<LockInfo> {
    const result = await this.pool.query(
      `UPDATE environments
       SET locked = TRUE, locked_by = $2, locked_at = NOW(), locked_reason = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING locked, locked_by, locked_at, locked_reason`,
      [envId, lockedBy, reason]
    );

    if (result.rows.length === 0) {
      throw new OrionError(`Environment not found: ${envId}`, ErrorCode.NOT_FOUND);
    }

    const row = result.rows[0];
    return {
      locked: row.locked,
      lockedBy: row.locked_by,
      lockedAt: row.locked_at,
      reason: row.locked_reason,
    };
  }

  /**
   * Unlock an environment to allow deployments.
   */
  async unlockEnvironment(envId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE environments
       SET locked = FALSE, locked_by = NULL, locked_at = NULL, locked_reason = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [envId]
    );

    if (result.rows.length === 0) {
      throw new OrionError(`Environment not found: ${envId}`, ErrorCode.NOT_FOUND);
    }
  }

  /**
   * Check if an environment is currently locked.
   */
  async isEnvironmentLocked(envId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT locked FROM environments WHERE id = $1',
      [envId]
    );

    if (result.rows.length === 0) {
      throw new OrionError(`Environment not found: ${envId}`, ErrorCode.NOT_FOUND);
    }

    return result.rows[0].locked;
  }

  /**
   * Get full lock information for an environment.
   */
  async getLockInfo(envId: string): Promise<LockInfo | null> {
    const result = await this.pool.query(
      'SELECT locked, locked_by, locked_at, locked_reason FROM environments WHERE id = $1',
      [envId]
    );

    if (result.rows.length === 0) {
      throw new OrionError(`Environment not found: ${envId}`, ErrorCode.NOT_FOUND);
    }

    const row = result.rows[0];
    if (!row.locked) {
      return { locked: false };
    }

    return {
      locked: true,
      lockedBy: row.locked_by,
      lockedAt: row.locked_at,
      reason: row.locked_reason,
    };
  }

  /**
   * Check if a deployment is allowed to proceed.
   * Returns { allowed: false, reason: '...' } when locked.
   */
  async checkDeploymentAllowed(envId: string): Promise<DeploymentAllowedResult> {
    const lockInfo = await this.getLockInfo(envId);

    if (lockInfo && lockInfo.locked) {
      return {
        allowed: false,
        reason: `Environment is locked by ${lockInfo.lockedBy} — ${lockInfo.reason}`,
        lockInfo,
      };
    }

    return { allowed: true };
  }
}
