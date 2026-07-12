/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/page-registry/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * PageRegistry Routes - API for Page Registry Configuration Management
 *
 * Provides RESTful endpoints for managing page routing configurations
 * stored in the page_registry table.
 * Pattern: Follows subapp-routes.ts
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PageRegistryService } from '../services/page-registry/PageRegistryService';
import { createLogger } from '../utils/logger';
import { OrionError, ErrorCode, ValidationError, NotFoundError, ConflictError, handleError } from '../errors';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

const logger = createLogger('page-registry-routes');

export interface PageRegistryRouteOptions {
  database?: DatabasePool;
}

interface PagePathParams {
  path: string;
}

interface CreatePageBody {
  path: string;
  component: string;
  protected?: boolean;
  permission?: Record<string, any>;
  hideLayout?: boolean;
  microApp?: boolean;
  subAppKey?: string;
  menuKey?: string;
  menuLabel?: string;
  menuIcon?: string;
  hidden?: boolean;
  redirectTo?: string;
  title?: string;
  breadcrumb?: boolean;
  sortOrder?: number;
  status?: 'enabled' | 'disabled';
  tenantId?: string;
}

interface UpdatePageBody {
  path?: string;
  component?: string;
  protected?: boolean;
  permission?: Record<string, any>;
  hideLayout?: boolean;
  microApp?: boolean;
  subAppKey?: string | null;
  menuKey?: string | null;
  menuLabel?: string | null;
  menuIcon?: string | null;
  hidden?: boolean;
  redirectTo?: string | null;
  title?: string | null;
  breadcrumb?: boolean;
  sortOrder?: number;
  status?: 'enabled' | 'disabled';
}

