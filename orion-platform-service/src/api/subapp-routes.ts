/**
 * SubApp Routes - API for SubApp Configuration Management
 *
 * Provides RESTful endpoints for managing sub-application configurations
 * to enable page-based management without code changes.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SubAppService } from '../services/subapp';
import { DatabasePool } from '../services/database';
import { createLogger } from '../utils/logger';
import { OrionError, ErrorCode , ValidationError, NotFoundError, ConflictError, handleError} from '../errors';

const logger = pino({ name: 'subapp-routes' });

export interface SubAppRouteOptions {
  database?: DatabasePool;
}

interface SubAppParams {
  key: string;
}

interface CreateBody {
  name: string;
  key: string;
  version?: string;
  entry_dev: string;
  entry_prod: string;
  routes: string[];
  permissions?: string[];
  keep_alive?: boolean;
  preload?: boolean;
  description?: string;
  icon?: string;
  api_domain?: string;
}

interface UpdateBody {
  name?: string;
  version?: string;
  entry_dev?: string;
  entry_prod?: string;
  routes?: string[];
  permissions?: string[];
  keep_alive?: boolean;
  preload?: boolean;
  description?: string;
  icon?: string;
  api_domain?: string;
  status?: 'enabled' | 'disabled';
  sort_order?: number;
}

export default async function subappRoutes(app: FastifyInstance, options: SubAppRouteOptions = {}): Promise<void> {
  const database = options.database;

  /**
   * Helper to get service instance
   */
  function getService(): SubAppService {
    if (!database) {
      throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    }
    return new SubAppService(database);
  }

  /**
   * Helper to get current user ID from request
   */
  function getUserId(request: FastifyRequest): string | undefined {
    // Try to get user from JWT token or session
    const user = (request as any).user;
    return user?.userId || user?.id;
  }

  /**
   * GET /api/v1/subapps - Get all sub-app configurations
   */
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const service = getService();
      const apps = await service.getAll();

      return reply.send({
        success: true,
        data: apps,
        total: apps.length,
      });
    } catch (error: any) {
      logger.error('[SubAppRoutes] Failed to get subapps:', error);
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * GET /api/v1/subapps/enabled - Get enabled sub-apps only
   */
  app.get('/enabled', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const service = getService();
      const apps = await service.getEnabled();

      return reply.send({
        success: true,
        data: apps,
      });
    } catch (error: any) {
      logger.error('[SubAppRoutes] Failed to get enabled subapps:', error);
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * GET /api/v1/subapps/:key - Get single sub-app config
   */
  app.get('/:key', async (request: FastifyRequest<{ Params: SubAppParams }>, reply: FastifyReply) => {
    try {
      const { key } = request.params;
      const service = getService();
      const app = await service.getByKey(key);

      if (!app) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
      }

      return reply.send({
        success: true,
        data: app,
      });
    } catch (error: any) {
      logger.error('[SubAppRoutes] Failed to get subapp:', error);
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * POST /api/v1/subapps - Create new sub-app
   */
  app.post('/', async (request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) => {
    try {
      const body = request.body || {};
      const userId = getUserId(request);

      // Validate required fields
      if (!body.name || !body.key || !body.entry_dev || !body.entry_prod || !body.routes) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      const service = getService();
      const app = await service.create({
        name: body.name,
        key: body.key,
        version: body.version,
        entry_dev: body.entry_dev,
        entry_prod: body.entry_prod,
        routes: body.routes,
        permissions: body.permissions,
        keep_alive: body.keep_alive,
        preload: body.preload,
        description: body.description,
        icon: body.icon,
        api_domain: body.api_domain,
      }, userId);

      return reply.status(201).send({
        success: true,
        data: app,
        message: 'Sub-app created successfully',
      });
    } catch (error: any) {
      logger.error('[SubAppRoutes] Failed to create subapp:', error);

      if (error.message.includes('already exists')) {
        return handleError(reply, new ConflictError('CONFLICT'))
      }

      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * PUT /api/v1/subapps/:key - Update sub-app config
   */
  app.put('/:key', async (request: FastifyRequest<{ Params: SubAppParams; Body: UpdateBody }>, reply: FastifyReply) => {
    try {
      const { key } = request.params;
      const body = request.body || {};
      const userId = getUserId(request);

      const service = getService();
      const app = await service.update(key, {
        name: body.name,
        version: body.version,
        entry_dev: body.entry_dev,
        entry_prod: body.entry_prod,
        routes: body.routes,
        permissions: body.permissions,
        keep_alive: body.keep_alive,
        preload: body.preload,
        description: body.description,
        icon: body.icon,
        api_domain: body.api_domain,
        status: body.status,
        sort_order: body.sort_order,
      }, userId);

      return reply.send({
        success: true,
        data: app,
        message: 'Sub-app updated successfully',
      });
    } catch (error: any) {
      logger.error('[SubAppRoutes] Failed to update subapp:', error);

      if (error.message.includes('not found')) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
      }

      if (error.message.includes('Cannot change')) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * PUT /api/v1/subapps/:key/status - Toggle sub-app status
   */
  app.put('/:key/status', async (request: FastifyRequest<{ Params: SubAppParams }>, reply: FastifyReply) => {
    try {
      const { key } = request.params;
      const userId = getUserId(request);

      const service = getService();
      const app = await service.toggleStatus(key, userId);

      return reply.send({
        success: true,
        data: app,
        message: `Sub-app ${app.status === 'enabled' ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error: any) {
      logger.error('[SubAppRoutes] Failed to toggle status:', error);

      if (error.message.includes('not found')) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
      }

      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * DELETE /api/v1/subapps/:key - Delete sub-app config
   */
  app.delete('/:key', async (request: FastifyRequest<{ Params: SubAppParams }>, reply: FastifyReply) => {
    try {
      const { key } = request.params;
      const userId = getUserId(request);

      const service = getService();
      await service.delete(key, userId);

      return reply.send({
        success: true,
        message: 'Sub-app deleted successfully',
      });
    } catch (error: any) {
      logger.error('[SubAppRoutes] Failed to delete subapp:', error);

      if (error.message.includes('not found')) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
      }

      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  /**
   * GET /api/v1/subapps/:key/history - Get config history
   */
  app.get('/:key/history', async (request: FastifyRequest<{ Params: SubAppParams }>, reply: FastifyReply) => {
    try {
      const { key } = request.params;
      const service = getService();
      const history = await service.getHistory(key);

      return reply.send({
        success: true,
        data: history,
        total: history.length,
      });
    } catch (error: any) {
      logger.error('[SubAppRoutes] Failed to get history:', error);
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });
}