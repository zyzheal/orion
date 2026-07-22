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
import { getFaultTypes, getFaultConfigTemplate, validateFaultConfig } from '../../services/chaos-engineering/ChaosFaultLibrary';
import { ResilienceScoringService } from '../../services/chaos-engineering/ResilienceScoringService';
import {
  ChaosExperimentService,
  CreateExperimentInput,
  ChaosFault,
} from '../../services/chaos-engineering/ChaosExperimentService';
import { FaultInjector, FaultInjectionConfig, InjectionResult } from '../../services/chaos-engineering/FaultInjector';
import { DatabasePool } from '../../services/database';

export class ChaosEngineeringController extends BaseController {
  private scoringService: ResilienceScoringService | null = null;
  private chaosExperimentService: ChaosExperimentService | null = null;
  private faultInjector: FaultInjector | null = null;

  constructor(database?: DatabasePool) {
    super();
    if (database) {
      this.scoringService = new ResilienceScoringService(database);
      this.chaosExperimentService = new ChaosExperimentService(database);
      this.faultInjector = new FaultInjector();
    }
  }

  async createExperiment(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.chaosExperimentService) {
        return reply.status(503).send({ success: false, error: 'Chaos experiment service not available' });
      }
      const tenantId = this.getTenantId(request);
      const body = request.body as any;

      const faults: ChaosFault[] = (body.faults || []).map((f: any) => ({
        type: f.type,
        target: f.target || body.target || '',
        config: f.config || {},
        duration_ms: f.duration_ms || 60000,
        delay_ms: f.delay_ms || 0,
      }));

      // Validate each fault config against the library
      const validationErrors: string[] = [];
      for (const f of faults) {
        const errs = validateFaultConfig(f.type, f.config);
        validationErrors.push(...errs);
      }
      if (validationErrors.length > 0) {
        return reply.status(400).send({ success: false, errors: validationErrors });
      }

