/**
 * Graph Service Routes
 *
 * HTTP API endpoints for Neo4j knowledge graph and service topology.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GraphService } from '../services/GraphService';

// Request/Response type definitions
interface GraphQueryRequest {
  cypher: string;
  params?: Record<string, unknown>;
}

interface GraphPathRequest {
  startId: string;
  endId: string;
}

interface CreateNodeRequest {
  label: string;
  properties?: Record<string, unknown>;
}

interface CreateRelationshipRequest {
  startId: string;
  endId: string;
  type: string;
  properties?: Record<string, unknown>;
}

interface GraphRoutesOptions {
  graphService?: GraphService;
}

export async function graphRoutes(
  fastify: FastifyInstance,
  options: GraphRoutesOptions = {}
): Promise<void> {
  // Dependency injection: use provided service or create new instance
  const graphService = options.graphService ?? new GraphService();

  // Health check
  fastify.get('/health', async () => {
    return graphService.checkHealth();
  });

  // Execute Cypher query
  fastify.post<{ Body: GraphQueryRequest }>('/api/v1/graph/query', async (request: FastifyRequest<{ Body: GraphQueryRequest }>, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const { cypher, params } = request.body;
    return graphService.executeQuery({ cypher, params, tenantId });
  });

  // Find shortest path
  fastify.get<{ Querystring: GraphPathRequest }>('/api/v1/graph/path', async (request: FastifyRequest<{ Querystring: GraphPathRequest }>, reply: FastifyReply) => {
    const { startId, endId } = request.query;
    return graphService.findShortestPath(startId, endId);
  });

  // Get service topology
  fastify.get('/api/v1/graph/topology', async () => {
    return graphService.getServiceTopology();
  });

  // Create node
  fastify.post<{ Body: CreateNodeRequest }>('/api/v1/graph/nodes', async (request: FastifyRequest<{ Body: CreateNodeRequest }>, reply: FastifyReply) => {
    const { label, properties } = request.body;
    const node = await graphService.createNode(label, properties || {});
    return reply.code(201).send({ success: true, data: node });
  });

  // Create relationship
  fastify.post<{ Body: CreateRelationshipRequest }>('/api/v1/graph/relationships', async (request: FastifyRequest<{ Body: CreateRelationshipRequest }>, reply: FastifyReply) => {
    const { startId, endId, type, properties } = request.body;
    const rel = await graphService.createRelationship(startId, endId, type, properties);
    return reply.code(201).send({ success: true, data: rel });
  });
}
