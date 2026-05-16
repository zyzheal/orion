/**
 * FinOps Service Routes - Unified Route Entry
 *
 * Central route registration for all FinOps API endpoints.
 * This module combines all route modules under /api/v1/finops prefix.
 *
 * Routes Structure:
 * - /api/v1/finops/cost - Cloud cost collection, K8s allocation, SaaS tracking
 * - /api/v1/finops/v2 - Budget management, ROI analysis, optimizations
 * - /api/v1/finops/operations - Budget guards, anomaly detection
 */

import { FastifyInstance } from 'fastify';
import { DatabasePool, getPool } from '../utils/database';
import costRoutes from './cost';
import finopsV2Routes from './finops-v2';
import costOperationsRoutes from './cost-operations';

interface FinOpsRoutesOptions {
  database?: DatabasePool;
}

export default async function finopsRoutes(
  app: FastifyInstance,
  options: FinOpsRoutesOptions
): Promise<void> {
  // Use provided database pool or get from environment
  const database = options.database || getPool();

  // Register sub-routes under appropriate prefixes
  // Cost management routes
  await app.register(costRoutes, {
    prefix: '/cost',
    database,
  });

  // V2 routes - Budget, ROI, Optimization
  await app.register(finopsV2Routes, {
    prefix: '/v2',
    database,
  });

  // Cost operations - Budget guards, anomaly detection
  await app.register(costOperationsRoutes, {
    prefix: '/operations',
    database,
  });

  // Health check for FinOps service
  app.get('/health', async (request, reply) => {
    const status = database ? 'ok' : 'degraded';
    const checks = {
      database: database ? 'connected' : 'disconnected',
    };
    return reply.send({
      status,
      service: 'finops',
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}

// Re-export route modules for direct usage if needed
export { default as costRoutes } from './cost';
export { default as finopsV2Routes } from './finops-v2';
export { default as costOperationsRoutes } from './cost-operations';