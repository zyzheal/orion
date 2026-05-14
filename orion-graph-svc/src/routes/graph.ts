/**
 * Graph Service Routes
 *
 * HTTP API endpoints for Neo4j knowledge graph and service topology.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GraphService } from '../services/GraphService';

const graphService = new GraphService();

export async function graphRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check
  fastify.get('/health', async () => {
    return graphService.checkHealth();
  });

  // Execute Cypher query
  fastify.post('/api/v1/graph/query', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    return graphService.executeQuery({ ...body, tenantId });
  });

  // Find shortest path
  fastify.get('/api/v1/graph/path', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    return graphService.findShortestPath(query.startId, query.endId);
  });

  // Get service topology
  fastify.get('/api/v1/graph/topology', async () => {
    return graphService.getServiceTopology();
  });

  // Create node
  fastify.post('/api/v1/graph/nodes', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const node = await graphService.createNode(body.label, body.properties);
    return reply.code(201).send(node);
  });

  // Create relationship
  fastify.post('/api/v1/graph/relationships', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const rel = await graphService.createRelationship(
      body.startId,
      body.endId,
      body.type,
      body.properties
    );
    return reply.code(201).send(rel);
  });
}
