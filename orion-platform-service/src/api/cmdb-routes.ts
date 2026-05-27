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

interface CmdbRoutesOptions {
  database?: DatabasePool;
}

export default async function cmdbRoutes(
  app: FastifyInstance,
  options?: CmdbRoutesOptions
): Promise<void> {
  // Initialize services
  const cmdbService = new CmdbService({
    database: options?.database,
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
      return reply.status(400).send({ error: 'CREATE_ERROR', message: error.message });
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
        return reply.status(404).send({ error: 'NOT_FOUND', message: `CI ${params.id} not found` });
      }
      return reply.send({ success: true, data: ci });
    } catch (error: any) {
      return reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
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
        return reply.status(404).send({ error: 'NOT_FOUND', message: `CI ${params.ciId} not found` });
      }
      return reply.send({ success: true, data: ci });
    } catch (error: any) {
      return reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
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
        return reply.status(404).send({ error: 'NOT_FOUND', message: `CI ${params.id} not found` });
      }
      return reply.send({ success: true, data: ci });
    } catch (error: any) {
      return reply.status(400).send({ error: 'UPDATE_ERROR', message: error.message });
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
        return reply.status(404).send({ error: 'NOT_FOUND', message: `CI ${params.id} not found` });
      }
      return reply.send({ success: true, message: 'CI deleted' });
    } catch (error: any) {
      return reply.status(500).send({ error: 'DELETE_ERROR', message: error.message });
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
        page: result.page || 1,
        pageSize: result.limit || result.pageSize || 20,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: 'LIST_ERROR', message: error.message });
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
      return reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
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
      return reply.status(400).send({ error: 'CREATE_ERROR', message: error.message });
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
        return reply.status(404).send({ error: 'NOT_FOUND', message: `Relation ${params.relationId} not found` });
      }
      return reply.send({ success: true, message: 'Relation deleted' });
    } catch (error: any) {
      return reply.status(500).send({ error: 'DELETE_ERROR', message: error.message });
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
      return reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
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
      return reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
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
        return reply.status(404).send({ error: 'NOT_FOUND', message: `CI ${params.ciId} not found` });
      }
      return reply.send({ success: true, data: ci });
    } catch (error: any) {
      return reply.status(400).send({ error: 'RESTORE_ERROR', message: error.message });
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
      return reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
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
      return reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
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
      return reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
    }
  });

  // ==================== Integration (Hosts, K8s, CICD, Execute) ====================

  // Hosts
  app.get('/cmdb/hosts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!integrationController) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'CMDB integration not configured' });
    return integrationController.listHosts(request, reply);
  });

  app.get('/cmdb/hosts/:ciId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!integrationController) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'CMDB integration not configured' });
    return integrationController.getHost(request, reply);
  });

  // K8s
  app.get('/cmdb/k8s', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!integrationController) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'CMDB integration not configured' });
    return integrationController.listK8sResources(request, reply);
  });

  app.post('/cmdb/k8s/sync/start', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!integrationController) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'CMDB integration not configured' });
    return integrationController.startK8sSync(request, reply);
  });

  app.post('/cmdb/k8s/sync/stop', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!integrationController) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'CMDB integration not configured' });
    return integrationController.stopK8sSync(request, reply);
  });

  // CICD
  app.get('/cmdb/cicd', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!integrationController) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'CMDB integration not configured' });
    return integrationController.listCICDResources(request, reply);
  });

  // Execute
  app.post('/cmdb/execute', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!integrationController) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'CMDB integration not configured' });
    return integrationController.executeScript(request, reply);
  });

  // ==================== Health ====================

  app.get('/cmdb/health', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true, data: { status: 'ok' } });
  });
}
