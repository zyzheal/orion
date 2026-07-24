/**
 * Efficiency / DORA Metrics API Routes
 *
 * Routes under /api/v1/efficiency
 *
 * Provides efficiency reports, DORA metrics, team/project metrics, and period comparisons
 * via EfficiencyReportService and DORACalculator.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { EfficiencyReportService } from '../services/efficiency/EfficiencyReportService';
import { DORACalculator } from '../services/efficiency/DORACalculator';
import { DatabasePool } from '../services/database';
import { success, created, badRequest, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { getCurrentTenantId } from '../db/tenant-context-storage';


interface EfficiencyRoutesOptions {
  database?: DatabasePool;
}

export default async function efficiencyRoutes(
  app: FastifyInstance,
  options: EfficiencyRoutesOptions = {}
): Promise<void> {
  const db = options.database;
  const reportService = new EfficiencyReportService(db);
  const doraCalculator = new DORACalculator(db);

  // ==================== Reports ====================

  /**
   * GET /efficiency/reports - Get efficiency report for a tenant
   */
  app.get('/reports', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId || getCurrentTenantId();
    const timeWindow = (query.timeWindow as any) || 'week';
    const windowSize = parseInt(query.windowSize || '1', 10);

    const report = reportService.generateReport(tenantId, timeWindow, windowSize);
    return success(reply, request, { report });
  });

  /**
   * GET /efficiency/reports/history - Get report history for a tenant
   */
  app.get('/reports/history', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId || getCurrentTenantId();
    const limit = parseInt(query.limit || '10', 10);

    const history = reportService.getReportHistory(tenantId, limit);
    return success(reply, request, { history, total: history.length });
  });

  // ==================== Team Metrics ====================

  /**
   * GET /efficiency/teams/:teamId - Get team metrics
   */
  app.get('/teams/:teamId', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { teamId } = request.params as { teamId: string };
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId || getCurrentTenantId();

    const metrics = reportService.getTeamMetrics(tenantId, teamId);
    return success(reply, request, { metrics });
  });

  // ==================== Project Metrics ====================

  /**
   * GET /efficiency/projects/:projectId - Get project metrics
   */
  app.get('/projects/:projectId', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId || getCurrentTenantId();

    const metrics = reportService.getProjectMetrics(tenantId, projectId);
    return success(reply, request, { metrics });
  });

  // ==================== Period Comparison ====================

  /**
   * POST /efficiency/compare - Compare two time periods
   */
  app.post('/compare', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const tenantId = (body.tenantId as string) || getCurrentTenantId();
      const periodA = body.periodA as { label: string; start: string; end: string };
      const periodB = body.periodB as { label: string; start: string; end: string };

      if (!periodA || !periodB) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'periodA and periodB are required');
      }

      const comparison = reportService.comparePeriods(
        tenantId,
        { label: periodA.label, start: new Date(periodA.start), end: new Date(periodA.end) },
        { label: periodB.label, start: new Date(periodB.start), end: new Date(periodB.end) }
      );

      return success(reply, request, { comparison });
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Period comparison failed');
    }
  });

  // ==================== DORA Metrics ====================

  /**
   * GET /efficiency/dora - Calculate all DORA metrics
   */
  app.get('/dora', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId || getCurrentTenantId();
    const timeWindow = (query.timeWindow as any) || 'week';
    const windowSize = parseInt(query.windowSize || '1', 10);

    // DORACalculator expects deployment/pipeline data — return empty baseline
    const result = await doraCalculator.calculateAllDORA(
      tenantId, [], [], [], timeWindow, windowSize
    );

    return success(reply, request, { dora: result });
  });

  /**
   * GET /efficiency/dora/trend - Get DORA trend comparison
   */
  app.get('/dora/trend', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId || getCurrentTenantId();
    const timeWindow = (query.timeWindow as any) || 'week';
    const windowSize = parseInt(query.windowSize || '1', 10);

    const trend = await doraCalculator.getDORATrend(
      tenantId, [], [], [], timeWindow, windowSize
    );

    return success(reply, request, { trend });
  });

  /**
   * GET /efficiency/dashboard - Get aggregated dashboard data
   * Returns combined DORA metrics, trend summary, and deployment statistics
   */
  app.get('/dashboard', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId || getCurrentTenantId();
    const timeWindow = (query.timeWindow as any) || 'week';
    const windowSize = parseInt(query.windowSize || '1', 10);

    const report = reportService.generateReport(tenantId, timeWindow, windowSize);

    // Build dashboard response in frontend-expected format
    const dora = report.doraMetrics;
    const dashboardData = {
      dora: dora
        ? {
            deploymentFrequency: dora.deploymentFrequency?.deploymentsPerDay ?? 0,
            leadTime: dora.leadTimeForChanges?.averageLeadTimeMs
              ? Math.round(dora.leadTimeForChanges.averageLeadTimeMs / (1000 * 60 * 60))
              : 0,
            mttr: dora.meanTimeToRecovery?.averageRecoveryTimeMs
              ? Math.round(dora.meanTimeToRecovery.averageRecoveryTimeMs / (1000 * 60))
              : 0,
            changeFailureRate: dora.changeFailureRate?.failureRate ?? 0,
          }
        : { deploymentFrequency: 0, leadTime: 0, mttr: 0, changeFailureRate: 0 },
      trends: {
        deploymentFrequency: dora?.deploymentFrequency?.deploymentsPerDay ?? 0,
        leadTime: dora?.leadTimeForChanges?.averageLeadTimeMs
          ? Math.round(dora.leadTimeForChanges.averageLeadTimeMs / (1000 * 60 * 60))
          : 0,
        mttr: dora?.meanTimeToRecovery?.averageRecoveryTimeMs
          ? Math.round(dora.meanTimeToRecovery.averageRecoveryTimeMs / (1000 * 60))
          : 0,
        changeFailureRate: dora?.changeFailureRate?.failureRate ?? 0,
      },
      summary: {
        totalDeployments: report.totalDeployments,
        successfulDeployments: report.doraMetrics?.deploymentFrequency?.successfulDeployments ?? 0,
        failedDeployments: report.doraMetrics?.deploymentFrequency?.failedDeployments ?? 0,
      },
    };

    return success(reply, request, { dashboard: dashboardData });
  });

  /**
   * GET /efficiency/trends - Get historical DORA trend data for chart
   * Returns time-series data points for trend visualization
   */
  app.get('/trends', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId || getCurrentTenantId();
    const weeks = parseInt(query.weeks || '12', 10);

    // Get historical snapshots from DORACalculator's snapshot repo
    const snapshots = await doraCalculator.getHistoricalSnapshots(tenantId, weeks);

    return success(reply, request, { trends: snapshots });
  });

  /**
   * GET /efficiency/teams/list - Get registered team list
   */
  app.get('/teams/list', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getCurrentTenantId();
    const teams = reportService.getAllTeams(tenantId);

    return success(reply, request, { teams });
  });

  /**
   * GET /efficiency/bottlenecks - Get derived bottleneck analysis
   * Analyzes DORA metrics to identify improvement areas
   */
  app.get('/bottlenecks', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId || getCurrentTenantId();
    const timeWindow = (query.timeWindow as any) || 'week';
    const windowSize = parseInt(query.windowSize || '1', 10);

    const report = reportService.generateReport(tenantId, timeWindow, windowSize);
    const dora = report.doraMetrics;

    // Derive bottlenecks from DORA metrics
    const bottlenecks: Array<{
      id: string;
      category: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      metric: string;
      currentValue: string;
      targetValue: string;
      suggestion: string;
    }> = [];

    let idx = 1;
    if (dora) {
      // Check deployment frequency
      const freq = dora.deploymentFrequency?.deploymentsPerDay ?? 0;
      if (freq < 1) {
        bottlenecks.push({
          id: `bn-${String(idx++).padStart(3, '0')}`,
          category: '部署频率',
          description: `发布频率较低，当前 ${freq} 次/天，建议提升到每天至少 1 次`,
          impact: 'high',
          metric: 'deployments per day',
          currentValue: `${freq}`,
          targetValue: '>= 1',
          suggestion: '实施自动化部署流水线，减少手动审批环节',
        });
      } else if (freq < 3) {
        bottlenecks.push({
          id: `bn-${String(idx++).padStart(3, '0')}`,
          category: '部署频率',
          description: `发布频率中等，当前 ${freq} 次/天，Elite 级别为每天多次`,
          impact: 'medium',
          metric: 'deployments per day',
          currentValue: `${freq}`,
          targetValue: '>= 3',
          suggestion: '增加部署自动化程度，缩短部署周期',
        });
      }

      // Check lead time
      const leadHours = dora.leadTimeForChanges?.averageLeadTimeMs
        ? Math.round(dora.leadTimeForChanges.averageLeadTimeMs / (1000 * 60 * 60))
        : 0;
      if (leadHours > 24) {
        bottlenecks.push({
          id: `bn-${String(idx++).padStart(3, '0')}`,
          category: '变更前置时间',
          description: `变更前置时间较长，平均 ${leadHours} 小时，建议缩短至 24 小时以内`,
          impact: leadHours > 168 ? 'high' : 'medium',
          metric: 'lead time (hours)',
          currentValue: `${leadHours}h`,
          targetValue: '< 24h',
          suggestion: '采用小批量提交，减少代码合并冲突，实施持续集成',
        });
      }

      // Check change failure rate
      const failureRate = dora.changeFailureRate?.failureRate ?? 0;
      if (failureRate > 5) {
        bottlenecks.push({
          id: `bn-${String(idx++).padStart(3, '0')}`,
          category: '变更失败率',
          description: `变更失败率偏高 ${failureRate}%，建议控制在 5% 以内`,
          impact: failureRate > 15 ? 'high' : 'medium',
          metric: 'change failure rate',
          currentValue: `${failureRate}%`,
          targetValue: '< 5%',
          suggestion: '加强代码评审，增加自动化测试覆盖，实施渐进式发布',
        });
      }

      // Check MTTR
      const mttrHours = dora.meanTimeToRecovery?.averageRecoveryTimeMs
        ? Math.round(dora.meanTimeToRecovery.averageRecoveryTimeMs / (1000 * 60 * 60))
        : 0;
      if (mttrHours > 1) {
        bottlenecks.push({
          id: `bn-${String(idx++).padStart(3, '0')}`,
          category: '服务恢复时间',
          description: `平均恢复时间 ${mttrHours} 小时，建议控制在 1 小时以内`,
          impact: mttrHours > 24 ? 'high' : 'medium',
          metric: 'MTTR (hours)',
          currentValue: `${mttrHours}h`,
          targetValue: '< 1h',
          suggestion: '建立自动化故障检测和回滚机制，完善应急预案',
        });
      }
    }

    // If no bottlenecks found, return success message
    if (bottlenecks.length === 0) {
      bottlenecks.push({
        id: 'bn-ok',
        category: '整体健康',
        description: '当前 DORA 指标表现良好，无明显瓶颈',
        impact: 'low',
        metric: 'overall health',
        currentValue: 'healthy',
        targetValue: 'elite',
        suggestion: '继续保持当前实践，关注持续改进机会',
      });
    }

    return success(reply, request, { bottlenecks });
  });

  // ==================== Developer Profiles ====================

  /**
   * GET /efficiency/developer-profiles - Get developer profiles derived from team data
   */
  app.get('/developer-profiles', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId || getCurrentTenantId();

    // Derive developer profiles from registered team data
    const profiles = reportService.getDeveloperProfiles(tenantId);
    return success(reply, request, { profiles });
  });
}