export default async function pageRegistryRoutes(app: FastifyInstance, options: PageRegistryRouteOptions = {}): Promise<void> {
  const database = options.database;

  /**
   * Helper to get service instance
   */
  function getService(): PageRegistryService {
    if (!database) {
      throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    }
    return new PageRegistryService(database);
  }

  /**
   * Helper to get tenant ID from request
   */
  function getTenantId(request: FastifyRequest): string | undefined {
    const ctx = request as any;
    return ctx.tenantId || ctx.tenant_id || '00000000-0000-0000-0000-000000000000';
  }

  /**
   * GET /api/v1/page-registry - Get all page entries
   */
  // P0-A: 全局认证守卫（所有操作均需登录）
  app.addHook('onRequest', authenticateUser);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const service = getService();
      const tenantId = getTenantId(request);
      const entries = await service.getAll(tenantId);

      return reply.send({
        success: true,
        data: entries,
        total: entries.length,
      });
    } catch (error: any) {
      logger.error('[PageRegistryRoutes] Failed to get page entries:', error);
      return handleError(reply, new OrionError('Internal server error', ErrorCode.INTERNAL_ERROR), request);
    }
  });

  /**
   * GET /api/v1/page-registry/enabled - Get enabled page entries only
   */
  app.get('/enabled', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const service = getService();
      const tenantId = getTenantId(request);
      const entries = await service.getEnabled(tenantId);

      return reply.send({
        success: true,
        data: entries,
      });
    } catch (error: any) {
      logger.error('[PageRegistryRoutes] Failed to get enabled page entries:', error);
      return handleError(reply, new OrionError('Internal server error', ErrorCode.INTERNAL_ERROR), request);
    }
  });

  /**
   * GET /api/v1/page-registry/:path - Get single page entry
   */
  app.get('/:path', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { path } = request.params as { path: string };
      const service = getService();
      const tenantId = getTenantId(request);
      const entry = await service.getByPath(path, tenantId);

      if (!entry) {
        return handleError(reply, new NotFoundError('Page entry', path), request);
      }

      return reply.send({
        success: true,
        data: entry,
      });
    } catch (error: any) {
      logger.error('[PageRegistryRoutes] Failed to get page entry:', error);
      return handleError(reply, new OrionError('Internal server error', ErrorCode.INTERNAL_ERROR), request);
    }
  });

  /**
   * POST /api/v1/page-registry - Create new page entry
   */
  app.post('/', {
    onRequest: [requirePermission({ resource: 'page-registry', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as any) || {};
      const tenantId = body.tenantId || getTenantId(request);

      // Validate required fields
      if (!body.path || !body.component) {
        return handleError(reply, new ValidationError('Path and component are required'), request);
      }

      const service = getService();
      const entry = await service.create({
        path: body.path,
        component: body.component,
        protected: body.protected,
        permission: body.permission,
        hideLayout: body.hideLayout,
        microApp: body.microApp,
        subAppKey: body.subAppKey,
        menuKey: body.menuKey,
        menuLabel: body.menuLabel,
        menuIcon: body.menuIcon,
        hidden: body.hidden,
        redirectTo: body.redirectTo,
        title: body.title,
        breadcrumb: body.breadcrumb,
        sortOrder: body.sortOrder,
        status: body.status,
        tenantId,
      });

      return reply.status(201).send({
        success: true,
        data: entry,
        message: 'Page entry created successfully',
      });
    } catch (error: any) {
      logger.error('[PageRegistryRoutes] Failed to create page entry:', error);

      if (error instanceof ConflictError) {
        return handleError(reply, error, request);
      }

      return handleError(reply, new OrionError('Internal server error', ErrorCode.INTERNAL_ERROR), request);
    }
  });

  /**
   * PUT /api/v1/page-registry/:path - Update page entry
   */
  app.put('/:path', {
    onRequest: [requirePermission({ resource: 'page-registry', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { path } = request.params as { path: string };
      const body = (request.body as any) || {};
      const tenantId = getTenantId(request);

      const service = getService();
      const entry = await service.update(path, {
        path: body.path,
        component: body.component,
        protected: body.protected,
        permission: body.permission,
        hideLayout: body.hideLayout,
        microApp: body.microApp,
        subAppKey: body.subAppKey,
        menuKey: body.menuKey,
        menuLabel: body.menuLabel,
        menuIcon: body.menuIcon,
        hidden: body.hidden,
        redirectTo: body.redirectTo,
        title: body.title,
        breadcrumb: body.breadcrumb,
        sortOrder: body.sortOrder,
        status: body.status,
      }, undefined, tenantId);

      return reply.send({
        success: true,
        data: entry,
        message: 'Page entry updated successfully',
      });
    } catch (error: any) {
      logger.error('[PageRegistryRoutes] Failed to update page entry:', error);

      if (error instanceof NotFoundError) {
        return handleError(reply, error, request);
      }

      if (error instanceof ConflictError) {
        return handleError(reply, error, request);
      }

      return handleError(reply, new OrionError('Internal server error', ErrorCode.INTERNAL_ERROR), request);
    }
  });

  /**
   * DELETE /api/v1/page-registry/:path - Delete page entry
   */
  app.delete('/:path', {
    onRequest: [requirePermission({ resource: 'page-registry', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { path } = request.params as { path: string };
      const tenantId = getTenantId(request);

      const service = getService();
      await service.delete(path, undefined, tenantId);

      return reply.send({
        success: true,
        message: 'Page entry deleted successfully',
      });
    } catch (error: any) {
      logger.error('[PageRegistryRoutes] Failed to delete page entry:', error);

      if (error instanceof NotFoundError) {
        return handleError(reply, error, request);
      }

      return handleError(reply, new OrionError('Internal server error', ErrorCode.INTERNAL_ERROR), request);
    }
  });

  /**
   * PUT /api/v1/page-registry/:path/status - Toggle page status
   */
  app.put('/:path/status', {
    onRequest: [requirePermission({ resource: 'page-registry', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { path } = request.params as { path: string };
      const tenantId = getTenantId(request);

      const service = getService();
      const entry = await service.toggleStatus(path, undefined, tenantId);

      return reply.send({
        success: true,
        data: entry,
        message: `Page ${entry.status === 'enabled' ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error: any) {
      logger.error('[PageRegistryRoutes] Failed to toggle page status:', error);

      if (error instanceof NotFoundError) {
        return handleError(reply, error, request);
      }

      return handleError(reply, new OrionError('Internal server error', ErrorCode.INTERNAL_ERROR), request);
    }
  });

  /**
   * GET /api/v1/page-registry/:path/history - Get page entry history
   */
  app.get('/:path/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { path } = request.params as { path: string };
      const tenantId = getTenantId(request);

      const service = getService();
      const history = await service.getHistory(path, tenantId);

      return reply.send({
        success: true,
        data: history,
        total: history.length,
      });
    } catch (error: any) {
      logger.error('[PageRegistryRoutes] Failed to get page entry history:', error);
      return handleError(reply, new OrionError('Internal server error', ErrorCode.INTERNAL_ERROR), request);
    }
  });
}