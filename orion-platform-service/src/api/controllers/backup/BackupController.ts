/**
 * TASK-704: Backup & Recovery Controller
 *
 * Handles API requests for backup management, verification,
 * recovery plans, and health monitoring.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  BackupService,
  BackupType,
  BackupStatus,
  BackupSourceType,
} from '../../../services/backup';

export class BackupController {
  private backupService: BackupService;

  constructor(backupService?: BackupService) {
    if (backupService) {
      this.backupService = backupService;
    } else {
      this.backupService = new BackupService();
    }
  }

  // ==================== Service Control ====================

  async startService(request: FastifyRequest, reply: FastifyReply) {
    try {
      await this.backupService.start();
      await reply.status(200).send({
        success: true,
        message: 'Backup service started',
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'START_ERROR',
        message: error.message,
      });
    }
  }

  async stopService(request: FastifyRequest, reply: FastifyReply) {
    try {
      await this.backupService.stop();
      await reply.status(200).send({
        success: true,
        message: 'Backup service stopped',
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'STOP_ERROR',
        message: error.message,
      });
    }
  }

  async healthCheck(request: FastifyRequest, reply: FastifyReply) {
    const health = this.backupService.getHealthStatus();
    await reply.status(200).send({
      success: true,
      data: { health },
    });
  }

  // ==================== Backup Plans ====================

  async createPlan(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const {
        id,
        name,
        type,
        schedule,
        retention,
        sources,
        enabled,
        compress,
        encrypt,
        description,
      } = body;

      if (!name || !type || !schedule || !sources) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, type, schedule, sources',
        });
        return;
      }

      const validTypes: BackupType[] = ['full', 'incremental', 'differential'];
      if (!validTypes.includes(type)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      if (!schedule.cronExpression) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing schedule.cronExpression',
        });
        return;
      }

      const validSources: BackupSourceType[] = ['database', 'filesystem', 'config', 'all'];
      if (!Array.isArray(sources) || !sources.every((s: string) => validSources.includes(s as BackupSourceType))) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid sources. Must be array of: ${validSources.join(', ')}`,
        });
        return;
      }

      const plan = await this.backupService.createPlan({
        id: id || `plan-${Date.now()}`,
        name,
        type,
        schedule: {
          cronExpression: schedule.cronExpression,
          description: schedule.description,
          timezone: schedule.timezone || 'UTC',
        },
        retention: retention || { maxBackups: 30, maxAgeMs: 30 * 24 * 60 * 60 * 1000 },
        sources,
        enabled: enabled !== false,
        compress: compress !== false,
        encrypt: encrypt || false,
        description,
      });

      await reply.status(201).send({
        success: true,
        data: { plan },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'PLAN_ERROR',
        message: error.message,
      });
    }
  }

  async getPlans(request: FastifyRequest, reply: FastifyReply) {
    const plans = await this.backupService.getAllPlans();
    const scheduleInfo = this.backupService.getAllScheduleInfo();

    const enrichedPlans = plans.map((plan: any) => {
      const schedule = scheduleInfo.find((s: any) => s.planId === plan.id);
      return {
        ...plan,
        nextRun: schedule?.nextRun || null,
      };
    });

    await reply.status(200).send({
      success: true,
      data: { plans: enrichedPlans, count: enrichedPlans.length },
    });
  }

  async getPlan(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const plan = await this.backupService.getPlan(params.id);

    if (!plan) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Backup plan ${params.id} not found`,
      });
      return;
    }

    const nextRun = this.backupService.getNextBackupTime(params.id);

    await reply.status(200).send({
      success: true,
      data: { plan: { ...plan, nextRun } },
    });
  }

  async updatePlan(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};

    const plan = await this.backupService.updatePlan(params.id, body);

    if (!plan) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Backup plan ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { plan },
    });
  }

  async deletePlan(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const deleted = await this.backupService.deletePlan(params.id);

    if (!deleted) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Backup plan ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      message: 'Backup plan deleted',
    });
  }

  async togglePlan(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};
    const enabled = body.enabled !== false;

    const plan = await this.backupService.togglePlan(params.id, enabled);

    if (!plan) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Backup plan ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { enabled },
    });
  }

  // ==================== Backup Execution ====================

  async triggerBackup(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { planId } = body;

      if (!planId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: planId',
        });
        return;
      }

      const record = await this.backupService.triggerBackup(planId);

      if (!record) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Backup plan ${planId} not found or is disabled`,
        });
        return;
      }

      await reply.status(202).send({
        success: true,
        data: { backup: record },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'TRIGGER_ERROR',
        message: error.message,
      });
    }
  }

  // ==================== Backup Records ====================

  async getBackups(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;

    const filter: any = {};
    if (query.planId) filter.planId = query.planId;
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;

    const backups = await this.backupService.getBackups(filter);

    await reply.status(200).send({
      success: true,
      data: { backups, count: backups.length },
    });
  }

  async getBackupDetail(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const backup = await this.backupService.getBackupDetail(params.id);

    if (!backup) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Backup ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { backup },
    });
  }

  async deleteBackup(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const deleted = await this.backupService.deleteBackup(params.id);

    if (!deleted) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Backup ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      message: 'Backup deleted',
    });
  }

  // ==================== Verification ====================

  async verifyBackup(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;

    try {
      const verification = await this.backupService.verifyBackup(params.id);
      await reply.status(200).send({
        success: true,
        data: { verification },
      });
    } catch (error: any) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: error.message,
      });
    }
  }

  async testRestore(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;

    try {
      const verification = await this.backupService.testRestore(params.id);
      await reply.status(200).send({
        success: true,
        data: { verification },
      });
    } catch (error: any) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: error.message,
      });
    }
  }

  async getVerifications(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const verifications = this.backupService.getVerificationsForBackup(params.id);

    await reply.status(200).send({
      success: true,
      data: { verifications, count: verifications.length },
    });
  }

  // ==================== Recovery Plans ====================

  async createRecoveryPlan(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { id, name, rto, rpo, steps, enabled, description } = body;

      if (!name || rto === undefined || rpo === undefined || !steps) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, rto, rpo, steps',
        });
        return;
      }

      if (!Array.isArray(steps)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'steps must be an array',
        });
        return;
      }

      const plan = this.backupService.createRecoveryPlan({
        id: id || `recovery-${Date.now()}`,
        name,
        rto,
        rpo,
        steps,
        enabled: enabled !== false,
        description,
      });

      await reply.status(201).send({
        success: true,
        data: { plan },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'RECOVERY_PLAN_ERROR',
        message: error.message,
      });
    }
  }

  async getRecoveryPlans(request: FastifyRequest, reply: FastifyReply) {
    const plans = this.backupService.getAllRecoveryPlans();
    await reply.status(200).send({
      success: true,
      data: { plans, count: plans.length },
    });
  }

  async getRecoveryPlan(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const plan = this.backupService.getRecoveryPlan(params.id);

    if (!plan) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Recovery plan ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { plan },
    });
  }

  async updateRecoveryPlan(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};

    const plan = this.backupService.updateRecoveryPlan(params.id, body);

    if (!plan) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Recovery plan ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { plan },
    });
  }

  async deleteRecoveryPlan(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const deleted = this.backupService.deleteRecoveryPlan(params.id);

    if (!deleted) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Recovery plan ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      message: 'Recovery plan deleted',
    });
  }

  // ==================== Recovery Execution ====================

  async initiateRecovery(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { backupId, targetTime } = body;

      const execution = await this.backupService.initiateRecovery(params.planId, {
        backupId,
        targetTime: targetTime ? new Date(targetTime) : undefined,
      });

      await reply.status(201).send({
        success: true,
        data: { execution },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'RECOVERY_ERROR',
        message: error.message,
      });
    }
  }

  async executeRecovery(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;

      const execution = await this.backupService.executeRecoveryPlan(params.executionId);

      await reply.status(200).send({
        success: true,
        data: { execution },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'RECOVERY_EXECUTION_ERROR',
        message: error.message,
      });
    }
  }

  async initiatePointInTimeRecovery(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { targetTime } = body;

      if (!targetTime) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: targetTime',
        });
        return;
      }

      const execution = await this.backupService.initiatePointInTimeRecovery(
        params.planId,
        new Date(targetTime)
      );

      await reply.status(201).send({
        success: true,
        data: { execution },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'PITR_ERROR',
        message: error.message,
      });
    }
  }

  async getRecoveryExecutions(request: FastifyRequest, reply: FastifyReply) {
    const executions = this.backupService.getRecoveryExecutions();
    await reply.status(200).send({
      success: true,
      data: { executions, count: executions.length },
    });
  }

  async getRtoRpoStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = this.backupService.getRtoRpoStats();
    await reply.status(200).send({
      success: true,
      data: { stats },
    });
  }

  // ==================== Health & Monitoring ====================

  async getBackupStatus(request: FastifyRequest, reply: FastifyReply) {
    const summary = await this.backupService.getBackupStatusSummary();
    await reply.status(200).send({
      success: true,
      data: { summary },
    });
  }

  async getStorageUsage(request: FastifyRequest, reply: FastifyReply) {
    const usage = this.backupService.getStorageUsage();
    await reply.status(200).send({
      success: true,
      data: { usage },
    });
  }

  async getHealthReport(request: FastifyRequest, reply: FastifyReply) {
    const report = await this.backupService.generateHealthReport();
    await reply.status(200).send({
      success: true,
      data: { report },
    });
  }

  async enforceRetention(request: FastifyRequest, reply: FastifyReply) {
    try {
      const deleted = await this.backupService.enforceAllRetentions();
      await reply.status(200).send({
        success: true,
        data: { deleted, count: deleted.length },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'RETENTION_ERROR',
        message: error.message,
      });
    }
  }
}
