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
      const policies = await this.policyService.list({
        category: query.category,
        severity: query.severity,
        enabled: query.enabled !== undefined ? query.enabled === 'true' : undefined,
        gateId: query.gateId,
      });
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
      const policy = await this.policyService.getById(params.id);
      if (!policy) {
        await reply.status(404).send({ success: false, error: 'Policy not found' });
        return;
      }
      await reply.send({ success: true, data: policy });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
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
      const policy = await this.policyService.create(body);
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
      const policy = await this.policyService.update(params.id, body);
      if (!policy) {
        await reply.status(404).send({ success: false, error: 'Policy not found' });
        return;
      }
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
      const deleted = await this.policyService.delete(params.id);
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

  async togglePolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const policy = await this.policyService.toggle(params.id);
      if (!policy) {
        await reply.status(404).send({ success: false, error: 'Policy not found' });
        return;
      }
      await reply.send({ success: true, data: policy });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to toggle policy',
      });
    }
  }

  // ==================== Bundle ====================

  async listBundles(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const bundles = await this.policyService.listBundles();
      await reply.send({ success: true, data: bundles, total: bundles.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getBundle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const bundle = await this.policyService.getBundleById(params.id);
      if (!bundle) {
        await reply.status(404).send({ success: false, error: 'Bundle not found' });
        return;
      }
      await reply.send({ success: true, data: bundle });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async syncBundle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const bundle = await this.policyService.syncBundle(
        body.gitRef || 'main',
        body.bundleName || 'default'
      );
      await reply.status(201).send({ success: true, data: bundle });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to sync bundle',
      });
    }
  }
}
