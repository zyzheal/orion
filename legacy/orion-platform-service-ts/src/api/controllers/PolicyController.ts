/**
 * Policy Controller - OPA 策略管理 HTTP handlers
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PolicyService } from '../../services/policy/PolicyService';

export class PolicyController {
  private policyService: PolicyService;

  constructor(policyService: PolicyService) {
    this.policyService = policyService;
  }

  // ==================== Policy Definition CRUD ====================

  async listPolicies(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const result = await this.policyService.listPolicies(query.tenantId);
      await reply.send({ success: true, data: result.policies, total: result.total });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getPolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const policy = await this.policyService.getPolicy(params.id);
      await reply.send({ success: true, data: policy });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Policy not found')) {
        await reply.status(404).send({ success: false, error: err.message });
      } else {
        await reply.status(500).send({
          success: false,
          error: err instanceof Error ? err.message : 'Internal server error',
        });
      }
    }
  }

  async createPolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.name || !body.category || !body.regoPath) {
        await reply.status(400).send({
          success: false,
          error: 'name, category, and regoPath are required',
        });
        return;
      }
      const policy = await this.policyService.createPolicy({
        name: body.name,
        description: body.description,
        category: body.category,
        regoPath: body.regoPath,
        gateId: body.gateId,
        severity: body.severity,
        metadata: body.metadata,
      });
      await reply.status(201).send({ success: true, data: policy });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create policy',
      });
    }
  }

  async updatePolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const policy = await this.policyService.updatePolicy(params.id, {
        description: body.description,
        category: body.category,
        regoPath: body.regoPath,
        gateId: body.gateId,
        severity: body.severity,
        enabled: body.enabled,
        metadata: body.metadata,
      });
      await reply.send({ success: true, data: policy });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update policy',
      });
    }
  }

  async deletePolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const deleted = await this.policyService.deletePolicy(params.id);
      if (!deleted) {
        await reply.status(404).send({ success: false, error: 'Policy not found' });
        return;
      }
      await reply.send({ success: true, message: 'Policy deleted' });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async evaluatePolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const result = await this.policyService.evaluate(
        body.tenantId, body.resourceType, body.resourceId, body.action, body.context || {}
      );
      await reply.send({ success: true, data: result });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to evaluate policy',
      });
    }
  }

  async getEvaluationHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const evaluations = await this.policyService.getEvaluationHistory(
        query.tenantId, query.limit ? parseInt(query.limit) : undefined
      );
      await reply.send({ success: true, data: evaluations, total: evaluations.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }
}
