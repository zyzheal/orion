/**
 * API Governance API Routes (Enhanced Phase 4)
 *
 * Routes under /v1/api-governance
 * Enhanced with contract verification, API versioning, and deprecation tracking.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ApiGovernanceController } from './controllers/ApiGovernanceController';

const controller = new ApiGovernanceController();

export default async function apiGovernanceRoutes(app: FastifyInstance): Promise<void> {
  // ==================== Contract Management ====================

  // POST /v1/api-governance/contracts - Register contract
  app.post('/contracts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerContract(request, reply);
  });

  // GET /v1/api-governance/contracts - List contracts
  app.get('/contracts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listContracts(request, reply);
  });

  // GET /v1/api-governance/contracts/:id - Get contract detail
  app.get('/contracts/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getContract(request, reply);
  });

  // POST /v1/api-governance/contracts/:id/evaluate - Evaluate contract
  app.post('/contracts/:id/evaluate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.evaluateContract(request, reply);
  });

  // POST /v1/api-governance/contracts/:id/verify - Verify contract against actual response
  app.post('/contracts/:id/verify', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.verifyContract(request, reply);
  });

  // GET /v1/api-governance/contracts/:id/verification-history - Get verification history
  app.get('/contracts/:id/verification-history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getVerificationHistory(request, reply);
  });

  // GET /v1/api-governance/violations - Get violations
  app.get('/violations', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getViolations(request, reply);
  });

  // ==================== API Versioning ====================

  // POST /v1/api-governance/versions - Register API version
  app.post('/versions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerApiVersion(request, reply);
  });

  // GET /v1/api-governance/versions - List API versions
  app.get('/versions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listApiVersions(request, reply);
  });

  // POST /v1/api-governance/versions/:id/deprecate - Deprecate a version
  app.post('/versions/:id/deprecate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deprecateApiVersion(request, reply);
  });

  // POST /v1/api-governance/versions/:id/retire - Retire a deprecated version
  app.post('/versions/:id/retire', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.retireApiVersion(request, reply);
  });

  // GET /v1/api-governance/deprecated - Get all deprecated versions
  app.get('/deprecated', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDeprecatedVersions(request, reply);
  });

  // POST /v1/api-governance/compatibility - Check compatibility
  app.post('/compatibility', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.checkCompatibility(request, reply);
  });

  // ==================== Governance Rules ====================

  // POST /v1/api-governance/rules - Create rule
  app.post('/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createRule(request, reply);
  });

  // GET /v1/api-governance/report - Get governance report
  app.get('/report', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-governance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReport(request, reply);
  });
}
