/**
 * ChaosEngineeringController - 混沌工程 API 控制器
 *
 * Extended with:
 * - Resilience scoring endpoints
 * - Chaos experiment scheduling
 * - Pre-deployment chaos verification
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { getFaultTypes, getFaultConfigTemplate } from '../../services/chaos-engineering/ChaosFaultLibrary';
import { ResilienceScoringService } from '../../services/chaos-engineering/ResilienceScoringService';
import { DatabasePool } from '../../services/database';

export class ChaosEngineeringController extends BaseController {
  private scoringService: ResilienceScoringService | null = null;

  constructor(database?: DatabasePool) {
    super();
    if (database) {
      this.scoringService = new ResilienceScoringService(database);
    }
  }

  async createExperiment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as any;
      reply.status(201).send({
        success: true,
        data: { id: `chaos-${Date.now()}`, tenantId, ...body, status: 'created' },
      });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async listExperiments(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      reply.send({ success: true, data: { experiments: [], tenantId } });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async getExperiment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      reply.send({ success: true, data: { id, status: 'running' } });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async startExperiment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      reply.send({ success: true, data: { id, status: 'started', startedAt: new Date().toISOString() } });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async injectFault(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      reply.send({ success: true, data: { experimentId: id, faultInjected: true, faultType: body.faultType } });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async stopExperiment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      reply.send({ success: true, data: { id, status: 'stopped', stoppedAt: new Date().toISOString() } });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async getExperimentStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      reply.send({ success: true, data: { id, status: 'running' } });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async getRecoveryStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      reply.send({ success: true, data: { experimentId: id, recovered: true, checks: [] } });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async getFaultTypes(request: FastifyRequest, reply: FastifyReply) {
    try {
      const faults = getFaultTypes();
      reply.send({ success: true, data: faults });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async getFaultConfigTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { type } = request.params as { type: string };
      const template = getFaultConfigTemplate(type);
      reply.send({ success: true, data: template });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  // ==================== Resilience Scoring Endpoints ====================

  async getResilienceScore(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.scoringService) {
        return reply.status(503).send({ success: false, error: 'Scoring service not available' });
      }
      const tenantId = this.getTenantId(request);
      const query = request.query as any;
      const serviceId = query.serviceId;

      const breakdown = await this.scoringService.getScoreBreakdown(tenantId, serviceId);
      reply.send({ success: true, data: breakdown });
    } catch (error: any) {
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  async calculateResilienceScore(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.scoringService) {
        return reply.status(503).send({ success: false, error: 'Scoring service not available' });
      }
      const tenantId = this.getTenantId(request);
      const body = request.body as any;

      const score = await this.scoringService.calculateEnhancedScore(tenantId, body.serviceId);
      reply.send({ success: true, data: score });
    } catch (error: any) {
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  async getScoreHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      reply.send({ success: true, data: { history: [], tenantId } });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  // ==================== Chaos Experiment Scheduling ====================

  async createSchedule(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.scoringService) {
        return reply.status(503).send({ success: false, error: 'Scheduling service not available' });
      }
      const { experimentId } = request.params as { experimentId: string };
      const body = request.body as any;

      const schedule = await this.scoringService.createSchedule(experimentId, body.cronExpression, {
        timezone: body.timezone,
        maxRuns: body.maxRuns,
      });

      reply.status(201).send({ success: true, data: schedule });
    } catch (error: any) {
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  async listSchedules(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.scoringService) {
        return reply.status(503).send({ success: false, error: 'Scheduling service not available' });
      }
      const tenantId = this.getTenantId(request);
      const query = request.query as any;

      const schedules = await this.scoringService.listSchedules(tenantId, query.enabled === 'true');
      reply.send({ success: true, data: schedules });
    } catch (error: any) {
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  async toggleSchedule(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.scoringService) {
        return reply.status(503).send({ success: false, error: 'Scheduling service not available' });
      }
      const { scheduleId } = request.params as { scheduleId: string };
      const body = request.body as any;

      const schedule = await this.scoringService.toggleSchedule(scheduleId, body.enabled ?? true);
      reply.send({ success: true, data: schedule });
    } catch (error: any) {
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  // ==================== Pre-Deployment Verification ====================

  async preDeployVerify(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.scoringService) {
        return reply.status(503).send({ success: false, error: 'Verification service not available' });
      }
      const tenantId = this.getTenantId(request);
      const { serviceId } = request.params as { serviceId: string };

      const result = await this.scoringService.preDeployVerification(tenantId, serviceId);
      reply.send({ success: true, data: result });
    } catch (error: any) {
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  async getResilienceDashboard(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.scoringService) {
        return reply.status(503).send({ success: false, error: 'Scoring service not available' });
      }
      const tenantId = this.getTenantId(request);

      const breakdown = await this.scoringService.getScoreBreakdown(tenantId);
      reply.send({ success: true, data: breakdown });
    } catch (error: any) {
      reply.status(500).send({ success: false, error: error.message });
    }
  }
}
