/**
 * Inception Service Routes
 *
 * HTTP API endpoints for SQL audit and execution via Inception engine.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InceptionService } from '../services/InceptionService';

const inceptionService = new InceptionService();

export async function inceptionRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check
  fastify.get('/health', async () => {
    return inceptionService.checkStatus();
  });

  // Audit SQL
  fastify.post('/audit', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    const result = await inceptionService.auditSql({ ...body, tenantId });
    return result;
  });

  // Parse/Format SQL
  fastify.post('/parse', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    return inceptionService.formatSql(body.sql);
  });

  // Execute SQL (dry-run or real)
  fastify.post('/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    const result = await inceptionService.executeSql({ ...body, tenantId });
    return result;
  });
}
