/**
 * Ticket Knowledge Conversion API Routes
 *
 * Routes under /api/v1/tickets/:id/to-knowledge
 * Handles ticket-to-knowledge conversion operations.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { TicketKnowledgeMappingRepository } from '../repositories/TicketKnowledgeMappingRepository';
import { TicketToKnowledgeService, TicketData } from '../services/knowledge/TicketToKnowledgeService';
import { handleError, OrionError } from '../errors';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'ticket-knowledge-routes' });

interface TicketKnowledgeRoutesOptions {
  database: DatabasePool;
}

export default async function ticketKnowledgeRoutes(
  app: FastifyInstance,
  options: TicketKnowledgeRoutesOptions,
): Promise<void> {
  const { database } = options;

  const mappingRepo = new TicketKnowledgeMappingRepository(database);
  const ticketToKnowledgeService = new TicketToKnowledgeService(mappingRepo);

  // Helper: get ticket data from TicketService (placeholder - actual integration depends on TicketService)
  async function getTicketData(ticketId: string): Promise<TicketData> {
    // Try to fetch from the database
    try {
      const result = await database.query(
        `SELECT id, title, description, solution, tags, priority, assignee, status FROM tickets WHERE id = $1`,
        [ticketId],
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          solution: row.solution,
          tags: row.tags,
          priority: row.priority,
          assignee: row.assignee,
          status: row.status,
        };
      }
    } catch {
      // Table might not exist, fall through to error
    }
    throw new OrionError('`Ticket not found: ${ticketId}`',  'NOT_FOUND');
  }

  // POST /api/v1/tickets/:id/to-knowledge - Convert ticket to knowledge
  app.post('/:id/to-knowledge', {
    onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const user = (request as any).user;

      const ticket = await getTicketData(id);

      // Knowledge service integration - for now, we create a placeholder
      // In production, this would call the actual KnowledgeService
      const knowledgeService = {
        createDoc: async (input: any) => {
          const result = await database.query(
            `INSERT INTO knowledge_documents (tenant_id, title, content, category_id, tags, metadata)
             VALUES (current_setting('app.current_tenant_id', true), $1, $2, $3, $4, $5)
             RETURNING id`,
            [input.title, input.content, input.categoryId ?? null, JSON.stringify(input.tags ?? []), JSON.stringify(input.metadata ?? {})],
          );
          return result.rows[0]?.id ?? `doc-${Date.now()}`;
        },
      };

      const articleId = await ticketToKnowledgeService.convert(
        ticket,
        {
          categoryId: body.categoryId,
          includeComments: body.includeComments,
          autoClassify: body.autoClassify,
        },
        knowledgeService,
        user?.id ?? 'unknown',
      );

      return reply.status(201).send({ success: true, data: { articleId, ticketId: id } });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to convert ticket to knowledge');
      handleError(reply, error);
    }
  });

  // GET /api/v1/tickets/:id/to-knowledge/preview - Preview conversion result
  app.get('/:id/to-knowledge/preview', {
    onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const ticket = await getTicketData(id);
      const preview = await ticketToKnowledgeService.preview(ticket);
      return reply.status(200).send({ success: true, data: preview });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to preview ticket knowledge conversion');
      handleError(reply, error);
    }
  });

  // GET /api/v1/tickets/:id/knowledge - Get knowledge articles for ticket
  app.get('/:id/knowledge', {
    onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const mappings = await ticketToKnowledgeService.getMappingsByTicket(id);
      return reply.status(200).send({ success: true, data: mappings, total: mappings.length });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to get ticket knowledge mappings');
      handleError(reply, error);
    }
  });
}
