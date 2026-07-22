/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/handler-registry/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Handler Registry API Routes
 *
 * 管理 Handler SPI 注册表
 * Prefix: /api/v1/handlers
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError, conflict } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { HandlerRegistry } from '../services/handler-registry/HandlerRegistry';
import { DatabasePool } from '../services/database';

interface HandlerRegistryRoutesOptions {
  database?: DatabasePool;
  handlerRegistry?: HandlerRegistry;
}

export default async function handlerRegistryRoutes(
  app: FastifyInstance,
  options: HandlerRegistryRoutesOptions = {},
): Promise<void> {
  const registry = options.handlerRegistry;
  if (!registry) return;

  // ==================== GET /handlers - 列出所有 Handler ====================
  app.get(
    '/',
    { preHandler: [authenticateUser, requirePermission({ resource: 'handler', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { domain?: string; status?: string };
      const handlers = await registry.list({
        domain: query.domain,
        status: query.status as any,
      });
      return success(reply, request, { handlers, total: handlers.length });
    },
  );

  // ==================== GET /handlers/health - 健康检查 ====================
  app.get(
    '/health',
    { preHandler: [authenticateUser, requirePermission({ resource: 'handler', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const health = await registry.healthCheck();
      return success(reply, request, health);
    },
  );

  // ==================== GET /handlers/domains - 获取域名列表 ====================
  app.get(
    '/domains',
    { preHandler: [authenticateUser, requirePermission({ resource: 'handler', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const domains = registry.getDomains();
      return success(reply, request, { domains, total: domains.length });
    },
  );

  // ==================== GET /handlers/:domain/:name - 获取单个 Handler 详情 ====================
  app.get(
    '/:domain/:name',
    { preHandler: [authenticateUser, requirePermission({ resource: 'handler', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { domain, name } = request.params as { domain: string; name: string };
      const entry = registry.getEntry(domain, name);
      if (!entry) {
        return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, `Handler ${domain}/${name} not found`);
      }
      return success(reply, request, entry);
    },
  );

  // ==================== POST /handlers/register - 注册 Handler ====================
  app.post(
    '/register',
    { preHandler: [authenticateUser, requirePermission({ resource: 'handler', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        domain: string;
        name: string;
        displayName?: string;
        description?: string;
        config?: Record<string, unknown>;
      };

      if (!body.domain || !body.name) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'domain and name are required');
      }

      const existing = registry.getEntry(body.domain, body.name);
      if (existing) {
        return conflict(reply, request, ErrorCodes.CLIENT_CONFLICT, `Handler ${body.domain}/${body.name} already exists`);
      }

      try {
        await registry.registerMetadata(body.domain, body.name, {
          displayName: body.displayName,
          description: body.description,
          config: body.config,
          registeredBy: 'api',
        });
        return created(reply, request, { domain: body.domain, name: body.name, status: 'active' });
      } catch (error) {
        return internalError(reply, request, error instanceof Error ? error.message : 'Registration failed');
      }
    },
  );

  // ==================== POST /handlers/:domain/:name/enable - 启用 ====================
  app.post(
    '/:domain/:name/enable',
    { preHandler: [authenticateUser, requirePermission({ resource: 'handler', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { domain, name } = request.params as { domain: string; name: string };
      try {
        await registry.enable(domain, name);
        return success(reply, request, { domain, name, status: 'active' });
      } catch (error) {
        return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, `Handler ${domain}/${name} not found`);
      }
    },
  );

  // ==================== POST /handlers/:domain/:name/disable - 禁用 ====================
  app.post(
    '/:domain/:name/disable',
    { preHandler: [authenticateUser, requirePermission({ resource: 'handler', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { domain, name } = request.params as { domain: string; name: string };
      try {
        await registry.disable(domain, name);
        return success(reply, request, { domain, name, status: 'disabled' });
      } catch (error) {
        return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, `Handler ${domain}/${name} not found`);
      }
    },
  );

  // ==================== DELETE /handlers/:domain/:name - 注销 ====================
  app.delete(
    '/:domain/:name',
    { preHandler: [authenticateUser, requirePermission({ resource: 'handler', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { domain, name } = request.params as { domain: string; name: string };
      try {
        await registry.unregister(domain, name);
        return success(reply, request, { domain, name, status: 'removed' });
      } catch (error) {
        return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, `Handler ${domain}/${name} not found`);
      }
    },
  );

  // ==================== POST /handlers/:domain/:name/invoke - 测试调用 ====================
  app.post(
    '/:domain/:name/invoke',
    { preHandler: [authenticateUser, requirePermission({ resource: 'handler', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { domain, name } = request.params as { domain: string; name: string };
      const body = request.body as { payload: Record<string, unknown> };

      try {
        const result = await registry.invoke(domain, name, body.payload || {});
        return success(reply, request, { domain, name, result, invokedAt: new Date().toISOString() });
      } catch (error) {
        return internalError(reply, request, error instanceof Error ? error.message : 'Invocation failed');
      }
    },
  );
}