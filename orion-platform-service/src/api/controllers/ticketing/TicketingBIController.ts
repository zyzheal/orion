/**
 * TASK-TICKET-XFER + TASK-TICKET-BI: Transfer, Suspend & BI Analytics Controller
 *
 * Handles:
 * - Ticket transfer endpoints
 * - Engineer suspension endpoints
 * - BI analytics dashboards and reports
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { TicketService } from '../../../services/ticketing/TicketService';
import { SuspendReason } from '../../../services/ticketing/types';

export class TicketingBIController {
  private ticketService: TicketService;

  constructor(ticketService: TicketService) {
    this.ticketService = ticketService;
  }

  // ==================== Transfer Endpoints ====================

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

    const result = await this.ticketService.transferTicket(
      params.ticketId, toEngineer, initiatedBy, reason
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

  async getTransferHistory(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const history = this.ticketService.getTransferHistory(params.ticketId);

    await reply.status(200).send({
      success: true,
      data: { history, count: history.length },
    });
  }

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

  // ==================== Suspend Endpoints ====================

  async createSuspend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const {
        engineerId, reason, startTime, endTime,
        backupEngineerId, autoReassignPending, pauseSLAForPending, notes, createdBy,
      } = body;

      if (!engineerId || !reason || !startTime || !endTime || !createdBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: engineerId, reason, startTime, endTime, createdBy',
        });
        return;
      }

      const validReasons: SuspendReason[] = ['vacation', 'sick-leave', 'training', 'reassignment', 'other'];
      if (!validReasons.includes(reason)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid reason. Must be one of: ${validReasons.join(', ')}`,
        });
        return;
      }

      const suspend = await this.ticketService.createSuspend({
        engineerId, reason,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        backupEngineerId,
        autoReassignPending: autoReassignPending || false,
        pauseSLAForPending: pauseSLAForPending || false,
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

  async activateSuspend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const suspend = await this.ticketService.activateSuspend(params.suspendId);

      if (!suspend) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Suspension ${params.suspendId} not found`,
        });
        return;
      }

      await reply.status(200).send({
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

  async endSuspend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const suspend = await this.ticketService.endSuspend(params.suspendId);

      if (!suspend) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Suspension ${params.suspendId} not found`,
        });
        return;
      }

      await reply.status(200).send({
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

  async cancelSuspend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const suspend = await this.ticketService.cancelSuspend(params.suspendId);

      if (!suspend) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Suspension ${params.suspendId} not found`,
        });
        return;
      }

      await reply.status(200).send({
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

  async listSuspensions(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const suspensions = await this.ticketService.listSuspensions(query.status);

    await reply.status(200).send({
      success: true,
      data: { suspensions, count: suspensions.length },
    });
  }

  async getSuspend(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const suspend = await this.ticketService.getSuspend(params.suspendId);

    if (!suspend) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Suspension ${params.suspendId} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { suspend },
    });
  }

  async getEngineerSuspensions(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const suspensions = await this.ticketService.getEngineerSuspensions(params.engineerId);

    await reply.status(200).send({
      success: true,
      data: { suspensions, count: suspensions.length },
    });
  }

  async getEngineerSuspendImpact(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const impact = await this.ticketService.getEngineerSuspendImpact(params.engineerId);

      if (!impact) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Engineer ${params.engineerId} not found or not suspended`,
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        data: { impact },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'IMPACT_ERROR',
        message: error.message,
      });
    }
  }

  // ==================== BI Analytics Endpoints ====================

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
        new Date(query.currentStart), new Date(query.currentEnd),
        new Date(query.previousStart), new Date(query.previousEnd)
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
