/**
 * Integration API Routes
 *
 * Routes under /api/v1/integration
 *
 * Provides CRUD for integrations, connector registry, connection testing, and mapping management
 * via IntegrationService and ConnectorRegistry.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { IntegrationService } from '../services/integration/IntegrationService';

import { DatabasePool } from '../services/database';
import { getCurrentTenantId } from '../db/tenant-context-storage';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';


interface IntegrationRoutesOptions {
  database?: DatabasePool;
}

export default async function integrationRoutes(
  app: FastifyInstance,
  options: IntegrationRoutesOptions = {}
): Promise<void> {
  const db = options.database;
  const integrationService = new IntegrationService(db);

  // ==================== Integration CRUD ====================

  /**
   * POST /integration - Create a new integration
   */
  app.post('/', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'integration', action: 'create' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      if (!body.provider || !body.name || !body.config) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'provider, name, and config are required');
      }

      const integration = await integrationService.createIntegration({
        tenantId: (body.tenantId as string) || getCurrentTenantId(),
        provider: body.provider as string,
        name: body.name as string,
        config: body.config as any,
        createdBy: body.createdBy as string,
      });

      return created(reply, request, { integration });
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Failed to create integration');
    }
  });

  /**
   * GET /integration - List integrations for a tenant
   */
  app.get('/', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId || getCurrentTenantId();
    const provider = query.provider;

    const integrations = await integrationService.listIntegrations(tenantId, provider);
    return success(reply, request, { integrations, total: integrations.length });
  });

  /**
   * GET /integration/connectors - List registered connectors
   */
  app.get('/connectors', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const connectors = integrationService.listConnectors();
    const providers = integrationService.listAvailableProviders();
    return success(reply, request, { connectors, providers });
  });

  /**
   * GET /integration/:id - Get integration by ID
   */
  app.get('/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const integration = await integrationService.getIntegration(id);

    if (!integration) {
      return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, `Integration ${id} not found`);
    }

    return success(reply, request, { integration });
  });

  /**
   * PUT /integration/:id - Update an integration
   */
  app.put('/:id', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'integration', action: 'update' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    try {
      const integration = await integrationService.updateIntegration(id, {
        name: body.name as string | undefined,
        config: body.config as any,
        status: body.status as any,
      });

      return success(reply, request, { integration });
    } catch (error) {
      return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, error instanceof Error ? error.message : 'Integration not found');
    }
  });

  /**
   * DELETE /integration/:id - Delete an integration
   */
  app.delete('/:id', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'integration', action: 'delete' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      await integrationService.deleteIntegration(id);
      return success(reply, request, { deleted: true });
    } catch (error) {
      return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, error instanceof Error ? error.message : 'Integration not found');
    }
  });

  // ==================== Connection & Actions ====================

  /**
   * POST /integration/:id/test - Test connection for an integration
   */
  app.post('/:id/test', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await integrationService.testConnection(id);
      return success(reply, request, { connected: result });
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Connection test failed');
    }
  });

  /**
   * POST /integration/:id/execute - Execute a connector action
   */
  app.post('/:id/execute', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'integration', action: 'execute' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    try {
      if (!body.action) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'action is required');
      }

      const result = await integrationService.executeConnectorAction(
        id,
        body.action as string,
        (body.params as Record<string, unknown>) || {}
      );

      return success(reply, request, { result });
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Action execution failed');
    }
  });

  // ==================== Mappings ====================

  /**
   * POST /integration/:id/mappings - Create a resource mapping
   */
  app.post('/:id/mappings', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    try {
      if (!body.resourceType || !body.resourceId || !body.externalId) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'resourceType, resourceId, and externalId are required');
      }

      const mapping = await integrationService.createMapping({
        integrationId: id,
        resourceType: body.resourceType as string,
        resourceId: body.resourceId as string,
        externalId: body.externalId as string,
        metadata: body.metadata as Record<string, unknown>,
      });

      return created(reply, request, { mapping });
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Failed to create mapping');
    }
  });

  /**
   * GET /integration/:id/mappings - Get mappings by resource
   */
  app.get('/:id/mappings', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string>;

    if (query.resourceType && query.resourceId) {
      const mapping = await integrationService.getMappingsByResource(
        id,
        query.resourceType,
        query.resourceId
      );
      return success(reply, request, { mapping });
    }

    if (query.externalId) {
      const mapping = await integrationService.getMappingByExternalId(id, query.externalId);
      return success(reply, request, { mapping });
    }

    return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'resourceType+resourceId or externalId is required');
  });
}
