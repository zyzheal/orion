import { type FastifyInstance } from 'fastify';
import { RootCauseAnalysisService } from '../services/RootCauseAnalysisService';

/**
 * Register Root Cause Analysis routes.
 *
 * Routes:
 * - POST /api/v1/alerts/rca/analyze - Analyze incident for root causes
 * - GET /api/v1/alerts/rca/:incidentId/timeline - Get incident timeline
 * - GET /api/v1/alerts/rca/:rootCauseId/fixes - Suggest fixes for root cause
 */
export function registerRCARoutes(fastify: FastifyInstance, rcaService: RootCauseAnalysisService): void {
  // Analyze incident for root causes
  fastify.post<{
    Body: {
      incidentId: string;
      timeRange: { start: string; end: string };
      includePatterns?: string[];
      excludePatterns?: string[];
    };
  }>('/api/v1/alerts/rca/analyze', async (request, reply) => {
    // Note: tenantId can be used for multi-tenant isolation in production
    void request.headers['x-tenant-id'];
    const { incidentId, timeRange, includePatterns, excludePatterns } = request.body;

    if (!incidentId || !timeRange?.start || !timeRange?.end) {
      return reply.code(400).send({
        error: 'Missing required fields: incidentId, timeRange.start, timeRange.end',
      });
    }

    const rcaRequest = {
      incidentId,
      timeRange: {
        start: new Date(timeRange.start),
        end: new Date(timeRange.end),
      },
      includePatterns,
      excludePatterns,
    };

    const report = await rcaService.analyze(rcaRequest);
    return reply.send(report);
  });

  // Get incident timeline
  fastify.get<{
    Params: { incidentId: string };
  }>('/api/v1/alerts/rca/:incidentId/timeline', async (request, reply) => {
    const { incidentId } = request.params as { incidentId: string };

    if (!incidentId) {
      return reply.code(400).send({
        error: 'Missing required parameter: incidentId',
      });
    }

    const timeline = await rcaService.getTimeline(incidentId);
    return reply.send({ incidentId, timeline });
  });

  // Suggest fixes for root cause
  fastify.get<{
    Params: { rootCauseId: string };
  }>('/api/v1/alerts/rca/:rootCauseId/fixes', async (request, reply) => {
    const { rootCauseId } = request.params as { rootCauseId: string };

    if (!rootCauseId) {
      return reply.code(400).send({
        error: 'Missing required parameter: rootCauseId',
      });
    }

    const fixes = await rcaService.suggestFixes(rootCauseId);
    return reply.send({ rootCauseId, fixes });
  });
}