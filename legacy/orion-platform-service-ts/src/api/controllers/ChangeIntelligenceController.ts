/**
 * Change Intelligence Controller - AI 变更智能分析 HTTP handlers
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ChangeIntelligenceService } from '../../services/change-intelligence/ChangeIntelligenceService';

export class ChangeIntelligenceController {
  private service: ChangeIntelligenceService;

  constructor(service: ChangeIntelligenceService) {
    this.service = service;
  }

  async analyze(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.prId || !body.repoId || !body.commitSha) {
        await reply.status(400).send({
          success: false,
          error: 'prId, repoId, and commitSha are required',
        });
        return;
      }

      const result = await this.service.analyze(body);
      await reply.status(201).send({
        success: true,
        data: {
          report: result.report,
          affectedServices: result.affectedServices,
          riskFactors: result.riskFactors,
          historicalMatches: result.historicalMatches,
        },
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Analysis failed',
      });
    }
  }

  async listReports(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const reports = await this.service.list({
        prId: query.prId,
        repoId: query.repoId,
        riskLevel: query.riskLevel,
        days: query.days ? parseInt(query.days) : undefined,
      });
      await reply.send({ success: true, data: reports, total: reports.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const report = await this.service.getById(params.id);
      if (!report) {
        await reply.status(404).send({ success: false, error: 'Report not found' });
        return;
      }
      await reply.send({ success: true, data: report });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getBlastRadius(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const blastRadius = await this.service.getBlastRadius(params.id);
      await reply.send({ success: true, data: blastRadius });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }
}
