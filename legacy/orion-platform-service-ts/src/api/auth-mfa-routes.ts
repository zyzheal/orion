/**
 * Auth MFA Routes — MFA/2FA, Password Reset, Login Lockout
 *
 * Task 5.3: 认证增强 — MFA/2FA、密码重置、登录失败锁定
 *
 * Provides endpoints for:
 * - MFA setup, confirmation, disable, verification
 * - Password reset (request + confirm)
 * - Login attempt lockout management
 *
 * Storage: User table columns (mfa_secret, mfa_enabled, mfa_backup_codes,
 *          password_reset_token, password_reset_expires, failed_login_attempts, locked_until)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import type { DatabasePool } from '../services/database';
import { OrionError, ValidationError, ErrorCode, handleError } from '../errors';
import { MfaService } from '../services/auth/MfaService';
import { LoginAttemptService, DEFAULT_LOGIN_ATTEMPT_CONFIG } from '../services/auth/LoginAttemptService';
import { UserRepository } from '../services/user/UserRepository';
import { PasswordService } from '../services/auth/PasswordService';

export interface AuthMfaRouteOptions {
  database: DatabasePool;
}

// ==================== Request Schemas ====================

interface MfaSetupRequest {
  body: {
    issuer?: string;
  };
}

interface MfaConfirmRequest {
  body: {
    code: string;
  };
}

interface MfaDisableRequest {
  body: {
    code: string;
  };
}

interface MfaVerifyRequest {
  body: {
    mfaToken: string;
    code: string;
  };
}

interface PasswordResetRequestRequest {
  body: {
    email: string;
  };
}

interface PasswordResetConfirmRequest {
  body: {
    token: string;
    newPassword: string;
  };
}

interface LoginAttemptsStatusRequest {
  params: {
    userId?: string;
  };
}

interface UnlockAccountRequest {
  body: {
    userId: string;
  };
}

// ==================== Routes ====================

export default async function authMfaRoutes(
  app: FastifyInstance,
  options: AuthMfaRouteOptions,
): Promise<void> {
  const { database } = options;

  // Initialize services
  const userRepository = new UserRepository(database);
  const passwordService = new PasswordService();
  const mfaService = new MfaService(userRepository);
  const loginAttemptService = new LoginAttemptService(userRepository, {
    ...DEFAULT_LOGIN_ATTEMPT_CONFIG,
  });

  // Start periodic cleanup of stale lock states
  loginAttemptService.start();

  const jwtSecret = (await import('../services/auth/JwtKeyManager')).jwtKeyManager.getCurrentSecret();

  // ============================================================
  // MFA Setup & Management
  // ============================================================

  /**
   * POST /api/v1/auth/mfa/setup - Enable MFA for current user
   * Returns secret, QR code URI, and backup codes (plaintext, shown once)
   */
  app.post('/mfa/setup', {
    onRequest: [authenticateUser, requirePermission({ resource: 'auth', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user as { userId: string; username: string };
      if (!user) {
        return handleError(reply, new OrionError('UNAUTHORIZED', ErrorCode.UNAUTHORIZED));
      }

      const { issuer } = (request.body as MfaSetupRequest['body']) || {};
      const result = await mfaService.enableMfa(user.userId, issuer || 'orion-platform');

      return reply.status(201).send({
        success: true,
        data: result,
        message: 'MFA setup initiated. Scan QR code with authenticator app and verify with a code.',
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  /**
   * POST /api/v1/auth/mfa/confirm - Confirm MFA setup with first TOTP code
   */
  app.post('/mfa/confirm', {
    onRequest: [authenticateUser, requirePermission({ resource: 'auth', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user as { userId: string };
      if (!user) {
        return handleError(reply, new OrionError('UNAUTHORIZED', ErrorCode.UNAUTHORIZED));
      }

      const { code } = (request.body as MfaConfirmRequest['body']) || {};
      if (!code) {
        return handleError(reply, new ValidationError('MFA_CODE_REQUIRED'));
      }

      await mfaService.verifyMfa(user.userId, code);

      return reply.send({
        success: true,
        message: 'MFA enabled successfully',
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  /**
   * POST /api/v1/auth/mfa/disable - Disable MFA (requires valid TOTP or backup code)
   */
  app.post('/mfa/disable', {
    onRequest: [authenticateUser, requirePermission({ resource: 'auth', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user as { userId: string };
      if (!user) {
        return handleError(reply, new OrionError('UNAUTHORIZED', ErrorCode.UNAUTHORIZED));
      }

      const { code } = (request.body as MfaDisableRequest['body']) || {};
      if (!code) {
        return handleError(reply, new ValidationError('MFA_CODE_REQUIRED'));
      }

      await mfaService.disableMfa(user.userId, code);

      return reply.send({
        success: true,
        message: 'MFA disabled successfully',
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  /**
   * POST /api/v1/auth/mfa/verify - Verify MFA code during login flow
   * No authentication required — uses mfaToken from login response
   */
  app.post('/mfa/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { mfaToken, code } = (request.body as MfaVerifyRequest['body']) || {};

      if (!mfaToken || !code) {
        return reply.status(400).send({
          success: false,
          error: 'MFA_TOKEN_AND_CODE_REQUIRED',
          code: '30102',
          message: 'MFA token and code are required',
        });
      }

      // Verify the mfaToken
      if (!jwtSecret) {
        return reply.status(500).send({ error: 'JWT_NOT_CONFIGURED', message: 'JWT_SECRET not configured' });
      }

      let payload: { userId: string; username: string; role: string; tenantId?: string; mfa: true };
      try {
        payload = jwt.verify(mfaToken, jwtSecret, { algorithms: ['HS256'] }) as typeof payload;
      } catch {
        return reply.status(401).send({
          success: false,
          error: 'INVALID_MFA_TOKEN',
          code: '20102',
          message: 'MFA token is invalid or expired',
        });
      }

      if (!payload.mfa) {
        return reply.status(400).send({
          success: false,
          error: 'INVALID_MFA_TOKEN',
          code: '20102',
          message: 'Token is not an MFA challenge token',
        });
      }

      // Verify MFA code
      const result = await mfaService.verifyMfa(payload.userId, code);

      if (!result.success) {
        return reply.status(401).send({
          success: false,
          error: 'INVALID_MFA_CODE',
          code: '20102',
          message: 'Invalid MFA code',
          data: {
            remainingBackupCodes: result.remainingBackupCodes,
          },
        });
      }

      // Record successful login
      await loginAttemptService.recordSuccess(payload.userId);

      // Issue full access + refresh tokens
      const accessTokenPayload: Record<string, unknown> = {
        sub: payload.userId,
        username: payload.username,
        role: payload.role,
        roles: [payload.role],
      };
      if (payload.tenantId) {
        accessTokenPayload.tenant_id = payload.tenantId;
      }

      const accessToken = jwt.sign(accessTokenPayload, jwtSecret, { expiresIn: '5m' });
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await database.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, tenant_id) VALUES ($1, $2, $3, $4)',
        [payload.userId, refreshTokenHash, expiresAt, payload.tenantId || null],
      );

      return reply.send({
        success: true,
        data: {
          accessToken,
          refreshToken,
          expiresAt: Date.now() + 5 * 60 * 1000,
          tenantId: payload.tenantId || null,
          user: {
            id: payload.userId,
            username: payload.username,
            role: payload.role,
          },
          message: result.usedBackupCode ? 'Verified using backup code' : 'MFA verified successfully',
        },
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  /**
   * GET /api/v1/auth/mfa/status - Get current user's MFA status
   */
  app.get('/mfa/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'auth', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user as { userId: string };
      if (!user) {
        return handleError(reply, new OrionError('UNAUTHORIZED', ErrorCode.UNAUTHORIZED));
      }

      const status = await mfaService.getMfaStatus(user.userId);

      return reply.send({
        success: true,
        data: status,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  /**
   * POST /api/v1/auth/mfa/backup-codes/regenerate - Regenerate backup codes
   */
  app.post('/mfa/backup-codes/regenerate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'auth', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user as { userId: string };
      if (!user) {
        return handleError(reply, new OrionError('UNAUTHORIZED', ErrorCode.UNAUTHORIZED));
      }

      const backupCodes = await mfaService.regenerateBackupCodes(user.userId);

      return reply.send({
        success: true,
        data: { backupCodes },
        message: 'Backup codes regenerated. Save them in a secure location.',
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ============================================================
  // Password Reset
  // ============================================================

  /**
   * POST /api/v1/auth/password-reset/request - Request password reset via email
   * No authentication required
   */
  app.post('/password-reset/request', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email } = (request.body as PasswordResetRequestRequest['body']) || {};
      if (!email) {
        return reply.status(400).send({
          success: false,
          error: 'EMAIL_REQUIRED',
          code: '30102',
          message: 'Email is required',
        });
      }

      const result = await mfaService.generatePasswordResetToken(email);

      // Always return success to prevent email enumeration
      if (!result) {
        return reply.send({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
        });
      }

      return reply.send({
        success: true,
        data: { resetToken: result.resetToken, expiresAt: result.expiresAt },
        message: 'Password reset token generated. In production, this would be sent via email.',
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  /**
   * POST /api/v1/auth/password-reset/confirm - Confirm password reset with token
   * No authentication required
   */
  app.post('/password-reset/confirm', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token, newPassword } = (request.body as PasswordResetConfirmRequest['body']) || {};
      if (!token || !newPassword) {
        return reply.status(400).send({
          success: false,
          error: 'TOKEN_AND_PASSWORD_REQUIRED',
          code: '30102',
          message: 'Reset token and new password are required',
        });
      }

      if (newPassword.length < 8) {
        return reply.status(400).send({
          success: false,
          error: 'PASSWORD_TOO_SHORT',
          code: '30103',
          message: 'Password must be at least 8 characters',
        });
      }

      const newPasswordHash = await passwordService.hash(newPassword);
      await mfaService.resetPassword(token, newPasswordHash);

      return reply.send({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ============================================================
  // Login Attempt Lockout
  // ============================================================

  /**
   * GET /api/v1/auth/login-attempts/status - Get current user's lockout status
   */
  app.get('/login-attempts/status', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user as { userId: string };
      if (!user) {
        return handleError(reply, new OrionError('UNAUTHORIZED', ErrorCode.UNAUTHORIZED));
      }

      const isLocked = await loginAttemptService.isLocked(user.userId);
      const remainingLockTime = await loginAttemptService.getRemainingLockTime(user.userId);
      const failureCount = await loginAttemptService.getFailureCount(user.userId);

      return reply.send({
        success: true,
        data: {
          isLocked,
          remainingLockTimeMs: remainingLockTime,
          failureCount,
          maxAttempts: DEFAULT_LOGIN_ATTEMPT_CONFIG.maxAttempts,
        },
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  /**
   * POST /api/v1/auth/login-attempts/unlock - Unlock own account (via password reset)
   * or admin unlock
   */
  app.post('/login-attempts/unlock', {
    onRequest: [authenticateUser, requirePermission({ resource: 'auth', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = (request.body as UnlockAccountRequest['body']) || {};
      const currentUser = (request as any).user as { userId: string; role: string };

      if (!userId) {
        return handleError(reply, new ValidationError('USER_ID_REQUIRED'));
      }

      // Users can only unlock themselves unless they're admin
      if (userId !== currentUser.userId && currentUser.role !== 'admin') {
        return handleError(reply, new OrionError('FORBIDDEN', ErrorCode.FORBIDDEN));
      }

      await loginAttemptService.unlockAccount(userId);

      return reply.send({
        success: true,
        message: 'Account unlocked successfully',
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
