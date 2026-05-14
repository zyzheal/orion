/**
 * Policy Evaluation Controller - 策略评估、违规、豁免 HTTP handlers
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PolicyEvaluationService } from '../../services/policy/PolicyEvaluationService';

export class PolicyEvaluationController {
  private evaluationService: PolicyEvaluationService;

  constructor(evaluationService: PolicyEvaluationService) {
    this.evaluationService = evaluationService;
  }

  // ==================== Evaluation ====================

  async evaluate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.policyId || !body.runId) {
        await reply.status(400).send({
          success: false,
          error: 'policyId and runId are required',
        });
        return;
      }

      const result = await this.evaluationService.evaluate({
        policyId: body.policyId,
        tenantId: body.tenantId || 'default',
        runId: body.runId,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        action: body.action,
        context: body.inputContext,
      });
      await reply.status(201).send({ success: true, data: result });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Evaluation failed',
      });
    }
  }

  async evaluateGate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;

      const result = await this.evaluationService.evaluateGate(params.gateId, body.inputContext || {});
      await reply.send({ success: true, data: result });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Gate evaluation failed',
      });
    }
  }

  async listEvaluations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const evaluations = await this.evaluationService.getEvaluations(query.runId || '');
      await reply.send({ success: true, data: evaluations, total: evaluations.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Violations ====================

  async listViolations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const violations = await this.evaluationService.getOpenViolations(query.status || 'open');
      await reply.send({ success: true, data: violations, total: violations.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getViolation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const violation = await this.evaluationService.getViolationById(params.id);
      if (!violation) {
        await reply.status(404).send({ success: false, error: 'Violation not found' });
        return;
      }
      await reply.send({ success: true, data: violation });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async waiveViolation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      if (!body.reason) {
        await reply.status(400).send({ success: false, error: 'reason is required' });
        return;
      }
      const violation = await this.evaluationService.waiveViolation(params.id, body.reason);
      if (!violation) {
        await reply.status(404).send({ success: false, error: 'Violation not found' });
        return;
      }
      await reply.send({ success: true, data: violation });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to waive violation',
      });
    }
  }

  async resolveViolation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const violation = await this.evaluationService.resolveViolation(params.id, body.resolution || 'resolved');
      if (!violation) {
        await reply.status(404).send({ success: false, error: 'Violation not found' });
        return;
      }
      await reply.send({ success: true, data: violation });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to resolve violation',
      });
    }
  }

  // ==================== Overrides ====================

  async listOverrides(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const overrides = await this.evaluationService.listOverrides(query.policyId);
      await reply.send({ success: true, data: overrides, total: overrides.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async createOverride(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.policyId || !body.violationId || !body.reason) {
        await reply.status(400).send({
          success: false,
          error: 'policyId, violationId, and reason are required',
        });
        return;
      }
      const override = await this.evaluationService.createOverride(body.policyId, body.violationId, body.reason);
      await reply.status(201).send({ success: true, data: override });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create override',
      });
    }
  }
}