      const input: CreateExperimentInput = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description,
        scope: {
          tenant_id: tenantId,
          service_id: body.serviceId,
          environment: body.environment || 'staging',
        },
        faults,
        steady_state_hypothesis: body.steadyStateHypothesis,
        auto_rollback: body.autoRollback ?? true,
        created_by: body.createdBy || null,
      };

      const experiment = await this.chaosExperimentService.createExperiment(input);
      reply.status(201).send({ success: true, data: experiment });
    } catch (error: any) {
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  async listExperiments(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.chaosExperimentService) {
        return reply.status(503).send({ success: false, error: 'Chaos experiment service not available' });
      }
      const tenantId = this.getTenantId(request);
      const query = request.query as any;

      const result = await this.chaosExperimentService.listExperiments({
        tenant_id: tenantId,
        status: query.status,
      });
      reply.send({ success: true, data: result });
    } catch (error: any) {
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  async getExperiment(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.chaosExperimentService) {
        return reply.status(503).send({ success: false, error: 'Chaos experiment service not available' });
      }
      const { id } = request.params as { id: string };

      const experiment = await this.chaosExperimentService.getExperiment(id);

      // Get runs for this experiment
      const repo = (this.chaosExperimentService as any).repository;
      const runs = await repo.listRuns(id);

      reply.send({ success: true, data: { ...experiment, runs } });
    } catch (error: any) {
      if (error.code === 'EXPERIMENT_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: error.message });
      }
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  async startExperiment(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.chaosExperimentService) {
        return reply.status(503).send({ success: false, error: 'Chaos experiment service not available' });
      }
      const tenantId = this.getTenantId(request);
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const experiment = await this.chaosExperimentService.getExperiment(id);
      if (experiment.tenant_id !== tenantId) {
        return reply.status(403).send({ success: false, error: 'Tenant isolation violation: experiment does not belong to your tenant' });
      }

      await this.chaosExperimentService.activateExperiment(id);

      const result = await this.chaosExperimentService.runExperiment(id, {
        dry_run: body?.dry_run ?? false,
      });

      reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      if (error.code === 'EXPERIMENT_NOT_FOUND' || error.code === 'INVALID_STATUS') {
        return reply.status(400).send({ success: false, error: error.message });
      }
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  async injectFault(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.faultInjector) {
        return reply.status(503).send({ success: false, error: 'Fault injector not available' });
      }
      const tenantId = this.getTenantId(request);
      const { id } = request.params as { id: string };
      const body = request.body as any;

      if (!body.type || !body.target) {
        return reply.status(400).send({ success: false, error: 'type and target are required' });
      }

      // Verify experiment belongs to requesting tenant
      if (this.chaosExperimentService) {
        try {
          const experiment = await this.chaosExperimentService.getExperiment(id);
          if (experiment.tenant_id !== tenantId) {
            return reply.status(403).send({ success: false, error: 'Tenant isolation violation: experiment does not belong to your tenant' });
          }
        } catch {
          // Experiment not found; continue with injection but without tenant verification
        }
      }

      const config: FaultInjectionConfig = {
        type: body.type,
        target: body.target,
        config: body.config || {},
        duration_ms: body.duration_ms || 60000,
      };

      const result: InjectionResult = await this.faultInjector.inject(config);

      // Record the fault injection as a run event if the experiment service is available
      if (this.chaosExperimentService) {
        try {
          const run = await this.chaosExperimentService.getRun(id);
          await this.chaosExperimentService.addRunEvent(run.id, {
            timestamp: new Date(),
            type: 'inject',
            service: body.target,
            details: `Fault ${body.type} injected`,
          });
        } catch {
          // Experiment run may not exist; ignore
        }
      }

      reply.send({ success: true, data: result });
    } catch (error: any) {
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  async stopExperiment(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.chaosExperimentService) {
        return reply.status(503).send({ success: false, error: 'Chaos experiment service not available' });
      }
      const tenantId = this.getTenantId(request);
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const experiment = await this.chaosExperimentService.getExperiment(id);
      if (experiment.tenant_id !== tenantId) {
        return reply.status(403).send({ success: false, error: 'Tenant isolation violation: experiment does not belong to your tenant' });
      }

      // Try to rollback any running execution
      try {
        await this.chaosExperimentService.rollbackRun(id, body.reason);
      } catch {
        // If no running run exists, just mark the experiment as completed
        if (experiment.status === 'active') {
          await (this.chaosExperimentService as any).repository.updateStatus(id, 'completed');
        }
      }

      reply.send({ success: true, data: { id: experiment.id, status: experiment.status, stoppedAt: new Date().toISOString() } });
    } catch (error: any) {
      reply.status(500).send({ success: false, error: error.message });
    }
  }

  async getExperimentStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!this.chaosExperimentService) {
        return reply.status(503).send({ success: false, error: 'Chaos experiment service not available' });
      }
      const tenantId = this.getTenantId(request);
      const { id } = request.params as { id: string };

      const experiment = await this.chaosExperimentService.getExperiment(id);
      if (experiment.tenant_id !== tenantId) {
        return reply.status(403).send({ success: false, error: 'Tenant isolation violation: experiment does not belong to your tenant' });
      }

      // Get the latest run status
      const repo = (this.chaosExperimentService as any).repository;
      const runs = await repo.listRuns(id);
      const latestRun = runs.length > 0 ? runs[0] : null;

      reply.send({
        success: true,
        data: {
          id: experiment.id,
          status: experiment.status,
          latest_run: latestRun ? {
            id: latestRun.id,
            status: latestRun.status,
            started_at: latestRun.started_at,
            ended_at: latestRun.ended_at,
          } : null,
        },
      });
    } catch (error: any) {
      if (error.code === 'EXPERIMENT_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: error.message });
      }
      reply.status(500).send({ success: false, error: error.message });
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
