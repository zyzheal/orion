/**
 * OPA Policy Engine API Routes
 *
 * Routes under /api/v1/policies
 * Migrated to PostgreSQL Repository pattern
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PolicyService } from '../services/policy/PolicyService';
import { PolicyEvaluationService } from '../services/policy/PolicyEvaluationService';
import { ExemptionService } from '../services/policy/ExemptionService';
import { PolicyOverrideService } from '../services/policy/PolicyOverrideService';
import { PolicyController } from './controllers/PolicyController';
import { PolicyEvaluationController } from './controllers/PolicyEvaluationController';
import { EventBusService } from '../services/event-bus-service';

interface PolicyRoutesOptions {
  database?: DatabasePool;
  eventBus?: EventBusService;
}

export default async function policyRoutes(
  app: FastifyInstance,
  options: PolicyRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  if (!options.database) {
    console.warn('[PolicyRoutes] No database pool provided, policy routes will not be functional');
    return;
  }

  const policyService = new PolicyService(options.database);
  const evaluationService = new PolicyEvaluationService(options.database);
  const exemptionService = new ExemptionService(options.database);
  const overrideService = new PolicyOverrideService(options.database);

  const policyController = new PolicyController(policyService);
  const evalController = new PolicyEvaluationController(evaluationService);

  // ==================== Policy Definitions CRUD ====================

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.listPolicies(request, reply);
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.createPolicy(request, reply);
  });

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    if (params.id === 'evaluate' || params.id === 'violations' || params.id === 'overrides' || params.id === 'bundles' || params.id === 'exemptions' || params.id === 'test') {
      return reply.callNotFound();
    }
    return policyController.getPolicy(request, reply);
  });

  app.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.updatePolicy(request, reply);
  });

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.deletePolicy(request, reply);
  });

  // ==================== Evaluation Endpoints ====================
  // PolicyController.evaluate — evaluate policy against a resource
  app.post('/evaluate-policy', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.evaluatePolicy(request, reply);
  });

  app.get('/evaluations', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.getEvaluationHistory(request, reply);
  });

  // PolicyEvaluationController — evaluate policy for a specific run
  app.post('/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.evaluate(request, reply);
  });

  app.get('/evaluations/runs', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.listEvaluations(request, reply);
  });

  app.post('/gate/:gateId/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.evaluateGate(request, reply);
  });

  // ==================== Violations ====================

  app.get('/violations', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.listViolations(request, reply);
  });

  app.get('/violations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.getViolation(request, reply);
  });

  app.post('/violations/:id/waive', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.waiveViolation(request, reply);
  });

  app.post('/violations/:id/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.resolveViolation(request, reply);
  });

  // ==================== Overrides ====================

  app.get('/overrides', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.listOverrides(request, reply);
  });

  app.post('/overrides', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.createOverride(request, reply);
  });

  // ==================== Bundle Management ====================

  app.get('/bundles', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const bundles = await policyService.listBundles();
      return reply.send({ code: 200, message: 'OK', data: bundles });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.get('/bundles/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const bundle = await policyService.getBundle(params.id);
      if (!bundle) {
        return reply.status(404).send({ code: 404, message: 'Bundle not found' });
      }
      return reply.send({ code: 200, message: 'OK', data: bundle });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.post('/bundles/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { sourceUrl?: string } || {};
      const result = await policyService.syncBundles(body.sourceUrl || '');
      return reply.send({ code: 200, message: 'OK', data: result });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Policy Testing ====================

  app.post('/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      rego: string;
      testCases: Array<Record<string, unknown>>;
    };
    if (!body.rego || !body.testCases) {
      return reply.status(400).send({ code: 400, message: 'rego and testCases are required' });
    }
    try {
      const results = await policyService.testPolicy(body.rego, body.testCases);
      return reply.send({ code: 200, message: 'OK', data: results });
    } catch (error: any) {
      return reply.status(400).send({ code: 400, message: error.message });
    }
  });

  app.get('/test/results/:testId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { testId: string };
    return reply.status(404).send({ code: 404, message: 'Test results are ephemeral in MVP. Use POST /test to re-evaluate.' });
  });

  // ==================== Toggle Policy ====================

  app.patch('/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    if (['evaluate-policy', 'evaluations', 'violations', 'overrides', 'bundles', 'test', 'exemptions'].includes(params.id)) {
      return reply.callNotFound();
    }
    try {
      const policy = await policyService.toggle(params.id, true);
      return reply.send({ code: 200, message: 'OK', data: policy });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ code: 404, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Exemption Management ====================

  app.post('/exemptions', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body.violationId || !body.reason || !body.category || !body.requestedBy) {
      return reply.status(400).send({ code: 400, message: 'violationId, reason, category, and requestedBy are required' });
    }
    try {
      const exemption = await exemptionService.submitExemption({
        violationId: body.violationId,
        policyId: body.policyId || '',
        runId: body.runId || '',
        reason: body.reason,
        category: body.category,
        requestedBy: body.requestedBy,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });
      return reply.status(201).send({ code: 201, message: 'Exemption submitted', data: exemption });
    } catch (error: any) {
      if (error.code === 'INVALID_INPUT') {
        return reply.status(400).send({ code: 400, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.get('/exemptions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const result = await exemptionService.getExemptions({
        status: query.status,
        policyId: query.policyId,
        requestedBy: query.requestedBy,
        category: query.category,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return reply.send({ code: 200, message: 'OK', data: result.exemptions, total: result.total });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.get('/exemptions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const exemption = await exemptionService.getExemptionById(params.id);
      return reply.send({ code: 200, message: 'OK', data: exemption });
    } catch (error: any) {
      if (error.code === 'NOT_FOUND') {
        return reply.status(404).send({ code: 404, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.post('/exemptions/:id/review', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as any;
    if (!body.action || !body.reviewer) {
      return reply.status(400).send({ code: 400, message: 'action and reviewer are required' });
    }
    try {
      const exemption = await exemptionService.reviewExemption(params.id, {
        action: body.action,
        comment: body.comment,
        reviewer: body.reviewer,
      });
      return reply.send({ code: 200, message: `Exemption ${body.action}d`, data: exemption });
    } catch (error: any) {
      if (error.code === 'NOT_FOUND' || error.code === 'INVALID_STATE') {
        return reply.status(400).send({ code: 400, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.delete('/exemptions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const exemption = await exemptionService.revokeExemption(params.id);
      return reply.send({ code: 200, message: 'Exemption revoked', data: exemption });
    } catch (error: any) {
      if (error.code === 'NOT_FOUND' || error.code === 'INVALID_STATE') {
        return reply.status(400).send({ code: 400, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
}
