/**
 * PolicyEvaluationController - Policy Evaluation & Violation Management
 *
 * Handles evaluation execution, violation listing, waivers, overrides, and reports.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PolicyEvaluationService } from '../../services/policy/PolicyEvaluationService';

export class PolicyEvaluationController {
  constructor(private evaluationService: PolicyEvaluationService) {}

  async evaluate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as {
        policyId: string;
        resourceId: string;
        runId: string;
        resourceData: Record<string, unknown>;
      };
      if (!body.policyId || !body.resourceId || !body.runId) {
        reply.status(400).send({ code: 400, message: 'policyId, resourceId, and runId are required' });
        return;
      }
      const result = await this.evaluationService.evaluate(body);
      reply.send({ code: 200, message: 'Evaluation complete', data: result });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async evaluateGate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { gateId } = request.params as { gateId: string };
      const body = request.body as { resourceId: string; runId: string; resourceData: Record<string, unknown> };
      if (!body.resourceId || !body.runId) {
        reply.status(400).send({ code: 400, message: 'resourceId and runId are required' });
        return;
      }
      const result = await this.evaluationService.evaluate({
        policyId: gateId,
        resourceId: body.resourceId,
        runId: body.runId,
        resourceData: body.resourceData || {},
      });
      reply.send({ code: 200, message: 'Gate evaluated', data: result });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async listEvaluations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as { runId?: string; policyId?: string; limit?: number };
      const results = await this.evaluationService.listEvaluations({
        runId: query.runId,
        policyId: query.policyId,
        limit: query.limit ? parseInt(String(query.limit), 10) : 50,
      });
      reply.send({ code: 200, message: 'OK', data: results, total: results.length });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async listViolations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as { policyId?: string; severity?: string; resolved?: string };
      const results = await this.evaluationService.listViolations({
        policyId: query.policyId,
        severity: query.severity,
        resolved: query.resolved !== undefined ? query.resolved === 'true' : undefined,
      });
      reply.send({ code: 200, message: 'OK', data: results, total: results.length });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async getViolation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const violation = await this.evaluationService.getViolationById(id);
      if (!violation) {
        reply.status(404).send({ code: 404, message: 'Violation not found' });
        return;
      }
      reply.send({ code: 200, message: 'OK', data: violation });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async waiveViolation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { reason: string };
      if (!body.reason) {
        reply.status(400).send({ code: 400, message: 'reason is required' });
        return;
      }
      const result = await this.evaluationService.waiveViolation(id, body.reason);
      if (!result) {
        reply.status(404).send({ code: 404, message: 'Violation not found' });
        return;
      }
      reply.send({ code: 200, message: 'Violation waived', data: result });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async resolveViolation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const result = await this.evaluationService.resolveViolation(id);
      if (!result) {
        reply.status(404).send({ code: 404, message: 'Violation not found' });
        return;
      }
      reply.send({ code: 200, message: 'Violation resolved', data: result });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async listOverrides(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const results = await this.evaluationService.listOverrides();
      reply.send({ code: 200, message: 'OK', data: results });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async createOverride(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as { policyId: string; reason: string; overriddenBy: string };
      if (!body.policyId || !body.reason || !body.overriddenBy) {
        reply.status(400).send({ code: 400, message: 'policyId, reason, and overriddenBy are required' });
        return;
      }
      const result = await this.evaluationService.createOverride(body);
      reply.status(201).send({ code: 201, message: 'Override created', data: result });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }
}
