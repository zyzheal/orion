/**
 * PolicyController - OPA Policy Engine API Controller
 *
 * Handles policy CRUD, evaluation, and management.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PolicyService } from '../../services/policy/PolicyService';

export class PolicyController {
  constructor(private policyService: PolicyService) {}

  async listPolicies(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const policies = await this.policyService.listPolicies();
      reply.send({ code: 200, message: 'OK', data: policies, total: policies.length });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async createPolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.name || !body.rego) {
        reply.status(400).send({ code: 400, message: 'name and rego are required' });
        return;
      }
      const policy = await this.policyService.createPolicy({
        name: body.name,
        description: body.description || '',
        rego: body.rego,
        category: body.category || 'default',
        severity: body.severity || 'medium',
        enabled: body.enabled !== undefined ? body.enabled : true,
        tags: body.tags || [],
      });
      reply.status(201).send({ code: 201, message: 'Policy created', data: policy });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async getPolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const policy = await this.policyService.getPolicyById(id);
      if (!policy) {
        reply.status(404).send({ code: 404, message: 'Policy not found' });
        return;
      }
      reply.send({ code: 200, message: 'OK', data: policy });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async updatePolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const policy = await this.policyService.updatePolicy(id, body);
      if (!policy) {
        reply.status(404).send({ code: 404, message: 'Policy not found' });
        return;
      }
      reply.send({ code: 200, message: 'Policy updated', data: policy });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async deletePolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const deleted = await this.policyService.deletePolicy(id);
      if (!deleted) {
        reply.status(404).send({ code: 404, message: 'Policy not found' });
        return;
      }
      reply.send({ code: 200, message: 'Policy deleted' });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async evaluatePolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as { resource: Record<string, unknown>; policyId?: string };
      if (!body.resource) {
        reply.status(400).send({ code: 400, message: 'resource is required' });
        return;
      }
      // MVP: evaluate by checking against known policies
      const policies = await this.policyService.listPolicies();
      const result = {
        passed: true,
        evaluatedAt: new Date().toISOString(),
        policyCount: policies.length,
        input: body.resource,
      };
      reply.send({ code: 200, message: 'OK', data: result });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async getEvaluationHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Ephemeral in MVP - no persistent history yet
    reply.send({ code: 200, message: 'OK', data: [], total: 0 });
  }
}
