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

interface SecurityRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
}

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