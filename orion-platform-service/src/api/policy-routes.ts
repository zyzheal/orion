/**
 * OPA Policy Engine API Routes
 *
 * Routes under /api/v1/policies
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PolicyService } from '../services/policy/PolicyService';
import { PolicyEvaluationService } from '../services/policy/PolicyEvaluationService';
import { PolicyController } from './controllers/PolicyController';
import { PolicyEvaluationController } from './controllers/PolicyEvaluationController';
import { EventBusService } from '../services/event-bus-service';

export default async function policyRoutes(
  app: FastifyInstance,
  options?: { eventBus?: EventBusService }
): Promise<void> {
  const policyService = new PolicyService({ eventBus: options?.eventBus });
  const evaluationService = new PolicyEvaluationService({ eventBus: options?.eventBus });
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

  app.patch('/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.togglePolicy(request, reply);
  });

  // ==================== Bundles ====================

  app.get('/bundles', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.listBundles(request, reply);
  });

  app.get('/bundles/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.getBundle(request, reply);
  });

  app.post('/bundles/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    return policyController.syncBundle(request, reply);
  });

  // ==================== Evaluation ====================

  app.post('/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return evalController.evaluate(request, reply);
  });

  app.get('/evaluations', async (request: FastifyRequest, reply: FastifyReply) => {
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
