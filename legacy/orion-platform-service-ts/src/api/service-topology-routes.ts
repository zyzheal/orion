/**
 * Service Topology API Routes
 *
 * Routes under /api/v1/service-topology
 * Builds service dependency graph from ServiceRegistryRepository data.
 *
 * Endpoints:
 *   GET /topology           - Get full service topology graph (nodes + edges)
 *   GET /topology/:serviceId - Get topology for a specific service
 *   GET /dependencies/:serviceId - Get direct dependencies of a service
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ServiceRegistryRepository, ServiceRegistryEntity } from '../repositories/ServiceRegistryRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OrionError, ErrorCode, handleError } from '../errors';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../db/tenant-context-storage';

const logger = createLogger('service-topology-routes');

// ==================== Types ====================

export interface TopologyNode {
  id: string;
  name: string;
  type: string;
  health: string;
  address: string;
}

export interface TopologyEdge {
  source: string;
  target: string;
  type: string;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

interface ServiceTopologyRoutesOptions {
  database?: DatabasePool;
}

// ==================== Helpers ====================

/**
 * Convert a ServiceRegistryEntity to a TopologyNode.
 */
function entityToNode(service: ServiceRegistryEntity): TopologyNode {
  return {
    id: service.serviceId,
    name: service.serviceName,
    type: service.protocol,
    health: service.healthStatus,
    address: service.serviceUrl,
  };
}

/**
 * Build a full topology graph from a list of registered services.
 *
 * Edges are derived from `metadata.connections` on each service, which is
 * an array of `{ target: string; type?: string }` objects recording who
 * this service calls.  Services without connection metadata contribute no
 * edges but still appear as nodes.
 */
