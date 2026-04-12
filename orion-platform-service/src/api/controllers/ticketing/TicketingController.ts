/**
 * TASK-801: Smart Ticketing Controller
 *
 * Handles API requests for ticket CRUD, workflow management,
 * assignment, relations, and reporting.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { TicketService } from '../../services/ticketing/TicketService';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketRelationType,
  SLATarget,
  AssignmentRule,
} from '../../services/ticketing/types';

const VALID_STATUSES: TicketStatus[] = ['open', 'assigned', 'in-progress', 'resolved', 'closed'];
const VALID_PRIORITIES: TicketPriority[] = ['critical', 'high', 'medium', 'low'];
const VALID_CATEGORIES: TicketCategory[] = [
  'infrastructure', 'application', 'database', 'network',
  'security', 'deployment', 'pipeline', 'performance', 'cost', 'other',
];
const VALID_RELATION_TYPES: TicketRelationType[] = [
  'duplicate', 'caused-by', 'related', 'blocks', 'blocked-by',
];

export class TicketingController {
  private ticketService: TicketService;

  constructor(ticketService?: TicketService) {
    if (ticketService) {
      this.ticketService = ticketService;
    } else {
      this.ticketService = new TicketService();
    }
  }

  // ==================== Service Control ====================

  /**
   * Start ticketing service
   * POST /api/v1/ticketing/start
   */
  async startService(request: FastifyRequest, reply: FastifyReply) {
    try {
      await this.ticketService.start();
      await reply.status(200).send({
        success: true,
        message: 'Ticketing service started',
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'START_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Stop ticketing service
   * POST /api/v1/ticketing/stop
   */
  async stopService(request: FastifyRequest, reply: FastifyReply) {
    try {
      await this.ticketService.stop();
      await reply.status(200).send({
        success: true,
        message: 'Ticketing service stopped',
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'STOP_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Health check
   * GET /api/v1/ticketing/health
   */
  async healthCheck(request: FastifyRequest, reply: FastifyReply) {
    const health = this.ticketService.getHealthStatus();
    await reply.status(200).send({
      success: true,
      data: { health },
    });
  }

  // ==================== Ticket CRUD ====================

  /**
   * Create a ticket
   * POST /api/v1/tickets
   */
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

      const ticket = this.ticketService.createTicket({
        title,
        description,
        category,
        priority,
        reporter,
        tags,
        metadata,
      });

      await reply.status(201).send({
        success: true,
        data: { ticket },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'CREATE_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Create a ticket from alert
   * POST /api/v1/tickets/from-alert
   */
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
        alertId,
        metric,
        severity: severity || 'warning',
        message: message || '',
        tags,
        triggeredAt: triggeredAt ? new Date(triggeredAt) : new Date(),
        ruleName,
      });

      await reply.status(201).send({
        success: true,
        data: { ticket },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'CREATE_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Create a ticket from incident
   * POST /api/v1/tickets/from-incident
   */
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
        incidentId,
        title,
        description,
        severity: severity || 'medium',
        affectedServices,
        tags,
        reporter,
      });

      await reply.status(201).send({
        success: true,
        data: { ticket },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'CREATE_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Get a ticket
   * GET /api/v1/tickets/:id
   */
  async getTicket(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const ticket = this.ticketService.getTicket(params.id);

    if (!ticket) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Ticket ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { ticket },
    });
  }

  /**
   * List tickets
   * GET /api/v1/tickets
   */
  async listTickets(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;

    const tickets = this.ticketService.listTickets({
      status: query.status as TicketStatus,
      priority: query.priority as TicketPriority,
      category: query.category as TicketCategory,
      assignee: query.assignee,
      reporter: query.reporter,
    });

    await reply.status(200).send({
      success: true,
      data: { tickets, count: tickets.length },
    });
  }

  // ==================== Workflow ====================

  /**
   * Transition ticket status
   * POST /api/v1/tickets/:id/transition
   */
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

    const result = this.ticketService.transitionStatus(params.id, toStatus, performedBy, reason);

    if ('error' in result) {
      await reply.status(400).send({
        error: 'TRANSITION_ERROR',
        message: result.error,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { ticket: result.ticket },
    });
  }

  /**
   * Assign a ticket
   * POST /api/v1/tickets/:id/assign
   */
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

    const result = this.ticketService.assignTicket(params.id, assignee, assignedBy, reason);

    if ('error' in result) {
      await reply.status(400).send({
        error: 'ASSIGN_ERROR',
        message: result.error,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { ticket: result.ticket },
    });
  }

  /**
   * Escalate a ticket
   * POST /api/v1/tickets/:id/escalate
   */
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

    const result = this.ticketService.escalateTicket(params.id, escalatedBy, reason);

    if ('error' in result) {
      await reply.status(400).send({
        error: 'ESCALATION_ERROR',
        message: result.error,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { ticket: result.ticket },
    });
  }

  /**
   * Resolve a ticket
   * POST /api/v1/tickets/:id/resolve
   */
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

    const result = this.ticketService.resolveTicket(params.id, performedBy, resolutionNote);

    if ('error' in result) {
      await reply.status(400).send({
        error: 'RESOLVE_ERROR',
        message: result.error,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { ticket: result.ticket },
    });
  }

  /**
   * Close a ticket
   * POST /api/v1/tickets/:id/close
   */
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

    const result = this.ticketService.closeTicket(params.id, performedBy, reason);

    if ('error' in result) {
      await reply.status(400).send({
        error: 'CLOSE_ERROR',
        message: result.error,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { ticket: result.ticket },
    });
  }

  /**
   * Get workflow history
   * GET /api/v1/tickets/:id/history
   */
  async getWorkflowHistory(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const history = this.ticketService.getWorkflowHistory(params.id);

    await reply.status(200).send({
      success: true,
      data: { history },
    });
  }

  // ==================== Assignment Rules ====================

  /**
   * Add assignment rule
   * POST /api/v1/ticketing/rules
   */
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
        name,
        categories,
        assignee,
        priorities,
        enabled: enabled !== false,
        order: order ?? 0,
      };

      this.ticketService.addAssignmentRule(rule);

      await reply.status(201).send({
        success: true,
        data: { rule },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'RULE_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Get assignment rules
   * GET /api/v1/ticketing/rules
   */
  async getAssignmentRules(request: FastifyRequest, reply: FastifyReply) {
    const rules = this.ticketService.getAssignmentRules();
    await reply.status(200).send({
      success: true,
      data: { rules },
    });
  }

  /**
   * Remove assignment rule
   * DELETE /api/v1/ticketing/rules/:id
   */
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

    await reply.status(200).send({
      success: true,
      message: 'Assignment rule removed',
    });
  }

  // ==================== Relations ====================

  /**
   * Add ticket relation
   * POST /api/v1/tickets/:id/relations
   */
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
        params.id,
        relatedTicketId,
        relationType,
        createdBy,
        description,
        confidence
      );

      await reply.status(201).send({
        success: true,
        data: { relation },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'RELATION_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Get relations for a ticket
   * GET /api/v1/tickets/:id/relations
   */
  async getRelations(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const relations = this.ticketService.getRelationsForTicket(params.id);

    await reply.status(200).send({
      success: true,
      data: { relations },
    });
  }

  /**
   * Find related tickets
   * GET /api/v1/tickets/:id/related
   */
  async findRelatedTickets(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;

    const related = this.ticketService.findRelatedTickets(params.id, {
      maxResults: query.maxResults ? parseInt(query.maxResults) : undefined,
      minConfidence: query.minConfidence ? parseFloat(query.minConfidence) : undefined,
    });

    await reply.status(200).send({
      success: true,
      data: { related, count: related.length },
    });
  }

  /**
   * Detect duplicates
   * GET /api/v1/tickets/:id/duplicates
   */
  async detectDuplicates(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;

    const duplicates = this.ticketService.detectDuplicates(
      params.id,
      query.threshold ? parseFloat(query.threshold) : undefined
    );

    await reply.status(200).send({
      success: true,
      data: { duplicates, count: duplicates.length },
    });
  }

  /**
   * Correlate root cause
   * POST /api/v1/tickets/correlate
   */
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

    await reply.status(200).send({
      success: true,
      data: { correlation },
    });
  }

  // ==================== SLA ====================

  /**
   * Add SLA target
   * POST /api/v1/ticketing/sla
   */
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
        name,
        priority,
        targetResponseTimeMs: targetResponseTimeMs ?? 0,
        targetResolutionTimeMs,
        enabled: enabled !== false,
      };

      this.ticketService.addSLATarget(sla);

      await reply.status(201).send({
        success: true,
        data: { sla },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'SLA_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Get SLA for a ticket
   * GET /api/v1/tickets/:id/sla
   */
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

    await reply.status(200).send({
      success: true,
      data: { sla },
    });
  }

  // ==================== Reports ====================

  /**
   * Get SLA compliance report
   * GET /api/v1/tickets/reports/sla
   */
  async getSLACompliance(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;

    const report = this.ticketService.getSLACompliance(
      query.periodStart ? new Date(query.periodStart) : undefined,
      query.periodEnd ? new Date(query.periodEnd) : undefined
    );

    await reply.status(200).send({
      success: true,
      data: { report },
    });
  }

  /**
   * Get resolution time statistics
   * GET /api/v1/tickets/reports/resolution
   */
  async getResolutionStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = this.ticketService.getResolutionStats();

    await reply.status(200).send({
      success: true,
      data: { stats },
    });
  }

  /**
   * Get backlog analysis
   * GET /api/v1/tickets/reports/backlog
   */
  async getBacklogAnalysis(request: FastifyRequest, reply: FastifyReply) {
    const analysis = this.ticketService.getBacklogAnalysis();

    await reply.status(200).send({
      success: true,
      data: { analysis },
    });
  }

  /**
   * Get trend report
   * GET /api/v1/tickets/reports/trends
   */
  async getTrendReport(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;

    const report = this.ticketService.getTrendReport({
      days: query.days ? parseInt(query.days) : undefined,
      granularity: query.granularity,
    });

    await reply.status(200).send({
      success: true,
      data: { report },
    });
  }

  /**
   * Get overall statistics
   * GET /api/v1/tickets/reports/statistics
   */
  async getStatistics(request: FastifyRequest, reply: FastifyReply) {
    const stats = this.ticketService.getStatistics();

    await reply.status(200).send({
      success: true,
      data: { stats },
    });
  }
}
