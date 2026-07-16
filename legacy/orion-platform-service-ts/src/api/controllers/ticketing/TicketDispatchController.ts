/**
 * TASK-802: Dispatch Controller
 *
 * Handles dispatch-related API endpoints:
 * - Engineer registration and management
 * - Auto/manual dispatch
 * - Dispatch queue management
 * - Dispatch rules and weights
 * - Load balancing and analytics
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { TicketService } from '../../../services/ticketing/TicketService';
import {
  EngineerProfile,
  DispatchWeights,
  DispatchRule,
} from '../../../services/ticketing/types';

export class TicketDispatchController {
  private ticketService: TicketService;

  constructor(ticketService: TicketService) {
    this.ticketService = ticketService;
  }

  // ==================== Engineer Management ====================

  async registerEngineer(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const {
        id, name, expertise, currentLoad, maxCapacity,
        availability, resolutionStats, skills, team, onCall,
      } = body;

      if (!id || !name || !expertise || maxCapacity === undefined) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: id, name, expertise, maxCapacity',
        });
        return;
      }

      const profile: EngineerProfile = {
        id, name, expertise,
        currentLoad: currentLoad ?? 0,
        maxCapacity,
        availability: availability || 'available',
        resolutionStats: resolutionStats || {
          totalResolved: 0, avgResolutionTimeMs: 0, slaComplianceRate: 0,
          resolutionByCategory: { incident: 0, request: 0, problem: 0, change: 0 },
          resolutionByPriority: { critical: 0, high: 0, medium: 0, low: 0 },
          escalationCount: 0,
        },
        skills, team, onCall,
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

  async listEngineers(request: FastifyRequest, reply: FastifyReply) {
    const engineers = await this.ticketService.dispatchEngine.listEngineers();

    await reply.status(200).send({
      success: true,
      data: { engineers, count: engineers.length },
    });
  }

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

  // ==================== Auto/Manual Dispatch ====================

  async autoDispatch(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const body = request.body as any || {};

      const result = await this.ticketService.autoDispatch(params.ticketId, {
        assignedBy: body.assignedBy,
        forceDispatch: body.forceDispatch,
      });

      if (!result) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Ticket not found or already assigned',
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        data: { dispatch: result },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'DISPATCH_ERROR',
        message: error.message,
      });
    }
  }

  async manualDispatch(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { engineerId, reason } = body;

      if (!engineerId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: engineerId',
        });
        return;
      }

      const result = await this.ticketService.manualDispatch(
        params.ticketId,
        engineerId,
        'api-user',
        reason
      );

      if (!result) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Ticket or engineer not found',
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        data: { dispatch: result },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'DISPATCH_ERROR',
        message: error.message,
      });
    }
  }

  async getBestMatch(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const result = await this.ticketService.findBestEngineerForTicket(params.ticketId);

      if (!result) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'No suitable engineer found or ticket not found',
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        data: { match: result },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'MATCH_ERROR',
        message: error.message,
      });
    }
  }

  async calculateDispatchScore(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { ticketId, engineerId } = body;

      if (!ticketId || !engineerId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: ticketId, engineerId',
        });
        return;
      }

      const score = await this.ticketService.calculateDispatchScore(ticketId, engineerId);

      if (!score) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Ticket or engineer not found',
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        data: { score },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'SCORE_ERROR',
        message: error.message,
      });
    }
  }

  // ==================== Dispatch Queue ====================

  async getDispatchQueueStatus(request: FastifyRequest, reply: FastifyReply) {
    const status = this.ticketService.getDispatchQueueStatus();

    await reply.status(200).send({
      success: true,
      data: { status },
    });
  }

  async getDispatchQueueEntries(request: FastifyRequest, reply: FastifyReply) {
    const entries = this.ticketService.getDispatchQueueEntries();

    await reply.status(200).send({
      success: true,
      data: { entries, count: entries.length },
    });
  }

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

  // ==================== Dispatch Rules ====================

  async addDispatchRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { name, condition, engineerId, priority } = body;

      if (!name || !condition) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, condition',
        });
        return;
      }

      const rule: DispatchRule = {
        id: `DR-${Date.now()}`,
        name,
        conditions: condition,
        assignee: engineerId || 'best-match',
        priority: priority || 0,
        enabled: true,
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

  async getDispatchRules(request: FastifyRequest, reply: FastifyReply) {
    const rules = this.ticketService.getDispatchRules();

    await reply.status(200).send({
      success: true,
      data: { rules, count: rules.length },
    });
  }

  async removeDispatchRule(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const removed = this.ticketService.removeDispatchRule(params.ruleId);

    if (!removed) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Dispatch rule ${params.ruleId} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      message: 'Dispatch rule removed',
    });
  }

  // ==================== Load Balancing ====================

  async getLoadBalanceReport(request: FastifyRequest, reply: FastifyReply) {
    const report = await this.ticketService.getLoadBalancingReport();

    await reply.status(200).send({
      success: true,
      data: { report },
    });
  }

  async getReassignmentSuggestions(request: FastifyRequest, reply: FastifyReply) {
    const suggestions = this.ticketService.getSuggestedReassignments();

    await reply.status(200).send({
      success: true,
      data: { suggestions },
    });
  }

  // ==================== Dispatch Reports ====================

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

  async getAllEngineerPerformances(request: FastifyRequest, reply: FastifyReply) {
    const performances = this.ticketService.getAllEngineerPerformances();

    await reply.status(200).send({
      success: true,
      data: { performances },
    });
  }

  // ==================== Dispatch Weights ====================

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

  async getDispatchWeights(request: FastifyRequest, reply: FastifyReply) {
    const weights = this.ticketService.getDispatchWeights();

    await reply.status(200).send({
      success: true,
      data: { weights },
    });
  }
}
