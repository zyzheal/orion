/**
 * OPA Policy Engine API Routes
 *
 * Routes under /api/v1/policies
 * Migrated to PostgreSQL Repository pattern
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PolicyRepository } from '../services/policy/PolicyRepository';
import { PolicyService } from '../services/policy/PolicyService';
import { PolicyEvaluationService } from '../services/policy/PolicyEvaluationService';
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

  const policyRepo = new PolicyRepository(options.database);
  const policyService = new PolicyService(policyRepo);
  const evaluationService = new PolicyEvaluationService({
    eventBus: options.eventBus,
    db: options.database,
  });

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
    if (params.id === 'evaluate' || params.id === 'violations' || params.id === 'overrides' || params.id === 'bundles') {
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
}
