/**
 * Session Controller - Fastify HTTP request/response handlers
 *
 * Bridges HTTP layer to SessionService (PostgreSQL-backed)
 * Handles session creation, verification, and revocation.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SessionService, SessionServiceError } from '../../services/session/SessionService';

export class SessionController {
  private service: SessionService;

  constructor(service: SessionService) {
    this.service = service;
  }

  // ==================== Session Lifecycle ====================

  /**
   * POST /api/v1/sessions — Create a new session
   * Expects: { userId, tenantId, expiresInHours? }
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.userId || !body.tenantId) {
        await reply.status(400).send({
          success: false,
          error: 'userId and tenantId are required',
        });
        return;
      }
      const expiresInHours = body.expiresInHours
        ? parseInt(body.expiresInHours as string, 10)
        : 24;

      const { session, token } = await this.service.createSession(
        body.userId as string,
        body.tenantId as string,
        expiresInHours
      );

      await reply.status(201).send({
        success: true,
        data: {
          sessionId: session.id,
          userId: session.user_id,
          tenantId: session.tenant_id,
          token,
          expiresAt: session.expires_at,
          createdAt: session.created_at,
        },
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create session',
      });
    }
  }

  /**
   * POST /api/v1/sessions/verify — Verify a session token
   * Expects: { token }
   */
  async verify(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.token) {
        await reply.status(400).send({
          success: false,
          error: 'token is required',
        });
        return;
      }
      const session = await this.service.verifyToken(body.token as string);
      if (!session) {
        await reply.status(401).send({
          success: false,
          error: 'Invalid or expired session',
        });
        return;
      }
      await reply.send({
        success: true,
        data: {
          sessionId: session.id,
          userId: session.user_id,
          tenantId: session.tenant_id,
          expiresAt: session.expires_at,
        },
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to verify session',
      });
    }
  }

  /**
   * DELETE /api/v1/sessions/:token — Revoke a session
   */
  async revoke(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const revoked = await this.service.revokeSession(params.token);
      if (!revoked) {
        await reply.status(404).send({
          success: false,
          error: 'Session not found',
        });
        return;
      }
      await reply.send({ success: true, message: 'Session revoked' });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to revoke session',
      });
    }
  }

  /**
   * POST /api/v1/sessions/cleanup — Clean up expired sessions (admin)
   */
  async cleanup(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const cleaned = await this.service.cleanup();
      await reply.send({
        success: true,
        data: { cleanedSessions: cleaned },
        message: `${cleaned} expired sessions removed`,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to cleanup sessions',
      });
    }
  }

  /**
   * GET /api/v1/sessions/user/:userId — List user sessions
   */
  async listByUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const query = request.query as Record<string, string>;
      const sessions = await this.service.listByUser(params.userId, query.tenantId);
      return reply.send({
        success: true,
        data: sessions.map(s => ({
          sessionId: s.id,
          userId: s.user_id,
          tenantId: s.tenant_id,
          expiresAt: s.expires_at,
          createdAt: s.created_at,
        })),
      });
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list sessions',
      });
    }
  }

  /**
   * POST /api/v1/sessions/:token/refresh — Refresh session token
   */
  async refreshToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const extendHours = body.extendHours ? parseInt(body.extendHours as string, 10) : 24;
      const session = await this.service.refreshToken(params.token, extendHours);
      if (!session) {
        return reply.status(404).send({ success: false, error: 'Session not found' });
      }
      return reply.send({
        success: true,
        data: { sessionId: session.id, expiresAt: session.expires_at },
      });
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to refresh session',
      });
    }
  }
}
