/**
 * Metrics Controller - Fastify HTTP request/response handlers
 *
 * Bridges HTTP layer to MetricsService (PostgreSQL-backed)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { MetricsService, MetricsServiceError } from '../../services/metrics/MetricsService';

export class MetricsController {
  private service: MetricsService;

  constructor(service: MetricsService) {
    this.service = service;
  }

  // ==================== Record Metric ====================

  /**
   * POST /api/v1/metrics/record
   * Body: { tenantId, name, value, unit }
   */
  async record(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.tenantId || !body.name || body.value === undefined || !body.unit) {
        await reply.status(400).send({
          success: false,
          error: 'tenantId, name, value, and unit are required',
        });
        return;
      }
      const metric = await this.service.record(
        body.tenantId as string,
        body.name as string,
        body.value as number,
        body.unit as string
      );
      await reply.status(201).send({ success: true, data: metric });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to record metric',
      });
    }
  }

  // ==================== Query Metrics ====================

  /**
   * POST /api/v1/metrics/query
   * Body: { tenantId, name, startTime, endTime }
   */
  async query(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.tenantId || !body.name) {
        await reply.status(400).send({
          success: false,
          error: 'tenantId and name are required',
        });
        return;
      }
      const startTime = body.startTime ? new Date(body.startTime as string) : new Date(Date.now() - 3600000);
      const endTime = body.endTime ? new Date(body.endTime as string) : new Date();

      const metrics = await this.service.query(
        body.tenantId as string,
        body.name as string,
        startTime,
        endTime
      );
      await reply.send({ success: true, data: metrics, total: metrics.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to query metrics',
      });
    }
  }

  // ==================== Get Stats (Aggregate) ====================

  /**
   * POST /api/v1/metrics/stats
   * Body: { tenantId, name, startTime, endTime }
   * Returns: { avg, min, max, count }
   */
  async getStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.tenantId || !body.name) {
        await reply.status(400).send({
          success: false,
          error: 'tenantId and name are required',
        });
        return;
      }
      const startTime = body.startTime ? new Date(body.startTime as string) : new Date(Date.now() - 3600000);
      const endTime = body.endTime ? new Date(body.endTime as string) : new Date();

      const stats = await this.service.getStats(
        body.tenantId as string,
        body.name as string,
        startTime,
        endTime
      );
      await reply.send({ success: true, data: stats });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get metrics stats',
      });
    }
  }
}
