/**
 * OPA Policy Engine API Routes
 *
 * Routes under /api/v1/policies
 * Migrated to PostgreSQL Repository pattern.
 *
 * Endpoints:
 *   CRUD for policies, evaluations, violations, overrides, bundles, exemptions
 *   Policy testing, evaluation, toggle, bundle sync
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PolicyService } from '../services/policy/PolicyService';
import { PolicyEvaluationService } from '../services/policy/PolicyEvaluationService';
import { ExemptionService } from '../services/policy/ExemptionService';
import { PolicyOverrideService } from '../services/policy/PolicyOverrideService';
import { PolicyController } from './controllers/PolicyController';
import { PolicyEvaluationController } from './controllers/PolicyEvaluationController';

interface PolicyRoutesOptions {
  database?: DatabasePool;
}

export default async function policyRoutes(app: FastifyInstance, options: PolicyRoutesOptions): Promise<void> {
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

  // GET /api/v1/policies - List policies
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.listPolicies(request, reply);
  });

  // POST /api/v1/policies - Create policy
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.createPolicy(request, reply);
  });

  // GET /api/v1/policies/:id - Get policy detail
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    if (['evaluate-policy', 'evaluations', 'violations', 'overrides', 'bundles', 'exemptions', 'test'].includes(params.id)) {
      return reply.callNotFound();
    }
    return policyController.getPolicy(request, reply);
  });

  // PUT /api/v1/policies/:id - Update policy
  app.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.updatePolicy(request, reply);
  });

  // DELETE /api/v1/policies/:id - Delete policy
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.deletePolicy(request, reply);
  });

  // ==================== Evaluation Endpoints ====================

  // POST /api/v1/policies/evaluate-policy - Evaluate policy against resource
  app.post('/evaluate-policy', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.evaluatePolicy(request, reply);
  });

  // GET /api/v1/policies/evaluations - Get evaluation history
  app.get('/evaluations', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.getEvaluationHistory(request, reply);
  });

  // POST /api/v1/policies/evaluate - Evaluate policy for specific run
  app.post('/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.evaluate(request, reply);
  });

  // GET /api/v1/policies/evaluations/runs - List evaluations
  app.get('/evaluations/runs', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.listEvaluations(request, reply);
  });

  // POST /api/v1/policies/gate/:gateId/evaluate - Evaluate gate
  app.post('/gate/:gateId/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.evaluateGate(request, reply);
  });

  // ==================== Violations ====================

  // GET /api/v1/policies/violations - List violations
  app.get('/violations', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.listViolations(request, reply);
  });

  // GET /api/v1/policies/violations/:id - Get violation detail
  app.get('/violations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.getViolation(request, reply);
  });

  // POST /api/v1/policies/violations/:id/waive - Waive violation
  app.post('/violations/:id/waive', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.waiveViolation(request, reply);
  });

  // POST /api/v1/policies/violations/:id/resolve - Resolve violation
  app.post('/violations/:id/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.resolveViolation(request, reply);
  });

  // ==================== Overrides ====================

  // GET /api/v1/policies/overrides - List overrides
  app.get('/overrides', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.listOverrides(request, reply);
  });

  // POST /api/v1/policies/overrides - Create override
  app.post('/overrides', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.createOverride(request, reply);
  });

  // ==================== Bundle Management ====================

  // GET /api/v1/policies/bundles - List bundles
  app.get('/bundles', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const bundles = await policyService.listBundles();
      return reply.send({ code: 200, message: 'OK', data: bundles });
    } catch (error) {
      return reply.status(500).send({ code: 500, message: (error as Error).message });
    }
  });

  // GET /api/v1/policies/bundles/:id - Get bundle detail
  app.get('/bundles/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const bundle = await policyService.getBundle(params.id);
      if (!bundle) {
        return reply.status(404).send({ code: 404, message: 'Bundle not found' });
      }
      return reply.send({ code: 200, message: 'OK', data: bundle });
    } catch (error) {
      return reply.status(500).send({ code: 500, message: (error as Error).message });
    }
  });

  // POST /api/v1/policies/bundles/sync - Sync bundles
  app.post('/bundles/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { sourceUrl?: string };
      const result = await policyService.syncBundles(body.sourceUrl || '');
      return reply.send({ code: 200, message: 'OK', data: result });
    } catch (error) {
      return reply.status(500).send({ code: 500, message: (error as Error).message });
    }
  });

  // ==================== Policy Testing ====================

  // POST /api/v1/policies/test - Test policy
  app.post('/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { rego?: string; testCases?: unknown[] };
    if (!body.rego || !body.testCases) {
      return reply.status(400).send({ code: 400, message: 'rego and testCases are required' });
    }
    try {
      const results = await policyService.testPolicy(body.rego, body.testCases);
      return reply.send({ code: 200, message: 'OK', data: results });
    } catch (error) {
      return reply.status(400).send({ code: 400, message: (error as Error).message });
    }
  });

  // GET /api/v1/policies/test/results/:testId - Test results (ephemeral)
  app.get('/test/results/:testId', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send({ code: 404, message: 'Test results are ephemeral. Use POST /test to re-evaluate.' });
  });

  // ==================== Toggle Policy ====================

  // PATCH /api/v1/policies/:id/toggle - Toggle policy
  app.patch('/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    if (['evaluate-policy', 'evaluations', 'violations', 'overrides', 'bundles', 'test', 'exemptions'].includes(params.id)) {
      return reply.callNotFound();
    }
    try {
      const policy = await policyService.toggle(params.id, true);
      return reply.send({ code: 200, message: 'OK', data: policy });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        return reply.status(404).send({ code: 404, message: (error as Error).message });
      }
      return reply.status(500).send({ code: 500, message: (error as Error).message });
    }
  });

  // ==================== Exemption Management ====================

  // POST /api/v1/policies/exemptions - Submit exemption
  app.post('/exemptions', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      violationId?: string;
      policyId?: string;
      runId?: string;
      reason?: string;
      category?: string;
      requestedBy?: string;
      expiresAt?: string;
    };
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
    } catch (error) {
      const err = error as { code?: string; message: string };
      if (err.code === 'INVALID_INPUT') {
        return reply.status(400).send({ code: 400, message: err.message });
      }
      return reply.status(500).send({ code: 500, message: err.message });
    }
  });

  // GET /api/v1/policies/exemptions - List exemptions
  app.get('/exemptions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const result = await exemptionService.getExemptions({
        status: query.status,
        policyId: query.policyId,
        requestedBy: query.requestedBy,
        category: query.category,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return reply.send({ code: 200, message: 'OK', data: result.exemptions, total: result.total });
    } catch (error) {
      return reply.status(500).send({ code: 500, message: (error as Error).message });
    }
  });

  // GET /api/v1/policies/exemptions/:id - Get exemption
  app.get('/exemptions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const exemption = await exemptionService.getExemptionById(params.id);
      return reply.send({ code: 200, message: 'OK', data: exemption });
    } catch (error) {
      const err = error as { code?: string; message: string };
      if (err.code === 'NOT_FOUND') {
        return reply.status(404).send({ code: 404, message: err.message });
      }
      return reply.status(500).send({ code: 500, message: err.message });
    }
  });

  // POST /api/v1/policies/exemptions/:id/review - Review exemption
  app.post('/exemptions/:id/review', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as { action?: string; comment?: string; reviewer?: string };
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
    } catch (error) {
      const err = error as { code?: string; message: string };
      if (err.code === 'NOT_FOUND' || err.code === 'INVALID_STATE') {
        return reply.status(400).send({ code: 400, message: err.message });
      }
      return reply.status(500).send({ code: 500, message: err.message });
    }
  });

  // DELETE /api/v1/policies/exemptions/:id - Revoke exemption
  app.delete('/exemptions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const exemption = await exemptionService.revokeExemption(params.id);
      return reply.send({ code: 200, message: 'Exemption revoked', data: exemption });
    } catch (error) {
      const err = error as { code?: string; message: string };
      if (err.code === 'NOT_FOUND' || err.code === 'INVALID_STATE') {
        return reply.status(400).send({ code: 400, message: err.message });
      }
      return reply.status(500).send({ code: 500, message: err.message });
    }
  });
}
