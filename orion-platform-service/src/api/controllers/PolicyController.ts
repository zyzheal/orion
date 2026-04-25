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
      const policies = await this.policyService.listPolicies(query.tenantId);
      await reply.send({ success: true, data: policies, total: policies.length });
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
      if (!body.tenantId || !body.name || !body.resource || !body.action || !body.regoCode) {
        await reply.status(400).send({
          success: false,
          error: 'tenantId, name, resource, action, and regoCode are required',
        });
        return;
      }
      const policy = await this.policyService.createPolicy(
        body.tenantId, body.name, body.resource, body.action, body.regoCode, body.effect
      );
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
        name: body.name,
        rego_code: body.regoCode,
        enabled: body.enabled,
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