function buildTopologyGraph(services: ServiceRegistryEntity[]): TopologyGraph {
  const nodes: TopologyNode[] = services.map(entityToNode);

  // Build a lookup of serviceId → node id for validation
  const serviceIdSet = new Set(services.map(s => s.serviceId));

  const edges: TopologyEdge[] = [];
  for (const service of services) {
    const connections = (service.metadata?.connections || []) as Array<{ target: string; type?: string }>;
    for (const conn of connections) {
      // Only emit edges where both endpoints are known registered services
      if (serviceIdSet.has(conn.target)) {
        edges.push({
          source: service.serviceId,
          target: conn.target,
          type: conn.type || 'calls',
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Extract the sub-graph that involves the given serviceId:
 * - the service node itself
 * - all nodes connected to it by an edge (in either direction)
 * - only the edges that touch the service
 */
function buildSubGraph(fullGraph: TopologyGraph, serviceId: string): TopologyGraph {
  const connectedNodeIds = new Set<string>([serviceId]);
  for (const edge of fullGraph.edges) {
    if (edge.source === serviceId) connectedNodeIds.add(edge.target);
    if (edge.target === serviceId) connectedNodeIds.add(edge.source);
  }

  const nodes = fullGraph.nodes.filter(n => connectedNodeIds.has(n.id));
  const edges = fullGraph.edges.filter(e => e.source === serviceId || e.target === serviceId);

  return { nodes, edges };
}

/**
 * Resolve the tenantId for the current request.
 * Falls back to 'default' when no tenant context is available (e.g. system calls).
 */
function resolveTenantId(request: FastifyRequest): string {
  const tenantCtx = (request as any).tenantContext;
  const tenantId = tenantCtx?.getCurrentTenant?.()?.tenantId ?? (request as any).tenantId ?? 'default';
  return String(tenantId);
}

// ==================== Route Registration ====================

export default async function serviceTopologyRoutes(
  app: FastifyInstance,
  options: ServiceTopologyRoutesOptions,
): Promise<void> {
  if (!options.database) {
    logger.warn('[ServiceTopologyRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const registryRepo = new ServiceRegistryRepository(options.database);

  // ==================== Full Topology ====================

  // GET /api/v1/service-topology/topology - Get full service topology graph
  app.get('/topology', {
    onRequest: [authenticateUser, requirePermission({ resource: 'service-topology', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const traceId = getCurrentTraceId();
      const tenantId = resolveTenantId(request);

      const services = await registryRepo.findByTenantId(tenantId, 500, 0);
      const graph = buildTopologyGraph(services);

      logger.info({ traceId, tenantId, nodeCount: graph.nodes.length, edgeCount: graph.edges.length }, 'Topology retrieved');
      return reply.send({ success: true, data: graph });
    } catch (error: unknown) {
      logger.error({ error, traceId: getCurrentTraceId() }, 'Failed to retrieve service topology');
      return handleError(reply, error);
    }
  });

  // ==================== Topology for a Specific Service ====================

  // GET /api/v1/service-topology/topology/:serviceId - Get topology filtered to one service
  app.get('/topology/:serviceId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'service-topology', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const traceId = getCurrentTraceId();
      const tenantId = resolveTenantId(request);
      const { serviceId } = request.params as { serviceId: string };

      // Verify the service exists in the current tenant
      const targetService = await registryRepo.findByServiceId(serviceId);
      if (!targetService) {
        return handleError(reply, new OrionError(`Service not found: ${serviceId}`, ErrorCode.NOT_FOUND));
      }

      const services = await registryRepo.findByTenantId(tenantId, 500, 0);
      const fullGraph = buildTopologyGraph(services);
      const subGraph = buildSubGraph(fullGraph, serviceId);

      logger.info({ traceId, tenantId, serviceId, nodeCount: subGraph.nodes.length, edgeCount: subGraph.edges.length }, 'Service topology retrieved');
      return reply.send({ success: true, data: subGraph });
    } catch (error: unknown) {
      logger.error({ error, traceId: getCurrentTraceId(), serviceId: (request.params as any)?.serviceId }, 'Failed to retrieve service topology');
      return handleError(reply, error);
    }
  });

  // ==================== Dependencies of a Service ====================

  // GET /api/v1/service-topology/dependencies/:serviceId - Get direct dependencies of a service
  app.get('/dependencies/:serviceId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'service-topology', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const traceId = getCurrentTraceId();
      const tenantId = resolveTenantId(request);
      const { serviceId } = request.params as { serviceId: string };

      // Verify the service exists in the current tenant
      const targetService = await registryRepo.findByServiceId(serviceId);
      if (!targetService) {
        return handleError(reply, new OrionError(`Service not found: ${serviceId}`, ErrorCode.NOT_FOUND));
      }

      const services = await registryRepo.findByTenantId(tenantId, 500, 0);
      const fullGraph = buildTopologyGraph(services);

      // Collect edges where this service is the source (outgoing dependencies)
      const outgoingEdges = fullGraph.edges
        .filter(e => e.source === serviceId)
        .map(e => ({ ...e, direction: 'outgoing' as const }));

      // Collect edges where this service is the target (incoming dependents)
      const incomingEdges = fullGraph.edges
        .filter(e => e.target === serviceId)
        .map(e => ({ ...e, direction: 'incoming' as const }));

      const dependencyNodeIds = new Set<string>([serviceId]);
      for (const edge of [...outgoingEdges, ...incomingEdges]) {
        dependencyNodeIds.add(edge.source);
        dependencyNodeIds.add(edge.target);
      }

      const nodes = fullGraph.nodes.filter(n => dependencyNodeIds.has(n.id));

      const dependencies = {
        service: entityToNode(targetService),
        nodes,
        outgoingDependencies: outgoingEdges,
        incomingDependents: incomingEdges,
      };

      logger.info({ traceId, tenantId, serviceId, outgoing: outgoingEdges.length, incoming: incomingEdges.length }, 'Service dependencies retrieved');
      return reply.send({ success: true, data: dependencies });
    } catch (error: unknown) {
      logger.error({ error, traceId: getCurrentTraceId(), serviceId: (request.params as any)?.serviceId }, 'Failed to retrieve service dependencies');
      return handleError(reply, error);
    }
  });
}
