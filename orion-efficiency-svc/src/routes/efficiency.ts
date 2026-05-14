/**
 * Efficiency Analytics API Routes
 *
 * DORA 指标收集、ClickHouse 同步、效能分析
 *
 * P0-4 Fix: Replaced hardcoded metrics with real DoraMetricsService computation
 * using data from DeployRepository and PipelineRunRepository.
 *
 * Prefix: /api/v1/efficiency
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../utils/database';
import { DoraMetricsService } from '../services/DoraMetricsService';
import { ClickHouseSync } from '../services/ClickHouseSync';
import { InMemoryLocalStorage, EfficiencyEventHandler } from '../services/EventHandler';
import { WeeklyReportService } from '../services/WeeklyReportService';
import { DeployRepository } from '../services/deploy/DeployRepository';
import { PipelineRunRepository } from '../services/pipeline/PipelineRunRepository';
import { TicketAnalyticsService } from '../services/ticketing/TicketAnalyticsService';
import { TicketService } from '../services/ticketing/TicketService';

interface EfficiencyRoutesOptions {
  database?: DatabasePool;
}

interface DoraMetricsQuery {
  projectId?: string;
  teamId?: string;
  tenantId?: string;
  from?: string;
  to?: string;
  interval?: 'daily' | 'weekly' | 'monthly';
}

export default async function efficiencyRoutes(app: FastifyInstance, options: EfficiencyRoutesOptions = {}): Promise<void> {
  // Initialize services
  const doraMetrics = new DoraMetricsService();
  const clickHouseSync = new ClickHouseSync({ host: process.env.CLICKHOUSE_HOST || 'localhost', port: parseInt(process.env.CLICKHOUSE_PORT || '8123'), username: process.env.CLICKHOUSE_USERNAME || 'default', password: process.env.CLICKHOUSE_PASSWORD || '', database: process.env.CLICKHOUSE_DATABASE || 'efficiency' });
  const localStorage = new InMemoryLocalStorage();

  // P0-4 Fix: Initialize real data repositories
  const deployRepo = options.database ? new DeployRepository(options.database) : null;
  const pipelineRunRepo = options.database ? new PipelineRunRepository(options.database) : null;

  /**
   * Shared: fetch and map deployment + pipeline data
   */
  async function fetchDeploymentData(tenantId?: string, since?: Date): Promise<{ deployments: any[]; pipelineRecords: any[] }> {
    let deployments: any[] = [];
    let pipelineRecords: any[] = [];

    if (deployRepo) {
      const deployResult = await deployRepo.findAll({ tenantId, since, limit: 1000 });
      deployments = deployResult.map((d: any) => ({
        deploymentId: d.id,
        service: d.tenant_id,
        environment: d.environment,
        status: d.status,
        deployedAt: d.completed_at || d.created_at,
        recoveryTimeMs: d.duration_ms ?? undefined,
        commitSha: d.commit_sha ?? undefined,
        commitCommittedAt: d.commit_committed_at ? new Date(d.commit_committed_at) : undefined,
      }));
    }

    if (pipelineRunRepo) {
      const runsResult = await pipelineRunRepo.findAll({ tenantId, since, limit: 1000 });
      pipelineRecords = runsResult.map((r: any) => ({
        id: `run-${r.id}`,
        runId: r.id,
        pipelineId: r.pipeline_id,
        status: r.status === 'success' || r.status === 'completed' ? 'success' : 'failed',
        triggerType: r.trigger_type,
        durationMs: r.duration_ms ?? 0,
        completedAt: r.completed_at || r.created_at,
        tenantId: r.tenant_id,
        syncedToClickHouse: false,
      }));
    }

    return { deployments, pipelineRecords };
  }

  // ==================== DORA Metrics ====================

  // GET /efficiency/dora/metrics - 获取 DORA 指标数据
  app.get('/dora/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as DoraMetricsQuery;

    try {
      const interval = query.interval === 'daily' ? 'day' : query.interval === 'weekly' ? 'week' : 'month';
      const timeWindowConfig = doraMetrics.buildTimeWindow(interval, 1);
      const { deployments, pipelineRecords } = await fetchDeploymentData(query.tenantId, timeWindowConfig.start);

      const deploymentFrequency = doraMetrics.calculateDeploymentFrequency(deployments, timeWindowConfig);
      const leadTimeForChanges = doraMetrics.calculateLeadTimeForChanges(pipelineRecords, timeWindowConfig, deployments);
      const changeFailureRate = doraMetrics.calculateChangeFailureRate(deployments, timeWindowConfig);
      const meanTimeToRecovery = doraMetrics.calculateMeanTimeToRecovery(deployments, timeWindowConfig);

      return reply.send({
        metrics: {
          deploymentFrequency: deploymentFrequency.deploymentsPerDay,
          leadTimeForChanges: leadTimeForChanges.averageLeadTimeMs,
          changeFailureRate: changeFailureRate.failureRate,
          meanTimeToRecovery: meanTimeToRecovery.averageRecoveryTimeMs,
        },
        details: {
          deploymentFrequency,
          leadTimeForChanges,
          changeFailureRate,
          meanTimeToRecovery,
        },
        timeWindow: timeWindowConfig,
        calculatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'DORA_METRICS_ERROR',
        message: error.message,
      });
    }
  });

  // POST /efficiency/dora/report - 生成 DORA 报告
  app.post('/dora/report', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as DoraMetricsQuery & { format?: 'json' | 'pdf'; tenantId?: string };

    try {
      const interval = body.interval === 'daily' ? 'day' : body.interval === 'weekly' ? 'week' : 'month';
      const timeWindowConfig = doraMetrics.buildTimeWindow(interval, 1);
      const { deployments, pipelineRecords } = await fetchDeploymentData(body.tenantId, timeWindowConfig.start);

      const report = doraMetrics.generateReport(
        body.tenantId || 'default',
        pipelineRecords,
        deployments,
        timeWindowConfig,
      );

      return reply.send({
        report,
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'REPORT_ERROR',
        message: error.message,
      });
    }
  });

  // GET /efficiency/dora/benchmarks - 获取 DORA 基准数据
  app.get('/dora/benchmarks', async (request: FastifyRequest, reply: FastifyReply) => {
    const benchmarks = {
      deploymentFrequency: {
        elite: 'on-demand',
        high: 'daily',
        medium: 'weekly',
        low: 'monthly',
      },
      leadTimeForChanges: {
        elite: '< 1 hour',
        high: '< 1 day',
        medium: '< 1 week',
        low: '> 1 month',
      },
      changeFailureRate: {
        elite: '0-5%',
        high: '5-10%',
        medium: '10-15%',
        low: '> 15%',
      },
      meanTimeToRecovery: {
        elite: '< 1 hour',
        high: '< 1 day',
        medium: '< 1 week',
        low: '> 1 month',
      },
    };

    return reply.send({ benchmarks });
  });

  // ==================== ClickHouse Sync ====================

  // GET /efficiency/clickhouse/status - 获取 ClickHouse 同步状态
  app.get('/clickhouse/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const status = await clickHouseSync.getStatus();

    return reply.send({
      status,
    });
  });

  // POST /efficiency/clickhouse/sync - 触发 ClickHouse 数据同步
  app.post('/clickhouse/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { full?: boolean };

    try {
      const result = await clickHouseSync.flushPendingRecords();
      return reply.send({
        status: 'synced',
        syncedAt: new Date().toISOString(),
        flushed: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'SYNC_ERROR',
        message: error.message,
      });
    }
  });

  // GET /efficiency/clickhouse/config - 获取 ClickHouse 配置
  app.get('/clickhouse/config', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      config: {
        enabled: false,
      },
    });
  });

  // ==================== Efficiency Dashboard ====================

  // GET /efficiency/dashboard - 获取效能仪表盘数据
  app.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { projectId?: string; teamId?: string; tenantId?: string };

    try {
      const timeWindowConfig = doraMetrics.buildTimeWindow('month', 1);
      const { deployments, pipelineRecords } = await fetchDeploymentData(query.tenantId, timeWindowConfig.start);

      const deploymentFrequency = doraMetrics.calculateDeploymentFrequency(deployments, timeWindowConfig);
      const changeFailureRate = doraMetrics.calculateChangeFailureRate(deployments, timeWindowConfig);
      const meanTimeToRecovery = doraMetrics.calculateMeanTimeToRecovery(deployments, timeWindowConfig);

      const dashboard = {
        dora: {
          deploymentFrequency: deploymentFrequency.deploymentsPerDay,
          leadTimeForChanges: 0,
          changeFailureRate: changeFailureRate.failureRate,
          meanTimeToRecovery: meanTimeToRecovery.averageRecoveryTimeMs,
        },
        trends: {
          deploymentFrequency: deploymentFrequency.deploymentsPerDay,
          leadTime: 0,
          mttr: meanTimeToRecovery.averageRecoveryTimeMs,
          changeFailureRate: changeFailureRate.failureRate,
        },
        summary: {
          totalDeployments: deploymentFrequency.totalDeployments,
          successfulDeployments: deploymentFrequency.successfulDeployments,
          failedDeployments: deploymentFrequency.failedDeployments,
        },
      };

      return reply.send({
        dashboard,
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'DASHBOARD_ERROR',
        message: error.message,
      });
    }
  });

  // ==================== Weekly Reports ====================

  // POST /efficiency/reports/weekly/generate - Generate a new weekly report
  app.post('/reports/weekly/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { weekStart?: string; teamId?: string } | undefined;
    const weekStart = body?.weekStart ? new Date(body.weekStart) : undefined;
    const teamId = body?.teamId || 'default';

    try {
      const weeklyReport = getWeeklyReportService(options.database, localStorage);
      const report = await weeklyReport.generateReport({ weekStart, teamId });

      return reply.send({
        success: true,
        data: report,
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'REPORT_GENERATION_ERROR',
        message: error.message,
      });
    }
  });

  // GET /efficiency/reports/weekly - Get or generate weekly report for a given week
  app.get('/reports/weekly', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { week_start?: string; team_id?: string };

    try {
      const weeklyReport = getWeeklyReportService(options.database, localStorage);
      const weekStart = query.week_start ? new Date(query.week_start) : undefined;

      // If DB available, check if report already exists for this week (idempotent)
      if (options.database && weekStart) {
        const { start, end } = weeklyReport.getWeekBoundaries(weekStart);
        const existing = await weeklyReport.listHistory({
          teamId: query.team_id,
          limit: 1,
        });
        // listHistory returns reports ordered by week_start DESC; check if first matches
        const match = existing.find(r => {
          const rStart = new Date(r.weekStart);
          return Math.abs(rStart.getTime() - start.getTime()) < 86400000; // same day
        });
        if (match) {
          const fullReport = await weeklyReport.getReport(match.id);
          if (fullReport) {
            return reply.send({ success: true, data: fullReport, cached: true });
          }
        }
      }

      // Generate new report
      const report = await weeklyReport.generateReport({ weekStart, teamId: query.team_id });

      return reply.send({
        success: true,
        data: report,
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'REPORT_ERROR',
        message: error.message,
      });
    }
  });

  // GET /efficiency/reports/weekly/history - List past weekly reports
  app.get('/reports/weekly/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { team_id?: string; limit?: string };

    try {
      const weeklyReport = getWeeklyReportService(options.database, localStorage);
      const history = await weeklyReport.listHistory({
        teamId: query.team_id,
        limit: query.limit ? parseInt(query.limit, 10) : 12,
      });

      return reply.send({
        success: true,
        data: history,
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'REPORT_HISTORY_ERROR',
        message: error.message,
      });
    }
  });

  // ==================== Efficiency Score ====================

  app.post('/score', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      teamId?: string;
      projectId?: string;
      period?: { from: string; to: string };
    };
    try {
      const tenantId = body.teamId || body.projectId;
      const since = body.period?.from ? new Date(body.period.from) : undefined;
      const { deployments, pipelineRecords } = await fetchDeploymentData(tenantId, since);

      // Calculate composite efficiency score using existing DoraMetricsService
      const timeWindowConfig = doraMetrics.buildTimeWindow('month', 1);
      const deploymentFrequency = doraMetrics.calculateDeploymentFrequency(deployments, timeWindowConfig);
      const changeFailureRate = doraMetrics.calculateChangeFailureRate(deployments, timeWindowConfig);
      const meanTimeToRecovery = doraMetrics.calculateMeanTimeToRecovery(deployments, timeWindowConfig);

      // Scoring model: weighted combination of DORA metrics (0-100)
      const frequencyScore = Math.min(deploymentFrequency.deploymentsPerDay / 10, 1) * 30;
      const failureScore = Math.max(0, 1 - changeFailureRate.failureRate) * 30;
      const mttrScore = Math.max(0, 1 - meanTimeToRecovery.averageRecoveryTimeMs / (24 * 60 * 60 * 1000)) * 20;
      const leadTimeScore = 20; // placeholder -- needs lead time data

      const totalScore = Math.round((frequencyScore + failureScore + mttrScore + leadTimeScore) * 100) / 100;

      return reply.send({
        code: 200,
        message: 'OK',
        data: {
          score: totalScore,
          grade: totalScore >= 80 ? 'A' : totalScore >= 60 ? 'B' : totalScore >= 40 ? 'C' : 'D',
          breakdown: {
            deploymentFrequency: Math.round(frequencyScore * 100) / 100,
            changeFailureRate: Math.round(failureScore * 100) / 100,
            meanTimeToRecovery: Math.round(mttrScore * 100) / 100,
            leadTimeForChanges: leadTimeScore,
          },
          period: body.period || { from: timeWindowConfig.start.toISOString(), to: timeWindowConfig.end.toISOString() },
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Export ====================

  app.post('/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      format?: 'csv' | 'json';
      teamId?: string;
      projectId?: string;
      period?: { from: string; to: string };
    };
    try {
      const format = body.format || 'json';
      const tenantId = body.teamId || body.projectId;
      const since = body.period?.from ? new Date(body.period.from) : undefined;
      const { deployments, pipelineRecords } = await fetchDeploymentData(tenantId, since);

      if (format === 'csv') {
        const headers = 'date,deployment_count,success_rate,avg_lead_time_ms,mttr_ms\n';
        const rows = deployments
          .map((d: any) => {
            const date = d.deployedAt ? new Date(d.deployedAt).toISOString().split('T')[0] : '';
            const success = d.status === 'success' ? 1 : 0;
            return `${date},1,${success},${0},${d.recoveryTimeMs || 0}`;
          })
          .join('\n');

        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename=efficiency-report.csv');
        return reply.send(headers + rows);
      }

      return reply.send({
        code: 200,
        message: 'OK',
        data: {
          format: 'json',
          exportedAt: new Date().toISOString(),
          deploymentCount: deployments.length,
          pipelineRunCount: pipelineRecords.length,
          deployments,
          pipelineRecords,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Team Comparison ====================

  // GET /efficiency/teams - 获取团队列表（用于团队对比下拉选择）
  app.get('/teams', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 从 deployments 表提取团队列表（按 tenant_id 分组）
      if (!deployRepo) {
        return reply.send({
          code: 200,
          message: 'OK',
          data: {
            teams: [
              { teamId: 'team-1', teamName: '平台组' },
              { teamId: 'team-2', teamName: '前端组' },
              { teamId: 'team-3', teamName: '后端组' },
              { teamId: 'team-4', teamName: '运维组' },
            ],
          },
        });
      }

      const result = await deployRepo.findAll({ limit: 1000 });
      const teamMap = new Map<string, { teamId: string; teamName: string }>();

      for (const d of result) {
        const teamId = d.tenant_id || 'unknown';
        if (!teamMap.has(teamId)) {
          teamMap.set(teamId, {
            teamId,
            teamName: teamId === 'unknown' ? '未分类团队' : `团队 ${teamId.slice(0, 8)}`,
          });
        }
      }

      return reply.send({
        code: 200,
        message: 'OK',
        data: {
          teams: Array.from(teamMap.values()),
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // GET /efficiency/compare - 多团队 DORA 指标对比
  app.get('/compare', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { teamIds?: string; interval?: 'daily' | 'weekly' | 'monthly' };

    try {
      const teamIds = query.teamIds ? query.teamIds.split(',').filter(Boolean) : [];
      const interval = query.interval === 'daily' ? 'day' : query.interval === 'weekly' ? 'week' : 'month';
      const timeWindowConfig = doraMetrics.buildTimeWindow(interval, 1);

      // 如果未指定团队，返回所有团队的对比
      if (teamIds.length === 0 && deployRepo) {
        const result = await deployRepo.findAll({ limit: 1000 });
        const uniqueTeamIds = new Set<string>(result.map((d: any) => (d.tenant_id as string) || 'unknown'));
        teamIds.push(...Array.from(uniqueTeamIds));
      }

      // 计算每个团队的 DORA 指标
      const teamMetrics = await Promise.all(
        teamIds.map(async (teamId) => {
          const { deployments, pipelineRecords } = await fetchDeploymentData(teamId, timeWindowConfig.start);

          const df = doraMetrics.calculateDeploymentFrequency(deployments, timeWindowConfig);
          const lt = doraMetrics.calculateLeadTimeForChanges(pipelineRecords, timeWindowConfig, deployments);
          const cfr = doraMetrics.calculateChangeFailureRate(deployments, timeWindowConfig);
          const mttr = doraMetrics.calculateMeanTimeToRecovery(deployments, timeWindowConfig);

          // 计算综合评分（0-100）
          const score = calculateTeamScore(df, lt, cfr, mttr);

          return {
            teamId,
            teamName: teamId === 'unknown' ? '未分类团队' : `团队 ${teamId.slice(0, 8)}`,
            metrics: {
              deploymentFrequency: df.deploymentsPerDay,
              leadTimeMinutes: lt.medianLeadTimeMs ? lt.medianLeadTimeMs / 60000 : null,
              mttrMinutes: mttr.medianRecoveryTimeMs ? mttr.medianRecoveryTimeMs / 60000 : null,
              changeFailureRate: cfr.failureRate,
            },
            score,
            level: getDoraLevel(score),
          };
        })
      );

      // 按评分排序
      teamMetrics.sort((a, b) => b.score - a.score);

      return reply.send({
        code: 200,
        message: 'OK',
        data: {
          teams: teamMetrics,
          period: {
            start: timeWindowConfig.start.toISOString(),
            end: timeWindowConfig.end.toISOString(),
          },
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
}

// ==================== Helper Functions ====================

/**
 * 计算团队综合评分（0-100）
 */
function calculateTeamScore(
  df: { deploymentsPerDay: number; deploymentLevel?: string },
  lt: { medianLeadTimeMs?: number },
  cfr: { failureRate: number },
  mttr: { medianRecoveryTimeMs?: number }
): number {
  let score = 50; // 基础分

  // 部署频率加分（越高越好）
  if (df.deploymentsPerDay >= 7) score += 20; // Elite: 每周多次
  else if (df.deploymentsPerDay >= 1) score += 10; // High: 每周至少一次
  else if (df.deploymentsPerDay >= 0.25) score += 5; // Medium: 每月至少一次

  // Lead Time 加分（越短越好）
  if (lt.medianLeadTimeMs && lt.medianLeadTimeMs < 3600000) score += 15; // Elite: < 1小时
  else if (lt.medianLeadTimeMs && lt.medianLeadTimeMs < 86400000) score += 10; // High: < 1天
  else if (lt.medianLeadTimeMs && lt.medianLeadTimeMs < 604800000) score += 5; // Medium: < 1周

  // MTTR 加分（越短越好）
  if (mttr.medianRecoveryTimeMs && mttr.medianRecoveryTimeMs < 3600000) score += 10; // Elite: < 1小时
  else if (mttr.medianRecoveryTimeMs && mttr.medianRecoveryTimeMs < 86400000) score += 5; // High: < 1天

  // 变更失败率加分（越低越好）
  if (cfr.failureRate < 5) score += 5; // Elite: < 5%
  else if (cfr.failureRate < 10) score += 3; // High: < 10%
  else if (cfr.failureRate < 15) score += 1; // Medium: < 15%

  return Math.min(100, Math.max(0, score));
}

/**
 * 根据评分返回 DORA 等级
 */
function getDoraLevel(score: number): 'elite' | 'high' | 'medium' | 'low' {
  if (score >= 80) return 'elite';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ==================== Weekly Report Service Factory ====================

let _weeklyReportService: WeeklyReportService | null = null;

function getWeeklyReportService(db?: DatabasePool, sharedLocalStorage?: InMemoryLocalStorage): WeeklyReportService {
  if (_weeklyReportService) return _weeklyReportService;

  const doraService = new DoraMetricsService();

  // Use shared localStorage if provided (populated by EventHandler), otherwise create empty fallback
  const localStorage = sharedLocalStorage || new InMemoryLocalStorage();
  const dataSource = {
    getPipelineRecords: async (filter?: { since?: Date }) => {
      return localStorage.getPipelineRecords(filter);
    },
    getDeploymentRecords: async (filter?: { since?: Date }) => {
      return localStorage.getDeploymentRecords(filter);
    },
  };

  _weeklyReportService = new WeeklyReportService({
    doraService,
    ticketService: db ? new TicketAnalyticsService(db) : createFallbackTicketService(),
    dataSource,
    db,
  });

  return _weeklyReportService;
}

/**
 * Fallback in-memory ticket service for when DB is not available.
 * Wraps the old TicketService to match TicketServiceLike interface.
 */
function createFallbackTicketService() {
  const oldService = new TicketService();
  return {
    getSLACompliance: (periodStart?: Date, periodEnd?: Date) => oldService.getSLACompliance(periodStart, periodEnd),
    getResolutionStats: () => oldService.getResolutionStats(),
    getBacklogAnalysis: () => oldService.getBacklogAnalysis(),
    getTrendReport: (options?: { days?: number; granularity?: string }) => oldService.getTrendReport({ days: options?.days }),
    getStatistics: () => oldService.getStatistics(),
  };
}
