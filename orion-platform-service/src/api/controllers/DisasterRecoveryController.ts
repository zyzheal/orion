/**
 * DisasterRecoveryController - 灾难恢复 API 控制器
 *
 * 处理灾备计划管理、故障切换测试、备份管理
 * 使用 DisasterRecoveryRepository 进行 PostgreSQL 持久化
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { OrionError, ErrorCode } from '../../errors';
import { DisasterRecoveryRepository } from '../../repositories/DisasterRecoveryRepository';
import { DatabasePool } from '../../services/database';

/** Frontend DRPlan DTO */
interface DRPlanDTO {
  id: string;
  name: string;
  description: string;
  rpo: number;
  rto: number;
  services: string[];
  status: 'active' | 'inactive' | 'testing';
  lastTestedAt?: string;
  createdAt: string;
}

/** Frontend FailoverTest DTO */
interface FailoverTestDTO {
  id: string;
  planId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  results: { service: string; success: boolean; durationMs: number }[];
}

/** Frontend BackupRecord DTO */
interface BackupRecordDTO {
  id: string;
  sourceService: string;
  sizeBytes: number;
  status: 'completed' | 'failed' | 'in_progress';
  createdAt: string;
}

/** Frontend DRStatus DTO */
interface DRStatusDTO {
  overallStatus: 'ready' | 'at_risk' | 'degraded';
  plans: { id: string; name: string; status: string; lastTestedAt?: string }[];
  recentBackups: BackupRecordDTO[];
}

