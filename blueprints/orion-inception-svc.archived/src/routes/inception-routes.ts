/**
 * Inception Service API Routes
 *
 * HTTP API endpoints for SQL audit and execution via Inception engine.
 * Provides SQL parsing, formatting, auditing, and execution capabilities.
 *
 * Routes:
 * - GET  /health              - Service health check
 * - GET  /status              - Inception connection status
 * - POST /audit               - Audit SQL without execution
 * - POST /parse               - Parse and format SQL
 * - POST /execute             - Execute SQL (dry-run or real)
 * - GET  /databases           - List available databases
 * - GET  /history             - Get audit execution history
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InceptionService } from '../services/InceptionService';
import type { SqlAuditResult, SqlParseRequest, SqlExecuteRequest } from '../types/inception';

interface InceptionRoutesOptions {
  inceptionService?: InceptionService;
}

export default async function inceptionRoutes(
  app: FastifyInstance,
  options: InceptionRoutesOptions
): Promise<void> {
  const inceptionService = options.inceptionService || new InceptionService();

  // ==================== Health Check ====================

  /**
   * GET /health - Service health check
   */
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      service: 'orion-inception-svc',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /status - Inception connection status
   */
  app.get('/status', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return inceptionService.checkStatus();
  });

  /**
   * POST /audit - Audit SQL without execution
   *
   * Body: { sql: string, db: string, tenantId: string }
   */
  app.post<{ Body: SqlParseRequest }>(
    '/audit',
    async (request: FastifyRequest<{ Body: SqlParseRequest }>, reply: FastifyReply) => {
      const { tenantId } = request.headers as { tenantId: string };
      const body = request.body as SqlParseRequest;

      if (!body.sql || !body.db) {
        return reply.status(400).send({
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'sql and db are required fields',
        });
      }

      try {
        const result = await inceptionService.auditSql({
          ...body,
          tenantId: body.tenantId || tenantId,
        });
        return reply.send(result);
      } catch (error: any) {
        return reply.status(400).send({
          error: 'AUDIT_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /parse - Parse and format SQL
   *
   * Body: { sql: string }
   */
  app.post<{ Body: { sql: string } }>(
    '/parse',
    async (request: FastifyRequest<{ Body: { sql: string } }>, reply: FastifyReply) => {
      const { sql } = request.body;

      if (!sql) {
        return reply.status(400).send({
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'sql is a required field',
        });
      }

      try {
        const result = await inceptionService.formatSql(sql);
        return reply.send(result);
      } catch (error: any) {
        return reply.status(400).send({
          error: 'PARSE_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /execute - Execute SQL via Inception
   *
   * Body: { sql: string, db: string, tenantId: string, dryRun?: boolean }
   */
  app.post<{ Body: SqlExecuteRequest }>(
    '/execute',
    async (request: FastifyRequest<{ Body: SqlExecuteRequest }>, reply: FastifyReply) => {
      const { tenantId } = request.headers as { tenantId: string };
      const body = request.body as SqlExecuteRequest;

      if (!body.sql || !body.db) {
        return reply.status(400).send({
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'sql and db are required fields',
        });
      }

      try {
        const result = await inceptionService.executeSql({
          ...body,
          tenantId: body.tenantId || tenantId,
        });
        return reply.send(result);
      } catch (error: any) {
        return reply.status(400).send({
          error: 'EXECUTE_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /databases - List available databases
   *
   * Query: ?tenantId=xxx
   */
  app.get<{ Querystring: { tenantId?: string } }>(
    '/databases',
    async (request: FastifyRequest<{ Querystring: { tenantId?: string } }>, _reply: FastifyReply) => {
      // Inception doesn't directly support listing databases via HTTP
      // This would need to be implemented based on the specific Inception setup
      // Return a placeholder for now
      return {
        databases: [],
        message: 'Database listing not implemented - configure INCEPTION_DBWhitelist',
      };
    }
  );

  /**
   * GET /history - Get audit execution history
   *
   * Query: ?tenantId=xxx&limit=50
   */
  app.get<{ Querystring: { tenantId?: string; limit?: string } }>(
    '/history',
    async (
      request: FastifyRequest<{ Querystring: { tenantId?: string; limit?: string } }>,
      _reply: FastifyReply
    ) => {
      const { tenantId, limit } = request.query;
      const historyLimit = limit ? parseInt(limit, 10) : 50;

      // History would be stored in the database if we had persistence
      // For now, return empty list as Inception is stateless
      return {
        history: [],
        total: 0,
        tenantId: tenantId || 'default',
        limit: historyLimit,
      };
    }
  );

  /**
   * POST /validate - Validate SQL syntax without audit
   *
   * Body: { sql: string, db: string }
   */
  app.post<{ Body: { sql: string; db: string } }>(
    '/validate',
    async (request: FastifyRequest<{ Body: { sql: string; db: string } }>, reply: FastifyReply) => {
      const { sql, db } = request.body;

      if (!sql || !db) {
        return reply.status(400).send({
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'sql and db are required fields',
        });
      }

      // Basic validation using the audit endpoint with minimal processing
      try {
        const result = await inceptionService.auditSql({ sql, db, tenantId: 'validate' });
        return reply.send({
          valid: result.success,
          errors: result.errors,
          warnings: result.warnings,
        });
      } catch (error: any) {
        return reply.status(400).send({
          valid: false,
          error: error.message,
        });
      }
    }
  );
}