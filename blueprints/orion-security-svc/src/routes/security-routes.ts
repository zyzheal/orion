/**
 * Security Service Unified API Routes
 *
 * Central route registry for orion-security-svc
 * Routes under /api/v1/security/*
 *
 * This file provides a unified entry point for all security-related endpoints.
 * Individual feature routes are mounted as sub-routes.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../utils/database';
import { EventBusService } from '../services/event-bus-service';

// Import existing route modules
import riskRoutes from './risk';
import sbomRoutes from './sbom';
import supplyChainRoutes from './supply-chain';
import policyRoutes from './policy';
import qualityGateRoutes from './quality-gate';

// Import OPA Policy Service
import { OPAPolicyService, Policy, PolicyRule, PolicyEvaluationRequest, PolicyEvaluationResult } from '../services/OPAPolicyService';

interface SecurityRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
}

// Initialize OPA Policy Service
const opaPolicyService = new OPAPolicyService();

/**
 * Register all security service routes
 */
export default async function securityRoutes(
  app: FastifyInstance,
  options: SecurityRoutesOptions
): Promise<void> {
  // Mount sub-routes
  await app.register(riskRoutes, { prefix: '/api/v1/risk' });
  await app.register(sbomRoutes, { prefix: '/api/v1/sbom', database: options.database, eventBus: options.eventBus });
  await app.register(supplyChainRoutes, { prefix: '/api/v1/supply-chain' });
  await app.register(policyRoutes, { prefix: '/api/v1/policies', database: options.database, eventBus: options.eventBus });
  await app.register(qualityGateRoutes, { prefix: '/api/v1/quality-gates', database: options.database, eventBus: options.eventBus });

  // ==================== OPA Policy Engine Routes ====================
  // Routes under /api/v1/security/policies

  /**
   * POST /api/v1/security/policies
   * Create a new policy
   */
  app.post('/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      description: string;
      rules: Omit<PolicyRule, 'id'>[];
      enforcement: Policy['enforcement'];
    };

    if (!body.name || !body.rules || !body.enforcement) {
      return reply.status(400).send({ success: false, error: 'name, rules, and enforcement are required' });
    }

    try {
      const policy = await opaPolicyService.createPolicy(
        body.name,
        body.description || '',
        body.rules,
        body.enforcement
      );
      return reply.status(201).send({ success: true, data: policy });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/v1/security/policies
   * List all policies
   */
  app.get('/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { enabledOnly?: string };
    try {
      const policies = await opaPolicyService.listPolicies(query.enabledOnly === 'true');
      return reply.send({ success: true, data: policies });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/v1/security/policies/:id
   * Get a policy by ID
   */
  app.get('/policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const policy = await opaPolicyService.getPolicy(params.id);
      if (!policy) {
        return reply.status(404).send({ success: false, error: 'Policy not found' });
      }
      return reply.send({ success: true, data: policy });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/v1/security/policies/:id
   * Update a policy
   */
  app.put('/policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as Partial<Policy>;

    try {
      const policy = await opaPolicyService.updatePolicy(params.id, body);
      if (!policy) {
        return reply.status(404).send({ success: false, error: 'Policy not found' });
      }
      return reply.send({ success: true, data: policy });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/v1/security/policies/:id
   * Delete a policy
   */
  app.delete('/policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const deleted = await opaPolicyService.deletePolicy(params.id);
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'Policy not found' });
      }
      return reply.send({ success: true, message: 'Policy deleted' });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/v1/security/policies/evaluate
   * Evaluate input against policies
   */
  app.post('/policies/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as PolicyEvaluationRequest;

    if (!body.input) {
      return reply.status(400).send({ success: false, error: 'input is required' });
    }

    try {
      const result = await opaPolicyService.evaluate(body);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/v1/security/policies/bundles
   * Create a policy bundle
   */
  app.post('/policies/bundles', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      policyIds: string[];
    };

    if (!body.name || !body.policyIds) {
      return reply.status(400).send({ success: false, error: 'name and policyIds are required' });
    }

    try {
      const bundle = await opaPolicyService.createBundle(body.name, body.policyIds);
      return reply.status(201).send({ success: true, data: bundle });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/v1/security/policies/bundles
   * List all bundles
   */
  app.get('/policies/bundles', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const bundles = await opaPolicyService.listBundles();
      return reply.send({ success: true, data: bundles });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/v1/security/policies/bundles/:id
   * Get a bundle by ID
   */
  app.get('/policies/bundles/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const bundle = await opaPolicyService.getBundle(params.id);
      if (!bundle) {
        return reply.status(404).send({ success: false, error: 'Bundle not found' });
      }
      return reply.send({ success: true, data: bundle });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/v1/security/policies/bundles/:id/evaluate
   * Evaluate input against a bundle
   */
  app.post('/policies/bundles/:id/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as { input: Record<string, unknown> };

    if (!body.input) {
      return reply.status(400).send({ success: false, error: 'input is required' });
    }

    try {
      const result = await opaPolicyService.evaluateBundle(params.id, body.input);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      if (error.message === 'Bundle not found') {
        return reply.status(404).send({ success: false, error: error.message });
      }
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/v1/security/policies/bundles/:id
   * Delete a bundle
   */
  app.delete('/policies/bundles/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const deleted = await opaPolicyService.deleteBundle(params.id);
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'Bundle not found' });
      }
      return reply.send({ success: true, message: 'Bundle deleted' });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * PATCH /api/v1/security/policies/:id/toggle
   * Toggle policy enabled state
   */
  app.patch('/policies/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const policy = await opaPolicyService.togglePolicy(params.id);
      if (!policy) {
        return reply.status(404).send({ success: false, error: 'Policy not found' });
      }
      return reply.send({ success: true, data: policy });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ==================== Security Dashboard ====================

  /**
   * GET /api/v1/security/dashboard
   * Get security dashboard summary
   */
  app.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { tenantId?: string };
    try {
      // TODO: Implement dashboard aggregation service
      return reply.send({
        success: true,
        data: {
          summary: {
            totalSbomDocuments: 0,
            activePolicies: 0,
            openViolations: 0,
            riskAssessments: 0,
          },
          trends: {
            vulnerabilities: [],
            policyCompliance: [],
          },
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/v1/security/status
   * Get overall security status
   */
  app.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send({
        success: true,
        data: {
          status: 'healthy',
          components: {
            sbom: 'operational',
            policy: 'operational',
            risk: 'operational',
            supplyChain: 'operational',
            qualityGate: 'operational',
          },
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });
}