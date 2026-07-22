/**
 * Canary Analysis Controller - ML 金丝雀分析 HTTP handlers
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { CanaryAnalysisService } from '../../services/canary-analysis/CanaryAnalysisService';

export class CanaryAnalysisController {
  private service: CanaryAnalysisService;

  constructor(service: CanaryAnalysisService) {
    this.service = service;
  }

  // ==================== Runs ====================

  async listRuns(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const runs = await this.service.listRuns({
        deploymentId: query.deploymentId,
        status: query.status,
      });
      await reply.send({ success: true, data: runs, total: runs.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async createRun(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.deploymentId) {
        await reply.status(400).send({ success: false, error: 'deploymentId is required' });
        return;
      }

      const result = await this.service.simulateAnalysisRun({
        deploymentId: body.deploymentId,
        runNumber: body.runNumber || 1,
        trafficSplit: body.trafficSplit || { canary: 10, baseline: 90 },
      });

      await reply.status(201).send({
        success: true,
        data: {
          run: result.run,
          metrics: result.metrics,
          mlResults: result.mlResults,
        },
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to start canary analysis',
      });
    }
  }

  async getRun(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const run = await this.service.getRunById(params.id);
      if (!run) {
        await reply.status(404).send({ success: false, error: 'Canary run not found' });
        return;
      }
      await reply.send({ success: true, data: run });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Metrics ====================

  async getMetrics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const metrics = await this.service.getMetrics(params.id);
      await reply.send({ success: true, data: metrics, total: metrics.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== ML Results ====================

  async getMLResults(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const results = await this.service.getMLResults(params.id);
      await reply.send({ success: true, data: results, total: results.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Configs ====================

  async listConfigs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const configs = await this.service.listConfigs();
      await reply.send({ success: true, data: configs, total: configs.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async createConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.serviceName || !body.environment) {
        await reply.status(400).send({
          success: false,
          error: 'serviceName and environment are required',
        });
        return;
      }
      const config = await this.service.createConfig(body);
      await reply.status(201).send({ success: true, data: config });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create config',
      });
    }
  }

  async getConfigByServiceEnv(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const config = await this.service.getConfigByServiceEnv(params.service, params.env);
      if (!config) {
        await reply.status(404).send({ success: false, error: 'Config not found' });
        return;
      }
      await reply.send({ success: true, data: config });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async updateConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const config = await this.service.updateConfig(params.id, body);
      if (!config) {
        await reply.status(404).send({ success: false, error: 'Config not found' });
        return;
      }
      await reply.send({ success: true, data: config });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update config',
      });
    }
  }

  async deleteConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const deleted = await this.service.deleteConfig(params.id);
      if (!deleted) {
        await reply.status(404).send({ success: false, error: 'Config not found' });
        return;
      }
      await reply.send({ success: true, message: 'Config deleted' });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Force Actions ====================

  async forcePromote(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.runId) {
        await reply.status(400).send({ success: false, error: 'runId is required' });
        return;
      }
      const run = await this.service.forcePromote(body.runId, body.reason || 'Manual force promote');
      await reply.send({ success: true, data: run });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to force promote',
      });
    }
  }

  async forceRollback(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.runId) {
        await reply.status(400).send({ success: false, error: 'runId is required' });
        return;
      }
      const run = await this.service.forceRollback(body.runId, body.reason || 'Manual force rollback');
      await reply.send({ success: true, data: run });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to force rollback',
      });
    }
  }
}
