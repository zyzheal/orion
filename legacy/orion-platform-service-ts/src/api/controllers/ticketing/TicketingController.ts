/**
 * TASK-801: Smart Ticketing Controller
 *
 * Handles API requests for ticket CRUD, workflow management,
 * assignment, relations, and reporting.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from '../BaseController';
import { TicketService } from '../../../services/ticketing/TicketService';
import { TicketingService, TicketingServiceError } from '../../../services/ticketing/TicketingService';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketRelationType,
  SLATarget,
  AssignmentRule,
} from '../../../services/ticketing/types';

const VALID_STATUSES: TicketStatus[] = ['open', 'assigned', 'in-progress', 'resolved', 'closed'];
const VALID_PRIORITIES: TicketPriority[] = ['critical', 'high', 'medium', 'low'];
const VALID_CATEGORIES: TicketCategory[] = [
  'infrastructure', 'application', 'database', 'network',
  'security', 'deployment', 'pipeline', 'performance', 'cost', 'other',
];
const VALID_RELATION_TYPES: TicketRelationType[] = [
  'duplicate', 'caused-by', 'related', 'blocks', 'blocked-by',
];

export class TicketingController extends BaseController {
  private ticketService: TicketService;
  private ticketingService: TicketingService;

  constructor(ticketService: TicketService, ticketingService: TicketingService) {
    super();
    this.ticketService = ticketService;
    this.ticketingService = ticketingService;
  }

  // ==================== Service Control ====================

  async startService(request: FastifyRequest, reply: FastifyReply) {
    try {
      await this.ticketService.start();
      await reply.status(200).send({ success: true, message: 'Ticketing service started' });
    } catch (error: any) {
      await reply.status(500).send({ error: 'START_ERROR', message: error.message });
    }
  }

  async stopService(request: FastifyRequest, reply: FastifyReply) {
    try {
      await this.ticketService.stop();
      await reply.status(200).send({ success: true, message: 'Ticketing service stopped' });
    } catch (error: any) {
      await reply.status(500).send({ error: 'STOP_ERROR', message: error.message });
    }
  }

  async healthCheck(request: FastifyRequest, reply: FastifyReply) {
    const health = await this.ticketService.getHealthStatus();
    await reply.status(200).send({ success: true, data: { health } });
  }

  // ==================== Ticket CRUD ====================

  async createTicket(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { title, description, category, priority, reporter, tags, metadata } = body;

      if (!title || !description || !category || !priority || !reporter) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: title, description, category, priority, reporter',
        });
        return;
      }

      if (!VALID_CATEGORIES.includes(category)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        });
        return;
      }

      if (!VALID_PRIORITIES.includes(priority)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
        });
        return;
      }

      const input = {
        tenant_id: this.getTenantId(request),
        title,
        description,
        type: category,
        priority,
        reporter_id: reporter,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
      };
      const ticket = await this.ticketingService.createTicket(input);
      await reply.status(201).send({ success: true, data: { ticket } });
    } catch (error: any) {
      if (error instanceof TicketingServiceError) {
        await reply.status(400).send({ error: 'VALIDATION_ERROR', message: error.message });
        return;
      }
      await reply.status(500).send({ error: 'CREATE_ERROR', message: error.message });
    }
  }

  async createTicketFromAlert(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { alertId, metric, severity, message, tags, triggeredAt, ruleName } = body;

      if (!alertId || !metric) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: alertId, metric',
        });
        return;
      }

      const validSeverities = ['critical', 'warning', 'info'];
      if (severity && !validSeverities.includes(severity)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`,
        });
        return;
      }

      const ticket = await this.ticketService.createTicketFromAlert({
        alertId, metric,
        severity: severity || 'warning',
        message: message || '',
        tags,
        triggeredAt: triggeredAt ? new Date(triggeredAt) : new Date(),
        ruleName,
      });

      await reply.status(201).send({ success: true, data: { ticket } });
    } catch (error: any) {
      await reply.status(500).send({ error: 'CREATE_ERROR', message: error.message });
    }
  }

  async createTicketFromIncident(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { incidentId, title, description, severity, affectedServices, tags, reporter } = body;

      if (!incidentId || !title || !description || !reporter) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: incidentId, title, description, reporter',
        });
        return;
      }

      const validSeverities = ['critical', 'high', 'medium', 'low'];
      if (severity && !validSeverities.includes(severity)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`,
        });
        return;
      }

      const ticket = this.ticketService.createTicketFromIncident({
        incidentId, title, description,
        severity: severity || 'medium',
        affectedServices, tags, reporter,
      });

      await reply.status(201).send({ success: true, data: { ticket } });
    } catch (error: any) {
      await reply.status(500).send({ error: 'CREATE_ERROR', message: error.message });
    }
  }

  async getTicket(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    try {
      const ticket = await this.ticketingService.getTicket(params.id);
      await reply.status(200).send({ success: true, data: { ticket } });
    } catch (error: any) {
      if (error instanceof TicketingServiceError && error.code === 'NOT_FOUND') {
        await reply.status(404).send({ error: 'NOT_FOUND', message: `Ticket ${params.id} not found` });
      } else {
        await reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
      }
    }
  }

  async listTickets(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const page = query.page ? parseInt(query.page) : 1;
    const limit = query.limit ? parseInt(query.limit) : 20;

    try {
      const result = await this.ticketingService.listTickets({
        page, limit,
        tenantId: this.getTenantId(request),
        status: query.status,
        assigneeId: query.assignee,
        priority: query.priority,
      });
      await reply.status(200).send({
        success: true,
        data: {
          tickets: result.data,
          count: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error: any) {
      await reply.status(500).send({ error: 'LIST_ERROR', message: error.message });
    }
  }

  // ==================== Workflow ====================

  async transitionStatus(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};
    const { toStatus, performedBy, reason } = body;

    if (!toStatus || !performedBy) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: toStatus, performedBy',
      });
      return;
    }

    if (!VALID_STATUSES.includes(toStatus)) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
      return;
    }

    const result = await this.ticketService.transitionStatus(params.id, toStatus, performedBy, reason);

    if ('error' in result) {
      await reply.status(400).send({ error: 'TRANSITION_ERROR', message: result.error });
      return;
    }

    await reply.status(200).send({ success: true, data: { ticket: result.ticket } });
  }

  async assignTicket(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};
    const { assignee, assignedBy, reason } = body;

    if (!assignee || !assignedBy) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: assignee, assignedBy',
      });
      return;
    }

    const result = await this.ticketService.assignTicket(params.id, assignee, assignedBy, reason);

    if ('error' in result) {
      await reply.status(400).send({ error: 'ASSIGN_ERROR', message: result.error });
      return;
    }

    await reply.status(200).send({ success: true, data: { ticket: result.ticket } });
  }

  async escalateTicket(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};
    const { escalatedBy, reason } = body;

    if (!escalatedBy) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: escalatedBy',
      });
      return;
    }

    const result = await this.ticketService.escalateTicket(params.id, escalatedBy, reason);

    if ('error' in result) {
      await reply.status(400).send({ error: 'ESCALATION_ERROR', message: result.error });
      return;
    }

    await reply.status(200).send({ success: true, data: { ticket: result.ticket } });
  }

  async resolveTicket(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};
    const { performedBy, resolutionNote } = body;

    if (!performedBy) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: performedBy',
      });
      return;
    }

    const result = await this.ticketService.resolveTicket(params.id, performedBy, resolutionNote);

    if ('error' in result) {
      await reply.status(400).send({ error: 'RESOLVE_ERROR', message: result.error });
      return;
    }

    await reply.status(200).send({ success: true, data: { ticket: result.ticket } });
  }

  async closeTicket(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};
    const { performedBy, reason } = body;

    if (!performedBy) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: performedBy',
      });
      return;
    }

    const result = await this.ticketService.closeTicket(params.id, performedBy, reason);

    if ('error' in result) {
      await reply.status(400).send({ error: 'CLOSE_ERROR', message: result.error });
      return;
    }

    await reply.status(200).send({ success: true, data: { ticket: result.ticket } });
  }

  async getWorkflowHistory(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const history = await this.ticketService.getWorkflowHistory(params.id);
    await reply.status(200).send({ success: true, data: { history } });
  }

  // ==================== Assignment Rules ====================

  async addAssignmentRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { id, name, categories, assignee, priorities, enabled, order } = body;

      if (!name || !categories || !assignee) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, categories, assignee',
        });
        return;
      }

      const rule: AssignmentRule = {
        id: id || `rule-${Date.now()}`,
        name, categories, assignee, priorities,
        enabled: enabled !== false,
        order: order ?? 0,
      };

      this.ticketService.addAssignmentRule(rule);
      await reply.status(201).send({ success: true, data: { rule } });
    } catch (error: any) {
      await reply.status(500).send({ error: 'RULE_ERROR', message: error.message });
    }
  }

  async getAssignmentRules(request: FastifyRequest, reply: FastifyReply) {
    const rules = this.ticketService.getAssignmentRules();
    await reply.status(200).send({ success: true, data: { rules } });
  }

  async removeAssignmentRule(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const removed = this.ticketService.removeAssignmentRule(params.id);

    if (!removed) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Assignment rule ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({ success: true, message: 'Assignment rule removed' });
  }

  // ==================== Relations ====================

  async addRelation(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { relatedTicketId, relationType, createdBy, description, confidence } = body;

      if (!relatedTicketId || !relationType || !createdBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: relatedTicketId, relationType, createdBy',
        });
        return;
      }

      if (!VALID_RELATION_TYPES.includes(relationType)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid relation type. Must be one of: ${VALID_RELATION_TYPES.join(', ')}`,
        });
        return;
      }

      const relation = this.ticketService.analyzer.addRelation(
        params.id, relatedTicketId, relationType, createdBy, description, confidence
      );

      await reply.status(201).send({ success: true, data: { relation } });
    } catch (error: any) {
      await reply.status(500).send({ error: 'RELATION_ERROR', message: error.message });
    }
  }

  async getRelations(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const relations = this.ticketService.getRelationsForTicket(params.id);
    await reply.status(200).send({ success: true, data: { relations } });
  }

  async findRelatedTickets(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;

    const related = await this.ticketService.findRelatedTickets(params.id, {
      maxResults: query.maxResults ? parseInt(query.maxResults) : undefined,
      minConfidence: query.minConfidence ? parseFloat(query.minConfidence) : undefined,
    });

    await reply.status(200).send({ success: true, data: { related, count: related.length } });
  }

  async detectDuplicates(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;

    const duplicates = await this.ticketService.detectDuplicates(
      params.id,
      query.threshold ? parseFloat(query.threshold) : undefined
    );

    await reply.status(200).send({ success: true, data: { duplicates, count: duplicates.length } });
  }

  async correlateRootCause(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any || {};
    const { ticketIds } = body;

    if (!ticketIds || !Array.isArray(ticketIds)) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: ticketIds (array)',
      });
      return;
    }

    const correlation = this.ticketService.correlateRootCause(ticketIds);
    await reply.status(200).send({ success: true, data: { correlation } });
  }

  // ==================== SLA ====================

  async addSLATarget(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { id, name, priority, targetResponseTimeMs, targetResolutionTimeMs, enabled } = body;

      if (!name || !priority || targetResolutionTimeMs === undefined) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, priority, targetResolutionTimeMs',
        });
        return;
      }

      if (!VALID_PRIORITIES.includes(priority)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
        });
        return;
      }

      const sla: SLATarget = {
        id: id || `sla-${Date.now()}`,
        name, priority,
        targetResponseTimeMs: targetResponseTimeMs ?? 0,
        targetResolutionTimeMs,
        enabled: enabled !== false,
      };

      this.ticketService.addSLATarget(sla);
      await reply.status(201).send({ success: true, data: { sla } });
    } catch (error: any) {
      await reply.status(500).send({ error: 'SLA_ERROR', message: error.message });
    }
  }

  async getTicketSLA(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const sla = this.ticketService.getTicketSLA(params.id);

    if (!sla) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `SLA record for ticket ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({ success: true, data: { sla } });
  }

  // ==================== Reports ====================

  async getSLACompliance(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const report = this.ticketService.getSLACompliance(
      query.periodStart ? new Date(query.periodStart) : undefined,
      query.periodEnd ? new Date(query.periodEnd) : undefined
    );
    await reply.status(200).send({ success: true, data: { report } });
  }

  async getResolutionStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = this.ticketService.getResolutionStats();
    await reply.status(200).send({ success: true, data: { stats } });
  }

  async getBacklogAnalysis(request: FastifyRequest, reply: FastifyReply) {
    const analysis = this.ticketService.getBacklogAnalysis();
    await reply.status(200).send({ success: true, data: { analysis } });
  }

  async getTrendReport(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const report = this.ticketService.getTrendReport({
      days: query.days ? parseInt(query.days) : undefined,
      granularity: query.granularity,
    });
    await reply.status(200).send({ success: true, data: { report } });
  }

  async getStatistics(request: FastifyRequest, reply: FastifyReply) {
    const stats = this.ticketService.getStatistics();
    await reply.status(200).send({ success: true, data: { stats } });
  }
}
