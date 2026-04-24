/**
 * TASK-801: Smart Ticketing Controller
 *
 * Handles API requests for ticket CRUD, workflow management,
 * assignment, relations, and reporting.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { TicketService } from '../../../services/ticketing/TicketService';
import { TicketingService, TicketingServiceError } from '../../../services/ticketing/TicketingService';
import type { CreateTicketInput } from '../../../services/ticketing/TicketingRepository';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketRelationType,
  SLATarget,
  AssignmentRule,
  EngineerProfile,
  DispatchWeights,
  DispatchRule,
  SuspendReason,
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

export class TicketingController {
  private ticketService: TicketService;
  private ticketingService?: TicketingService;

  constructor(ticketService?: TicketService, ticketingService?: TicketingService) {
    if (ticketService) {
      this.ticketService = ticketService;
    } else {
      this.ticketService = new TicketService();
    }
    this.ticketingService = ticketingService;
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

      // Use PostgreSQL-backed TicketingService when available
      if (this.ticketingService) {
        const input: CreateTicketInput = {
          tenant_id: (body as any).tenantId || 'default',
          title,
          description,
          type: category,
          priority,
          reporter_id: reporter,
          tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        };
        const ticket = await this.ticketingService.createTicket(input);
        await reply.status(201).send({
          success: true,
          data: { ticket },
        });
        return;
      }

      // Fallback to in-memory TicketService
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
      if (error instanceof TicketingServiceError) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: error.message,
        });
        return;
      }
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

    // Use PostgreSQL-backed TicketingService when available
    if (this.ticketingService) {
      try {
        const ticket = await this.ticketingService.getTicket(params.id);
        await reply.status(200).send({
          success: true,
          data: { ticket },
        });
      } catch (error: any) {
        if (error instanceof TicketingServiceError && error.code === 'NOT_FOUND') {
          await reply.status(404).send({
            error: 'NOT_FOUND',
            message: `Ticket ${params.id} not found`,
          });
        } else {
          await reply.status(500).send({
            error: 'FETCH_ERROR',
            message: error.message,
          });
        }
      }
      return;
    }

    // Fallback to in-memory TicketService
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
    const page = query.page ? parseInt(query.page) : 1;
    const limit = query.limit ? parseInt(query.limit) : 20;

    // Use PostgreSQL-backed TicketingService when available
    if (this.ticketingService) {
      try {
        const result = await this.ticketingService.listTickets({
          page,
          limit,
          tenantId: query.tenantId,
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
        await reply.status(500).send({
          error: 'LIST_ERROR',
          message: error.message,
        });
      }
      return;
    }

    // Fallback to in-memory TicketService
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

  // ==================== TASK-802: Dispatch Endpoints ====================

  /**
   * Register an engineer
   * POST /api/v1/tickets/dispatch/engineers
   */
  async registerEngineer(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const {
        id,
        name,
        expertise,
        currentLoad,
        maxCapacity,
        availability,
        resolutionStats,
        skills,
        team,
        onCall,
      } = body;

      if (!id || !name || !expertise || maxCapacity === undefined) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: id, name, expertise, maxCapacity',
        });
        return;
      }

      const profile: EngineerProfile = {
        id,
        name,
        expertise,
        currentLoad: currentLoad ?? 0,
        maxCapacity,
        availability: availability || 'available',
        resolutionStats: resolutionStats || {
          totalResolved: 0,
          avgResolutionTimeMs: 0,
          slaComplianceRate: 0,
          resolutionByCategory: {} as any,
          resolutionByPriority: {} as any,
          escalationCount: 0,
        },
        skills,
        team,
        onCall,
      };

      this.ticketService.registerEngineer(profile);

      await reply.status(201).send({
        success: true,
        data: { engineer: profile },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'REGISTER_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * List engineers
   * GET /api/v1/tickets/dispatch/engineers
   */
  async listEngineers(request: FastifyRequest, reply: FastifyReply) {
    const engineers = this.ticketService.dispatchEngine.listEngineers();

    await reply.status(200).send({
      success: true,
      data: { engineers, count: engineers.length },
    });
  }

  /**
   * Get engineer detail
   * GET /api/v1/tickets/dispatch/engineers/:id
   */
  async getEngineer(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const engineer = this.ticketService.dispatchEngine.getEngineer(params.id);

    if (!engineer) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Engineer ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { engineer },
    });
  }

  /**
   * Auto-dispatch a ticket
   * POST /api/v1/tickets/dispatch/auto/:ticketId
   */
  async autoDispatch(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};

    const result = this.ticketService.autoDispatch(params.ticketId, {
      assignedBy: body.assignedBy,
      weights: body.weights,
      forceDispatch: body.forceDispatch,
    });

    if (!result) {
      await reply.status(400).send({
        error: 'DISPATCH_ERROR',
        message: `No suitable engineer found for ticket ${params.ticketId}`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { dispatch: result },
    });
  }

  /**
   * Manual dispatch
   * POST /api/v1/tickets/dispatch/manual/:ticketId
   */
  async manualDispatch(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};
    const { engineerId, assignedBy, reason } = body;

    if (!engineerId || !assignedBy) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: engineerId, assignedBy',
      });
      return;
    }

    const result = this.ticketService.manualDispatch(
      params.ticketId,
      engineerId,
      assignedBy,
      reason
    );

    if (!result) {
      await reply.status(400).send({
        error: 'DISPATCH_ERROR',
        message: `Failed to dispatch ticket ${params.ticketId} to ${engineerId}`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { dispatch: result },
    });
  }

  /**
   * Find best engineer for a ticket
   * GET /api/v1/tickets/dispatch/best-match/:ticketId
   */
  async findBestMatch(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const result = this.ticketService.findBestEngineerForTicket(params.ticketId);

    if (!result) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `No matching engineer found for ticket ${params.ticketId}`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: {
        engineer: result.engineer,
        score: result.score,
        breakdown: result.breakdown,
      },
    });
  }

  /**
   * Calculate dispatch score
   * POST /api/v1/tickets/dispatch/score
   */
  async calculateDispatchScore(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any || {};
    const { ticketId, engineerId } = body;

    if (!ticketId || !engineerId) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: ticketId, engineerId',
      });
      return;
    }

    const result = this.ticketService.calculateDispatchScore(ticketId, engineerId);

    if (!result) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Ticket or engineer not found',
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: result,
    });
  }

  /**
   * Get dispatch queue status
   * GET /api/v1/tickets/dispatch/queue/status
   */
  async getDispatchQueueStatus(request: FastifyRequest, reply: FastifyReply) {
    const status = this.ticketService.getDispatchQueueStatus();

    await reply.status(200).send({
      success: true,
      data: { queue: status },
    });
  }

  /**
   * Get dispatch queue entries
   * GET /api/v1/tickets/dispatch/queue/entries
   */
  async getDispatchQueueEntries(request: FastifyRequest, reply: FastifyReply) {
    const entries = this.ticketService.getDispatchQueueEntries();

    await reply.status(200).send({
      success: true,
      data: { entries, count: entries.length },
    });
  }

  /**
   * Get SLA alerts
   * GET /api/v1/tickets/dispatch/sla-alerts
   */
  async getSLAAlerts(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const alerts = this.ticketService.getDispatchSLAAlerts({
      type: query.type,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });

    await reply.status(200).send({
      success: true,
      data: { alerts, count: alerts.length },
    });
  }

  /**
   * Add dispatch rule
   * POST /api/v1/tickets/dispatch/rules
   */
  async addDispatchRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { id, name, conditions, assignee, priority, enabled } = body;

      if (!name || !conditions || !assignee) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, conditions, assignee',
        });
        return;
      }

      const rule: DispatchRule = {
        id: id || `dispatch-rule-${Date.now()}`,
        name,
        conditions,
        assignee,
        priority: priority ?? 0,
        enabled: enabled !== false,
      };

      this.ticketService.addDispatchRule(rule);

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
   * Get dispatch rules
   * GET /api/v1/tickets/dispatch/rules
   */
  async getDispatchRules(request: FastifyRequest, reply: FastifyReply) {
    const rules = this.ticketService.getDispatchRules();

    await reply.status(200).send({
      success: true,
      data: { rules },
    });
  }

  /**
   * Get load balancing report
   * GET /api/v1/tickets/dispatch/load-balance/report
   */
  async getLoadBalanceReport(request: FastifyRequest, reply: FastifyReply) {
    const report = this.ticketService.getLoadBalancingReport();

    await reply.status(200).send({
      success: true,
      data: { report },
    });
  }

  /**
   * Get reassignment suggestions
   * GET /api/v1/tickets/dispatch/load-balance/suggestions
   */
  async getReassignmentSuggestions(request: FastifyRequest, reply: FastifyReply) {
    const suggestions = this.ticketService.getSuggestedReassignments();

    await reply.status(200).send({
      success: true,
      data: { suggestions },
    });
  }

  /**
   * Get dispatch metrics
   * GET /api/v1/tickets/dispatch/reports/metrics
   */
  async getDispatchMetrics(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const metrics = this.ticketService.getDispatchMetrics({
      periodStart: query.periodStart ? new Date(query.periodStart) : undefined,
      periodEnd: query.periodEnd ? new Date(query.periodEnd) : undefined,
    });

    await reply.status(200).send({
      success: true,
      data: { metrics },
    });
  }

  /**
   * Get assignment success metrics
   * GET /api/v1/tickets/dispatch/reports/assignment-success
   */
  async getAssignmentSuccessMetrics(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const metrics = this.ticketService.getAssignmentSuccessMetrics({
      periodStart: query.periodStart ? new Date(query.periodStart) : undefined,
      periodEnd: query.periodEnd ? new Date(query.periodEnd) : undefined,
    });

    await reply.status(200).send({
      success: true,
      data: { metrics },
    });
  }

  /**
   * Get time-to-assignment stats
   * GET /api/v1/tickets/dispatch/reports/time-to-assignment
   */
  async getTimeToAssignmentStats(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const stats = this.ticketService.getTimeToAssignmentStats({
      periodStart: query.periodStart ? new Date(query.periodStart) : undefined,
      periodEnd: query.periodEnd ? new Date(query.periodEnd) : undefined,
    });

    await reply.status(200).send({
      success: true,
      data: { stats },
    });
  }

  /**
   * Get engineer performance
   * GET /api/v1/tickets/dispatch/reports/performance/:engineerId
   */
  async getEngineerPerformance(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const performance = this.ticketService.getEngineerPerformance(params.engineerId);

    if (!performance) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Performance data for engineer ${params.engineerId} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { performance },
    });
  }

  /**
   * Get all engineer performances
   * GET /api/v1/tickets/dispatch/reports/performance
   */
  async getAllEngineerPerformances(request: FastifyRequest, reply: FastifyReply) {
    const performances = this.ticketService.getAllEngineerPerformances();

    await reply.status(200).send({
      success: true,
      data: { performances },
    });
  }

  /**
   * Update dispatch weights
   * PUT /api/v1/tickets/dispatch/weights
   */
  async updateDispatchWeights(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any || {};
    const { expertise, workload, availability, successRate, slaUrgency } = body;

    const weights: Partial<DispatchWeights> = {};
    if (expertise !== undefined) weights.expertise = expertise;
    if (workload !== undefined) weights.workload = workload;
    if (availability !== undefined) weights.availability = availability;
    if (successRate !== undefined) weights.successRate = successRate;
    if (slaUrgency !== undefined) weights.slaUrgency = slaUrgency;

    if (Object.keys(weights).length === 0) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'No valid weights provided',
      });
      return;
    }

    this.ticketService.updateDispatchWeights(weights);

    await reply.status(200).send({
      success: true,
      data: { weights: this.ticketService.getDispatchWeights() },
    });
  }

  /**
   * Get dispatch weights
   * GET /api/v1/tickets/dispatch/weights
   */
  async getDispatchWeights(request: FastifyRequest, reply: FastifyReply) {
    const weights = this.ticketService.getDispatchWeights();

    await reply.status(200).send({
      success: true,
      data: { weights },
    });
  }

  // ==================== TASK-TICKET-XFER: Transfer Endpoints ====================

  /**
   * Transfer a ticket to another engineer
   * POST /api/v1/tickets/transfer/:ticketId
   */
  async transferTicket(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};
    const { toEngineer, initiatedBy, reason } = body;

    if (!toEngineer || !initiatedBy || !reason) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: toEngineer, initiatedBy, reason',
      });
      return;
    }

    const result = this.ticketService.transferTicket(
      params.ticketId,
      toEngineer,
      initiatedBy,
      reason
    );

    if ('error' in result) {
      await reply.status(400).send({
        error: 'TRANSFER_ERROR',
        message: result.error,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { transfer: result.transfer, holdDurationMs: result.holdDurationMs },
    });
  }

  /**
   * Get transfer history for a ticket
   * GET /api/v1/tickets/transfer/:ticketId/history
   */
  async getTransferHistory(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const history = this.ticketService.getTransferHistory(params.ticketId);

    await reply.status(200).send({
      success: true,
      data: { history, count: history.length },
    });
  }

  /**
   * Get transfer statistics
   * GET /api/v1/tickets/transfer/stats
   */
  async getTransferStats(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const stats = this.ticketService.getTransferStats(
      query.periodStart ? new Date(query.periodStart) : undefined,
      query.periodEnd ? new Date(query.periodEnd) : undefined
    );

    await reply.status(200).send({
      success: true,
      data: { stats },
    });
  }

  // ==================== TASK-TICKET-XFER: Suspend Endpoints ====================

  /**
   * Create a suspension
   * POST /api/v1/tickets/suspend
   */
  async createSuspend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const {
        engineerId,
        reason,
        startTime,
        endTime,
        backupEngineerId,
        autoReassignPending,
        pauseSLAForPending,
        notes,
        createdBy,
      } = body;

      if (!engineerId || !reason || !startTime || !endTime || !createdBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: engineerId, reason, startTime, endTime, createdBy',
        });
        return;
      }

      const validReasons: SuspendReason[] = ['leave', 'sick', 'training', 'offline', 'other'];
      if (!validReasons.includes(reason)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid reason. Must be one of: ${validReasons.join(', ')}`,
        });
        return;
      }

      const suspend = this.ticketService.createSuspend({
        engineerId,
        reason,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        backupEngineerId,
        autoReassignPending,
        pauseSLAForPending,
        notes,
        createdBy,
      });

      await reply.status(201).send({
        success: true,
        data: { suspend },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'SUSPEND_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Activate a suspension
   * POST /api/v1/tickets/suspend/:id/activate
   */
  async activateSuspend(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const result = this.ticketService.activateSuspend(params.id);

    if (!result) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Suspend ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { suspend: result },
    });
  }

  /**
   * End a suspension
   * POST /api/v1/tickets/suspend/:id/end
   */
  async endSuspend(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const result = this.ticketService.endSuspend(params.id);

    if (!result) {
      await reply.status(400).send({
        error: 'SUSPEND_ERROR',
        message: `Cannot end suspend ${params.id}. It may not be active or not found.`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { suspend: result },
    });
  }

  /**
   * Cancel a suspension
   * POST /api/v1/tickets/suspend/:id/cancel
   */
  async cancelSuspend(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const result = this.ticketService.cancelSuspend(params.id);

    if (!result) {
      await reply.status(400).send({
        error: 'SUSPEND_ERROR',
        message: `Cannot cancel suspend ${params.id}. It may not be scheduled or not found.`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { suspend: result },
    });
  }

  /**
   * List suspensions
   * GET /api/v1/tickets/suspend
   */
  async listSuspensions(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const status = query.status;

    let suspensions;
    if (status === 'active') {
      suspensions = this.ticketService.getActiveSuspensions();
    } else if (status === 'scheduled') {
      suspensions = this.ticketService.getScheduledSuspensions();
    } else {
      // Return all: combine active + scheduled + completed + cancelled
      const active = this.ticketService.getActiveSuspensions();
      const scheduled = this.ticketService.getScheduledSuspensions();
      suspensions = [...active, ...scheduled];
    }

    await reply.status(200).send({
      success: true,
      data: { suspensions, count: suspensions.length },
    });
  }

  /**
   * Get suspension by ID
   * GET /api/v1/tickets/suspend/:id
   */
  async getSuspend(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const suspend = this.ticketService.getSuspend(params.id);

    if (!suspend) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Suspend ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { suspend },
    });
  }

  /**
   * Get suspensions for an engineer
   * GET /api/v1/tickets/suspend/engineer/:engineerId
   */
  async getEngineerSuspensions(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const suspensions = this.ticketService.getEngineerSuspensions(params.engineerId);

    await reply.status(200).send({
      success: true,
      data: { suspensions, count: suspensions.length },
    });
  }

  /**
   * Get suspension impact for an engineer
   * GET /api/v1/tickets/suspend/engineer/:engineerId/impact
   */
  async getEngineerSuspendImpact(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;
    const suspendId = query.suspendId;

    if (!suspendId) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required query param: suspendId',
      });
      return;
    }

    try {
      const impact = this.ticketService.analyzeSuspendImpact(suspendId);

      await reply.status(200).send({
        success: true,
        data: { impact },
      });
    } catch (error: any) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: error.message,
      });
    }
  }

  // ==================== TASK-TICKET-BI: BI Analytics Endpoints ====================

  /**
   * Get executive dashboard
   * GET /api/v1/tickets/bi/dashboard/executive
   */
  async getExecutiveDashboard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const dashboard = this.ticketService.getExecutiveDashboard({
        periodStart: query.periodStart ? new Date(query.periodStart) : undefined,
        periodEnd: query.periodEnd ? new Date(query.periodEnd) : undefined,
        granularity: query.granularity,
      });

      await reply.status(200).send({
        success: true,
        data: { dashboard },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'BI_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Get manager dashboard
   * GET /api/v1/tickets/bi/dashboard/manager
   */
  async getManagerDashboard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const dashboard = this.ticketService.getManagerDashboard({
        periodStart: query.periodStart ? new Date(query.periodStart) : undefined,
        periodEnd: query.periodEnd ? new Date(query.periodEnd) : undefined,
        granularity: query.granularity,
      });

      await reply.status(200).send({
        success: true,
        data: { dashboard },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'BI_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Get engineer personal dashboard
   * GET /api/v1/tickets/bi/dashboard/engineer/:engineerId
   */
  async getEngineerDashboard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const query = request.query as any;

      const dashboard = this.ticketService.getEngineerDashboard(params.engineerId, {
        periodStart: query.periodStart ? new Date(query.periodStart) : undefined,
        periodEnd: query.periodEnd ? new Date(query.periodEnd) : undefined,
        granularity: query.granularity,
      });

      if (!dashboard) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Engineer ${params.engineerId} not found`,
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        data: { dashboard },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'BI_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Get engineer efficiency metrics
   * GET /api/v1/tickets/bi/efficiency/:engineerId
   */
  async getEngineerEfficiency(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const query = request.query as any;

      const metrics = this.ticketService.getEngineerEfficiency(
        params.engineerId,
        query.granularity || 'day',
        query.periodStart ? new Date(query.periodStart) : undefined,
        query.periodEnd ? new Date(query.periodEnd) : undefined
      );

      await reply.status(200).send({
        success: true,
        data: { metrics },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'BI_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Get engineer efficiency score
   * GET /api/v1/tickets/bi/score/:engineerId
   */
  async getEfficiencyScore(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const query = request.query as any;

      const score = this.ticketService.getEfficiencyScore(
        params.engineerId,
        query.periodStart ? new Date(query.periodStart) : undefined,
        query.periodEnd ? new Date(query.periodEnd) : undefined
      );

      await reply.status(200).send({
        success: true,
        data: { score },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'BI_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Compare periods
   * GET /api/v1/tickets/bi/compare
   */
  async comparePeriods(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;

      if (!query.currentStart || !query.currentEnd || !query.previousStart || !query.previousEnd) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required query params: currentStart, currentEnd, previousStart, previousEnd',
        });
        return;
      }

      const comparison = this.ticketService.comparePeriods(
        new Date(query.currentStart),
        new Date(query.currentEnd),
        new Date(query.previousStart),
        new Date(query.previousEnd)
      );

      await reply.status(200).send({
        success: true,
        data: { comparison },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'BI_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Export BI data
   * POST /api/v1/tickets/bi/export
   */
  async exportBIData(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { dataset, granularity, periodStart, periodEnd } = body;

      if (!dataset) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: dataset',
        });
        return;
      }

      const validDatasets = ['tickets', 'sla', 'dispatch', 'efficiency'];
      if (!validDatasets.includes(dataset)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid dataset. Must be one of: ${validDatasets.join(', ')}`,
        });
        return;
      }

      const exported = this.ticketService.exportBIData({
        dataset,
        granularity: granularity || 'day',
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      });

      await reply.status(200).send({
        success: true,
        data: { export: exported },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'BI_EXPORT_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Get time trend
   * GET /api/v1/tickets/bi/trend
   */
  async getTimeTrend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;

      const trend = this.ticketService.getBITimeTrend({
        metric: query.metric || 'volume',
        start: query.start ? new Date(query.start) : undefined,
        end: query.end ? new Date(query.end) : undefined,
        granularity: query.granularity || 'day',
      });

      await reply.status(200).send({
        success: true,
        data: { trend },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'BI_ERROR',
        message: error.message,
      });
    }
  }
}
