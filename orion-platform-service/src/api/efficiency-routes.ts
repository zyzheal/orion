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
}
