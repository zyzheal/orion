/**
 * API Governance API Routes (Enhanced Phase 4)
 *
 * Routes under /v1/api-governance
 * Enhanced with contract verification, API versioning, and deprecation tracking.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ApiGovernanceController } from './controllers/ApiGovernanceController';

const controller = new ApiGovernanceController();

export default async function apiGovernanceRoutes(app: FastifyInstance): Promise<void> {
  // ==================== Contract Management ====================

  // POST /v1/api-governance/contracts - Register contract
  app.post('/contracts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerContract(request, reply);
  });

  // GET /v1/api-governance/contracts - List contracts
  app.get('/contracts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listContracts(request, reply);
  });

  // GET /v1/api-governance/contracts/:id - Get contract detail
  app.get('/contracts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getContract(request, reply);
  });

  // POST /v1/api-governance/contracts/:id/evaluate - Evaluate contract
  app.post('/contracts/:id/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.evaluateContract(request, reply);
  });

  // POST /v1/api-governance/contracts/:id/verify - Verify contract against actual response
  app.post('/contracts/:id/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.verifyContract(request, reply);
  });

  // GET /v1/api-governance/contracts/:id/verification-history - Get verification history
  app.get('/contracts/:id/verification-history', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getVerificationHistory(request, reply);
  });

  // GET /v1/api-governance/violations - Get violations
  app.get('/violations', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getViolations(request, reply);
  });

  // ==================== API Versioning ====================

  // POST /v1/api-governance/versions - Register API version
  app.post('/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerApiVersion(request, reply);
  });

  // GET /v1/api-governance/versions - List API versions
  app.get('/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listApiVersions(request, reply);
  });

  // POST /v1/api-governance/versions/:id/deprecate - Deprecate a version
  app.post('/versions/:id/deprecate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deprecateApiVersion(request, reply);
  });

  // POST /v1/api-governance/versions/:id/retire - Retire a deprecated version
  app.post('/versions/:id/retire', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.retireApiVersion(request, reply);
  });

  // GET /v1/api-governance/deprecated - Get all deprecated versions
  app.get('/deprecated', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDeprecatedVersions(request, reply);
  });

  // POST /v1/api-governance/compatibility - Check compatibility
  app.post('/compatibility', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.checkCompatibility(request, reply);
  });

  // ==================== Governance Rules ====================

  // POST /v1/api-governance/rules - Create rule
  app.post('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createRule(request, reply);
  });

  // GET /v1/api-governance/report - Get governance report
  app.get('/report', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReport(request, reply);
  });
}