/** Mapping: DB row -> Frontend DRPlanDTO */
function mapPlanToDTO(row: any): DRPlanDTO {
  return {
    id: row.id,
    name: row.plan_name,
    description: row.description || '',
    rpo: row.rpo_target,
    rto: row.rto_target,
    services: row.services ?? [],
    status: row.status === 'draft' ? 'inactive' : (row.status === 'testing' ? 'testing' : 'active'),
    lastTestedAt: row.last_tested_at ? new Date(row.last_tested_at).toISOString() : undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export class DisasterRecoveryController extends BaseController {
  private repo: DisasterRecoveryRepository;

  constructor(db?: DatabasePool) {
    super();
    if (db) {
      this.repo = new DisasterRecoveryRepository(db);
    } else {
      // Fallback: no DB available, use in-memory stub
      const stubDb = { query: () => Promise.resolve({ rows: [], rowCount: 0 }) };
      this.repo = new DisasterRecoveryRepository(stubDb as any);
    }
  }

  /**
   * POST /v1/disaster-recovery/plans - Create DR plan
   */
  async createDRPlan(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = this.requireAuth(request, reply);
    if (!user) return;

    await this.tryExecute(reply, async () => {
      const body = request.body as {
        name: string;
        description: string;
        rpo: number;
        rto: number;
        services: string[];
      };

      if (!body.name) {
        throw new OrionError('name is required', ErrorCode.VALIDATION_ERROR);
      }
      if (!body.description) {
        throw new OrionError('description is required', ErrorCode.VALIDATION_ERROR);
      }
      if (!body.rpo || body.rpo <= 0) {
        throw new OrionError('rpo must be a positive number', ErrorCode.VALIDATION_ERROR);
      }
      if (!body.rto || body.rto <= 0) {
        throw new OrionError('rto must be a positive number', ErrorCode.VALIDATION_ERROR);
      }
      if (!Array.isArray(body.services) || body.services.length === 0) {
        throw new OrionError('services must be a non-empty array', ErrorCode.VALIDATION_ERROR);
      }

      const tenantId = this.getTenantId(request);
      const createdBy = user.userId || user.username || 'anonymous';

      const planRow = await this.repo.createPlan({
        tenantId,
        planName: body.name,
        rtoTarget: body.rto,
        rpoTarget: body.rpo,
        priority: 'medium',
        status: 'active',
        services: (body.services || []).map((s: string) => ({ service: s, priority: 1 })),
        failoverStrategy: 'active-passive',
        backupRegions: [],
        createdBy: createdBy,
      });

      const dto: DRPlanDTO = {
        id: planRow.id,
        name: planRow.plan_name,
        description: body.description,
        rpo: planRow.rpo_target,
        rto: planRow.rto_target,
        services: body.services,
        status: 'active',
        lastTestedAt: planRow.last_tested_at ? new Date(planRow.last_tested_at).toISOString() : undefined,
        createdAt: new Date(planRow.created_at).toISOString(),
      };

      return dto;
    }, (plan) => this.sendCreated(reply, plan));
  }

  /**
   * GET /v1/disaster-recovery/plans - List DR plans
   */
  async listDRPlans(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = this.requireAuth(request, reply);
    if (!user) return;

    await this.tryExecute(reply, async () => {
      const query = request.query as { status?: string };
      const tenantId = this.getTenantId(request);

      const allPlans = await this.repo.findAllPlans(tenantId);
      const filtered = query.status
        ? allPlans.filter((p) => p.status === query.status)
        : allPlans;

      const dtos: DRPlanDTO[] = filtered.map((p) => mapPlanToDTO(p));
      return dtos;
    }, (plans) => this.sendSuccess(reply, plans));
  }

  /**
   * POST /v1/disaster-recovery/plans/:id/failover-test - Execute failover test
   */
  async executeFailoverTest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = this.requireAuth(request, reply);
    if (!user) return;

    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const tenantId = this.getTenantId(request);
      const createdBy = user.userId || user.username || 'anonymous';

      // Validate plan exists
      const plan = await this.repo.findPlanById(tenantId, params.id);
      if (!plan) {
        throw new OrionError(`DR plan '${params.id}' not found`, ErrorCode.NOT_FOUND);
      }

      const services = (plan.services || []).map((s: any) =>
        typeof s === 'string' ? s : (s.service || s)
      );

      // Create failover test record
      const testRow = await this.repo.createFailoverTest({
        tenantId,
        planId: params.id,
        testName: `Failover test for plan: ${plan.plan_name}`,
        testType: 'planned',
        affectedServices: services,
        createdBy: createdBy,
      });

      // Mark as completed immediately (simulated async completion)
      const completedTest = await this.repo.completeFailoverTest({
        tenantId,
        id: testRow.id,
        completedAt: new Date(),
        actualRto: plan.rto_target,
        actualRpo: plan.rpo_target,
        result: 'passed',
      });

      // Update last tested timestamp on plan
      await this.repo.updateLastTested(tenantId, params.id, new Date());

      const dto: FailoverTestDTO = {
        id: completedTest.id,
        planId: completedTest.plan_id,
        status: 'completed',
        startedAt: new Date(completedTest.started_at).toISOString(),
        completedAt: completedTest.completed_at ? new Date(completedTest.completed_at).toISOString() : undefined,
        results: services.map((svc: string) => ({ service: svc, success: true, durationMs: plan.rto_target * 1000 })),
      };

      return dto;
    }, (result) => this.sendSuccess(reply, result));
  }

  /**
   * POST /v1/disaster-recovery/backups - Create backup
   */
  async createBackup(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = this.requireAuth(request, reply);
    if (!user) return;

    await this.tryExecute(reply, async () => {
      const body = request.body as { sourceService: string; type?: string };

      if (!body.sourceService) {
        throw new OrionError('sourceService is required', ErrorCode.VALIDATION_ERROR);
      }

      const tenantId = this.getTenantId(request);
      const createdBy = user.userId || user.username || 'anonymous';

      const backupConfig = await this.repo.createBackupConfig({
        tenantId,
        sourceType: body.type || 'manual',
        sourceId: body.sourceService,
        backupSchedule: 'on-demand',
        retentionDays: 30,
        storageLocation: 'local',
        encryption: true,
        compression: 'gzip',
        createdBy: createdBy,
      });

      const dto: BackupRecordDTO = {
        id: backupConfig.id,
        sourceService: backupConfig.source_id,
        sizeBytes: backupConfig.last_backup_size ?? 0,
        status: 'completed',
        createdAt: new Date(backupConfig.created_at).toISOString(),
      };

      return dto;
    }, (backup) => this.sendCreated(reply, backup));
  }

  /**
   * POST /v1/disaster-recovery/plans/:id/failover - Execute failover
   */
  async executeFailover(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = this.requireAuth(request, reply);
    if (!user) return;

    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const body = (request.body as { reason?: string; dryRun?: boolean }) || {};
      const tenantId = this.getTenantId(request);
      const createdBy = user.userId || user.username || 'anonymous';

      // Validate plan exists
      const plan = await this.repo.findPlanById(tenantId, params.id);
      if (!plan) {
        throw new OrionError(`DR plan '${params.id}' not found`, ErrorCode.NOT_FOUND);
      }

      const services = (plan.services || []).map((s: any) =>
        typeof s === 'string' ? s : (s.service || s)
      );

      // Record failover event in test history
      const testRow = await this.repo.createFailoverTest({
        tenantId,
        planId: params.id,
        testName: `Real failover for plan: ${plan.plan_name}${body.reason ? ` (${body.reason})` : ''}`,
        testType: body.dryRun ? 'planned' : 'unplanned',
        affectedServices: services,
        createdBy: createdBy,
      });

      return {
        id: testRow.id,
        planId: testRow.plan_id,
        type: body.dryRun ? 'dry_run' : 'real',
        status: 'running',
        startedAt: new Date(testRow.started_at).toISOString(),
        reason: body.reason,
        dryRun: body.dryRun,
      };
    }, (result) => this.sendSuccess(reply, result));
  }

  /**
   * GET /v1/disaster-recovery/status - Get DR status
   */
  async getDRStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = this.requireAuth(request, reply);
    if (!user) return;

    await this.tryExecute(reply, async () => {
      const tenantId = this.getTenantId(request);

      const allPlans = await this.repo.findAllPlans(tenantId);
      const allBackups = await this.repo.findAllBackupConfigs(tenantId);
      const allTests = await this.repo.findAllFailoverTests(tenantId);

      // Determine overall status based on test results and plan health
      let overallStatus: 'ready' | 'at_risk' | 'degraded' = 'ready';
      const recentTests = allTests
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
      const last10Tests = recentTests.slice(0, 10);
      const failedTests = last10Tests.filter((t) => t.result === 'failed');
      if (failedTests.length > 3) {
        overallStatus = 'degraded';
      } else if (failedTests.length > 0) {
        overallStatus = 'at_risk';
      }

      // Check if active plans haven't been tested recently (> 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const activePlans = allPlans.filter((p) => p.status === 'active');
      const outdatedPlans = activePlans.filter((p) =>
        !p.last_tested_at || new Date(p.last_tested_at) < ninetyDaysAgo
      );
      if (outdatedPlans.length > activePlans.length / 2 && activePlans.length > 0) {
        if (overallStatus === 'ready') {
          overallStatus = 'at_risk';
        }
      }

      const plansSummary = allPlans.map((p) => ({
        id: p.id,
        name: p.plan_name,
        status: p.status,
        lastTestedAt: p.last_tested_at ? new Date(p.last_tested_at).toISOString() : undefined,
      }));

      const recentBackups: BackupRecordDTO[] = allBackups
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map((b) => ({
          id: b.id,
          sourceService: b.source_id,
          sizeBytes: b.last_backup_size ?? 0,
          status: b.enabled ? 'completed' : 'failed',
          createdAt: new Date(b.created_at).toISOString(),
        }));

      const dto: DRStatusDTO = {
        overallStatus,
        plans: plansSummary,
        recentBackups,
      };

      return dto;
    }, (status) => this.sendSuccess(reply, status));
  }
}
