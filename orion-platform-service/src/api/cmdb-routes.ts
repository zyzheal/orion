/**
 * CMDB API Routes
 *
 * Routes under /api/v1/cmdb
 * Handles Configuration Item (CI) CRUD, relations, versions, and topology
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { CmdbService } from '../services/cmdb/CmdbService';
import { TopologyService } from '../services/cmdb/TopologyService';
import { DatabasePool } from '../services/database';
import { CmdbIntegrationService } from '../services/cmdb-integration-service';
import { CmdbIntegrationController } from './controllers/CmdbIntegrationController';
import { CITypeService } from '../services/cmdb/ci-type/CITypeService';
import { CITypeRepository } from '../services/cmdb/ci-type/CITypeRepository';
import { CIAttributeRepository } from '../services/cmdb/ci-type/CIAttributeRepository';
import { CITypeVersionRepository } from '../services/cmdb/ci-type/CITypeVersionRepository';
import { OrionError, ValidationError, NotFoundError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

interface CmdbRoutesOptions {
  database?: DatabasePool;
}

export default async function cmdbRoutes(
  app: FastifyInstance,
  options?: CmdbRoutesOptions
): Promise<void> {
  // Initialize services
  const ciTypeService = options?.database
    ? new CITypeService(
        new CITypeRepository(options.database),
        new CIAttributeRepository(options.database),
        new CITypeVersionRepository(options.database),
      )
    : undefined;
  const cmdbService = new CmdbService({
    database: options?.database,
    ciTypeService,
  });
  const topologyService = new TopologyService(cmdbService);

  // Initialize integration controller
  const integrationService = options?.database
    ? new CmdbIntegrationService({ cmdbService })
    : undefined;
  const integrationController = integrationService
    ? new CmdbIntegrationController(integrationService)
    : undefined;

  // ==================== CI CRUD ====================

  // Create CI
  app.post('/cmdb/cis', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    try {
      const ci = await cmdbService.createCI({
        ciId: body.ciId,
        name: body.name,
        ciType: body.ciType,
        status: body.status || 'active',
        description: body.description,
        tenantId: BigInt(body.tenantId || 1),
        createdBy: 'system',
      });
      return reply.status(201).send({ success: true, data: ci });
    } catch (error: any) {
      handleError(reply, new ValidationError('CREATE_ERROR'));
    }
  });

  // Get CI by ID
  app.get('/cmdb/cis/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    try {
      const ci = await cmdbService.getCI(params.id);
      if (!ci) {
        handleError(reply, new NotFoundError('NOT_FOUND'));
        return;
      }
      return reply.send({ success: true, data: ci });
    } catch (error: any) {
      handleError(reply, new OrionError('FETCH_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Get CI by CI ID (business key)
  app.get('/cmdb/cis/by-id/:ciId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const query = request.query as any;
    try {
      const ci = await cmdbService.getCIByCiId(params.ciId, query.tenantId ? BigInt(query.tenantId) : undefined);
      if (!ci) {
        handleError(reply, new NotFoundError('NOT_FOUND'));
        return;
      }
      return reply.send({ success: true, data: ci });
    } catch (error: any) {
      handleError(reply, new OrionError('FETCH_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Update CI
  app.put('/cmdb/cis/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    try {
      const ci = await cmdbService.updateCI(params.id, body, body.user || 'system');
      if (!ci) {
        handleError(reply, new NotFoundError('NOT_FOUND'));
        return;
      }
      return reply.send({ success: true, data: ci });
    } catch (error: any) {
      handleError(reply, new ValidationError('UPDATE_ERROR'));
    }
  });

  // Delete CI
  app.delete('/cmdb/cis/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    try {
      const deleted = await cmdbService.deleteCI(params.id);
      if (!deleted) {
        handleError(reply, new NotFoundError('NOT_FOUND'));
        return;
      }
      return reply.send({ success: true, message: 'CI deleted' });
    } catch (error: any) {
      handleError(reply, new OrionError('DELETE_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // List CIs - returns array directly for easier frontend consumption
  app.get('/cmdb/cis', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    try {
      const result = await cmdbService.listCIs({
        ciType: query.ciType,
        status: query.status,
        tenantId: BigInt(query.tenantId || 1),
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      } as any);
      // Flatten: return data array directly, with pagination as separate field
      return reply.send({
        success: true,
        data: result.data || [],
        total: result.total || 0,
        page: (result as any).page || 1,
        pageSize: (result as any).pageSize || result.limit || 20,
      });
    } catch (error: any) {
      handleError(reply, new OrionError('LIST_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Batch Operations (Task 4.15) ====================

  // Batch create CIs
  app.post('/cmdb/batch-create', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    try {
      const tenantId = body.tenantId ? BigInt(body.tenantId) : BigInt(1);
      const result = await cmdbService.batchCreateCIs(
        body.items || [],
        tenantId,
        body.createdBy || 'system'
      );
      return reply.status(201).send({ success: true, ...result });
    } catch (error: any) {
      handleError(reply, new ValidationError('BATCH_CREATE_ERROR'));
    }
  });

  // Batch update CIs
  app.put('/cmdb/batch-update', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    try {
      const tenantId = body.tenantId ? BigInt(body.tenantId) : BigInt(1);
      const result = await cmdbService.batchUpdateCIs(
        body.items || [],
        tenantId,
        body.user || 'system'
      );
      return reply.send({ success: true, ...result });
    } catch (error: any) {
      handleError(reply, new ValidationError('BATCH_UPDATE_ERROR'));
    }
  });

  // Batch delete CIs
  app.delete('/cmdb/batch-delete', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    try {
      const tenantId = body.tenantId ? BigInt(body.tenantId) : BigInt(1);
      const result = await cmdbService.batchDeleteCIs(
        body.items || [],
        tenantId
      );
      return reply.send({ success: true, ...result });
    } catch (error: any) {
      handleError(reply, new OrionError('BATCH_DELETE_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Batch query CIs with complex filters
  app.post('/cmdb/ci/query', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    try {
      const tenantId = body.tenantId ? BigInt(body.tenantId) : BigInt(1);
      const result = await cmdbService.batchQueryCIs({
        ciType: body.ciType,
        status: body.status,
        environment: body.environment,
        tags: body.tags,
        search: body.search,
        tenantId,
        limit: body.limit ? parseInt(body.limit) : 20,
        offset: body.offset ? parseInt(body.offset) : 0,
        orderBy: body.orderBy || 'createdAt',
        order: body.order || 'DESC',
      } as any);
      return reply.send({
        success: true,
        data: result.data || [],
        total: result.total || 0,
        page: (result as any).page || 1,
        pageSize: (result as any).pageSize || result.limit || 20,
      });
    } catch (error: any) {
      handleError(reply, new OrionError('QUERY_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Export single CI by ciId or internal id
  app.get('/cmdb/ci/export/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const query = request.query as any;
    try {
      const tenantId = query.tenantId ? BigInt(query.tenantId) : BigInt(1);
      const ci = await cmdbService.exportCI(params.id, tenantId);
      if (!ci) {
        handleError(reply, new NotFoundError('NOT_FOUND'));
        return;
      }
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="ci-${ci.ciId}-${Date.now()}.json"`);
      return reply.send({ success: true, data: ci });
    } catch (error: any) {
      handleError(reply, new OrionError('EXPORT_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Import / Export (Task 4.16) ====================

  // Import CIs from JSON
  app.post('/cmdb/import', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    try {
      const tenantId = body.tenantId ? BigInt(body.tenantId) : BigInt(1);
      const result = await cmdbService.importCIs(
        body.cis || [],
        tenantId,
        body.skipDuplicates || false,
        body.createdBy || 'system'
      );
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      handleError(reply, new ValidationError('IMPORT_ERROR'));
    }
  });

  // Export CIs as JSON
  app.get('/cmdb/export', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    try {
      const tenantId = query.tenantId ? BigInt(query.tenantId) : BigInt(1);
      const result = await cmdbService.exportCIs({
        ciType: query.ciType,
        status: query.status,
        environment: query.environment,
        tenantId,
        search: query.search,
        includeArchived: query.includeArchived === 'true',
      });

      // Set JSON content type for download
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="cmdb-export-${tenantId}-${Date.now()}.json"`);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      handleError(reply, new OrionError('EXPORT_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== CI Relations ====================

  // Get CI relations
  app.get('/cmdb/cis/:ciId/relations', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    try {
      const relations = await cmdbService.getCIRelations(params.ciId);
      return reply.send({ success: true, data: relations });
    } catch (error: any) {
      handleError(reply, new OrionError('FETCH_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Create relation
  app.post('/cmdb/relations', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    try {
      const relation = await cmdbService.createRelation(
        {
          fromCiId: body.fromCiId,
          toCiId: body.toCiId,
          relationType: body.relationType,
          description: body.description,
        },
        body.user || 'system',
        body.tenantId ? BigInt(body.tenantId) : undefined
      );
      return reply.status(201).send({ success: true, data: relation });
    } catch (error: any) {
      handleError(reply, new ValidationError('CREATE_ERROR'));
    }
  });

  // Delete relation
  app.delete('/cmdb/relations/:relationId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    try {
      const deleted = await cmdbService.deleteRelation(params.relationId);
      if (!deleted) {
        handleError(reply, new NotFoundError('NOT_FOUND'));
        return;
      }
      return reply.send({ success: true, message: 'Relation deleted' });
    } catch (error: any) {
      handleError(reply, new OrionError('DELETE_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== CI Versions ====================

  // Get CI versions
  app.get('/cmdb/cis/:ciId/versions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    try {
      const versions = await cmdbService.getVersions(params.ciId);
      return reply.send({ success: true, data: versions });
    } catch (error: any) {
      handleError(reply, new OrionError('FETCH_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Get current version number
  app.get('/cmdb/cis/:ciId/versions/current', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    try {
      const version = await cmdbService.getCurrentVersion(params.ciId);
      return reply.send({ success: true, data: version });
    } catch (error: any) {
      handleError(reply, new OrionError('FETCH_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Restore to version
  app.post('/cmdb/cis/:ciId/versions/restore', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    try {
      const ci = await cmdbService.restoreToVersion(params.ciId, body.version, body.user || 'system');
      if (!ci) {
        handleError(reply, new NotFoundError('NOT_FOUND'));
        return;
      }
      return reply.send({ success: true, data: ci });
    } catch (error: any) {
      handleError(reply, new ValidationError('RESTORE_ERROR'));
    }
  });

  // ==================== Topology ====================

  // Get topology
  app.get('/cmdb/topology', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    try {
      const topology = await topologyService.getTopology({
        ciType: query.ciType,
        depth: query.depth ? parseInt(query.depth) : undefined,
        tenantId: BigInt(query.tenantId || 1),
      });
      return reply.send({ success: true, data: topology });
    } catch (error: any) {
      handleError(reply, new OrionError('FETCH_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Get service dependencies
  app.get('/cmdb/topology/:ciId/dependencies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    try {
      const topology = await topologyService.getServiceDependencies(params.ciId);
      return reply.send({ success: true, data: topology });
    } catch (error: any) {
      handleError(reply, new OrionError('FETCH_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // Impact analysis
  app.get('/cmdb/topology/:ciId/impact', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    try {
      const impact = await topologyService.getImpactAnalysis(params.ciId);
      return reply.send({ success: true, data: impact });
    } catch (error: any) {
      handleError(reply, new OrionError('FETCH_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Integration (Hosts, K8s, CICD, Execute) ====================

  // Hosts
  app.get('/cmdb/hosts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (integrationController) {
      return integrationController.listHosts(request, reply);
    }
    handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
  });

  app.get('/cmdb/hosts/:ciId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (integrationController) {
      return integrationController.getHost(request, reply);
    }
    handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
  });

  // K8s
  app.get('/cmdb/k8s', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (integrationController) {
      return integrationController.listK8sResources(request, reply);
    }
    handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
  });

  app.post('/cmdb/k8s/sync/start', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (integrationController) {
      return integrationController.startK8sSync(request, reply);
    }
    handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
  });

  app.post('/cmdb/k8s/sync/stop', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (integrationController) {
      return integrationController.stopK8sSync(request, reply);
    }
    handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
  });

  // CICD
  app.get('/cmdb/cicd', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (integrationController) {
      return integrationController.listCICDResources(request, reply);
    }
    handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
  });

  // Execute
  app.post('/cmdb/execute', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (integrationController) {
      return integrationController.executeScript(request, reply);
    }
    handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
  });

  // ==================== Health ====================

  app.get('/cmdb/health', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true, data: { status: 'ok' } });
  });
}
