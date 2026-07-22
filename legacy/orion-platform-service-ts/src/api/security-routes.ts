/**
 * Security Vulnerability API Routes
 *
 * Routes under /api/v1/security/vulnerabilities
 * Task 4.62: Real-time vulnerability database integration.
 *
 * Provides:
 * - GET    /api/v1/security/vulnerabilities         — list vulnerabilities for current tenant
 * - POST   /api/v1/security/vulnerabilities/scan    — trigger dependency CVE scan (npm audit)
 * - GET    /api/v1/security/vulnerabilities/:id     — get specific vulnerability details
 * - POST   /api/v1/security/vulnerabilities/:id/remediate — remediate/dismiss a vulnerability
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { VulnerabilityController } from './controllers/VulnerabilityController';
import { createLogger } from '../utils/logger';

const logger = createLogger('security-vulnerability-routes');

interface SecurityVulnerabilityRoutesOptions {
  database?: DatabasePool;
}

export default async function securityVulnerabilityRoutes(
  app: FastifyInstance,
  options: SecurityVulnerabilityRoutesOptions,
): Promise<void> {
  if (!options.database) {
    logger.warn('[SecurityVulnerabilityRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const controller = new VulnerabilityController(options.database);

  // ==================== List Vulnerabilities ====================

  // GET /api/v1/security/vulnerabilities — list all vulnerabilities for current tenant
  app.get('/vulnerabilities', {
    onRequest: [authenticateUser, requirePermission({ resource: 'security', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listVulnerabilities(request, reply);
  });

  // ==================== Trigger Scan ====================

  // POST /api/v1/security/vulnerabilities/scan — trigger dependency CVE scan
  app.post('/vulnerabilities/scan', {
    onRequest: [authenticateUser, requirePermission({ resource: 'security', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.triggerScan(request, reply);
  });

  // ==================== Get Vulnerability Detail ====================

  // GET /api/v1/security/vulnerabilities/:id — get specific vulnerability
  app.get('/vulnerabilities/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'security', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getVulnerability(request, reply);
  });

  // ==================== Remediate Vulnerability ====================

  // POST /api/v1/security/vulnerabilities/:id/remediate — remediate/dismiss a vulnerability
  app.post('/vulnerabilities/:id/remediate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'security', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.remediate(request, reply);
  });
}
