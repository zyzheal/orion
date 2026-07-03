/**
 * SSO Providers Management API Routes
 *
 * Provides CRUD endpoints for managing SSO provider configurations.
 * Supports dynamic addition/modification of authentication providers
 * without requiring service restart.
 *
 * Routes:
 *   GET    /api/v1/auth/sso/providers         - List all providers
 *   GET    /api/v1/auth/sso/providers/:name   - Get provider detail
 *   POST   /api/v1/auth/sso/providers         - Create provider (admin)
 *   PATCH  /api/v1/auth/sso/providers/:name   - Update provider (admin)
 *   DELETE /api/v1/auth/sso/providers/:name   - Delete provider (admin)
 *   POST   /api/v1/auth/sso/providers/:name/test - Test provider connection
 *
 * Requires:
 *   - authenticateUser middleware (all routes)
 *   - requirePermission({ resource: 'sso', action: 'write' }) for mutations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ConflictError, ErrorCode, handleError } from '../errors';

const logger = pino({ name: 'sso-providers-routes' });

interface SsoProviderConfig {
  id?: string;
  name: string;
  type: 'oidc' | 'ldap' | 'wechat' | 'cas' | 'saml';
  enabled: boolean;
  display_name: string;
  display_icon?: string;
  config: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

interface SsoRoutesOptions {
  database?: DatabasePool;
}

export default async function ssoProvidersRoutes(
  app: FastifyInstance,
  options: SsoRoutesOptions
): Promise<void> {
  const database = options.database;

  async function dbQuery(sql: string, params?: any[]): Promise<any> {
    if (!database) {
      logger.warn('[SsoProvidersRoutes] Database not available');
      return null;
    }
    return database.query(sql, params);
  }

  /**
   * GET /api/v1/auth/sso/providers - List all SSO providers
   */
  app.get('/providers', { onRequest: [authenticateUser] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await dbQuery(
        'SELECT id, name, type, enabled, display_name, display_icon, created_at, updated_at FROM sso_providers ORDER BY name'
      );

      return reply.send({
        success: true,
        data: result?.rows || [],
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'LIST_ERROR';
      return handleError(reply, new OrionError('LIST_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  /**
   * GET /api/v1/auth/sso/providers/:name - Get provider detail
   */
  app.get('/providers/:name', { onRequest: [authenticateUser] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name } = request.params as { name: string };
      const result = await dbQuery(
        'SELECT id, name, type, enabled, display_name, display_icon, config, created_at, updated_at FROM sso_providers WHERE name = $1',
        [name]
      );

      const provider = result?.rows?.[0];
      if (!provider) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }

      // Remove sensitive fields from response
      const safeConfig = { ...provider.config };
      delete safeConfig.client_secret;
      delete safeConfig.bind_password;
      delete safeConfig.corp_secret;

      return reply.send({
        success: true,
        data: { ...provider, config: safeConfig },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'GET_ERROR';
      return handleError(reply, new OrionError('GET_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  /**
   * POST /api/v1/auth/sso/providers - Create SSO provider
   */
  app.post(
    '/providers',
    { onRequest: [authenticateUser, requirePermission({ resource: 'sso', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as Partial<SsoProviderConfig>;
        const { name, type, enabled = true, display_name, display_icon, config = {} } = body;

        if (!name || !type) {
          return handleError(reply, new ValidationError('MISSING_FIELDS'));
        }

        const validTypes = ['oidc', 'ldap', 'wechat', 'cas', 'saml'];
        if (!validTypes.includes(type)) {
          return handleError(reply, new ValidationError('INVALID_TYPE'))
        }

        const existing = await dbQuery('SELECT id FROM sso_providers WHERE name = $1', [name]);
        if (existing?.rows?.length > 0) {
          return handleError(reply, new ConflictError('CONFLICT'));
        }

        await dbQuery(
          `INSERT INTO sso_providers (name, type, enabled, display_name, display_icon, config)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [name, type, enabled, display_name || name, display_icon || '', JSON.stringify(config)]
        );

        return reply.status(201).send({
          success: true,
          message: 'SSO provider created successfully',
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'CREATE_ERROR';
        return handleError(reply, new OrionError('CREATE_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  /**
   * PATCH /api/v1/auth/sso/providers/:name - Update SSO provider
   */
  app.patch(
    '/providers/:name',
    { onRequest: [authenticateUser, requirePermission({ resource: 'sso', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { name } = request.params as { name: string };
        const body = request.body as Partial<SsoProviderConfig>;

        const existing = await dbQuery('SELECT id FROM sso_providers WHERE name = $1', [name]);
        if (!existing?.rows?.length) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }

        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (body.enabled !== undefined) {
          updates.push(`enabled = $${paramIndex++}`);
          params.push(body.enabled);
        }
        if (body.display_name !== undefined) {
          updates.push(`display_name = $${paramIndex++}`);
          params.push(body.display_name);
        }
        if (body.display_icon !== undefined) {
          updates.push(`display_icon = $${paramIndex++}`);
          params.push(body.display_icon);
        }
        if (body.config !== undefined) {
          updates.push(`config = $${paramIndex++}`);
          params.push(JSON.stringify(body.config));
        }

        if (updates.length === 0) {
          return handleError(reply, new ValidationError('NO_UPDATES'));
        }

        updates.push(`updated_at = NOW()`);
        params.push(name);

        await dbQuery(
          `UPDATE sso_providers SET ${updates.join(', ')} WHERE name = $${paramIndex}`,
          params
        );

        return reply.send({
          success: true,
          message: 'SSO provider updated successfully',
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'UPDATE_ERROR';
        return handleError(reply, new OrionError('UPDATE_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  /**
   * DELETE /api/v1/auth/sso/providers/:name - Delete SSO provider
   */
  app.delete(
    '/providers/:name',
    { onRequest: [authenticateUser, requirePermission({ resource: 'sso', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { name } = request.params as { name: string };

        const result = await dbQuery('DELETE FROM sso_providers WHERE name = $1', [name]);
        if (result?.rowCount === 0) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }

        return reply.send({
          success: true,
          message: 'SSO provider deleted successfully',
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'DELETE_ERROR';
        return handleError(reply, new OrionError('DELETE_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  /**
   * POST /api/v1/auth/sso/providers/:name/test - Test provider connection
   */
  app.post(
    '/providers/:name/test',
    { onRequest: [authenticateUser, requirePermission({ resource: 'sso', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { name } = request.params as { name: string };

        const result = await dbQuery(
          'SELECT name, type, config FROM sso_providers WHERE name = $1',
          [name]
        );
        const provider = result?.rows?.[0];
        if (!provider) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }

        // Test connection based on provider type
        let testResult: { success: boolean; message: string };

        switch (provider.type) {
          case 'ldap': {
            const { LdapService } = await import('../services/auth/LdapService');
            const config = provider.config;
            const testService = new LdapService({
              enabled: true,
              url: config.url,
              bindDn: config.bind_dn,
              bindPassword: config.bind_password,
              baseDn: config.base_dn,
            });
            const result = await testService.testConnection();
            testResult = { success: result.success, message: result.message || '' };
            break;
          }
          case 'wechat': {
            const { WechatWorkService } = await import('../services/auth/WechatWorkService');
            const config = provider.config;
            const testService = new WechatWorkService({
              corpId: config.corp_id,
              agentId: config.agent_id,
              corpSecret: config.corp_secret,
              enabled: true,
            });
            const result = await testService.testConnection();
            testResult = { success: result.success, message: result.message || '' };
            break;
          }
          case 'oidc': {
            const { SsoService } = await import('../services/auth/SsoService');
            const config = provider.config;
            const testService = new SsoService();
            await testService.initialize({
              issuerUrl: config.issuer_url,
              clientId: config.client_id,
              clientSecret: config.client_secret,
              redirectUri: config.redirect_uri || '/api/v1/auth/sso/callback',
              scopes: config.scopes?.split(',') || ['openid', 'email', 'profile'],
              enabled: true,
            });
            testResult = testService.isConfigured()
              ? { success: true, message: 'OIDC provider configured successfully' }
              : { success: false, message: 'OIDC provider configuration failed' };
            break;
          }
          default:
            testResult = { success: false, message: `Unsupported provider type: ${provider.type}` };
        }

        return reply.send({
          success: true,
          data: testResult,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'TEST_ERROR';
        return handleError(reply, new OrionError('TEST_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}
