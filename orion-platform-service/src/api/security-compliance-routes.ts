/**
 * Security Compliance API Routes
 *
 * Routes under /api/v1/compliance and /api/v1/audit
 * Phase 3: Compliance framework management and security audit operations.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { SecurityComplianceController } from './controllers/SecurityComplianceController';

interface SecurityComplianceRoutesOptions {
  database?: DatabasePool;
}

export default async function securityComplianceRoutes(
  app: FastifyInstance,
  options: SecurityComplianceRoutesOptions,
): Promise<void> {
  if (!options.database) {
    console.warn('[SecurityComplianceRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const controller = new SecurityComplianceController(options.database);

  // ==================== Compliance Policies ====================

  // POST /api/v1/compliance/policies - Define compliance policy
  app.post('/compliance/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.definePolicy(request, reply);
  });

  // GET /api/v1/compliance/policies - List policies
  app.get('/compliance/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listPolicies(request, reply);
  });

  // ==================== Compliance Evaluation ====================

  // POST /api/v1/compliance/evaluate - Evaluate compliance
  app.post('/compliance/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.evaluateCompliance(request, reply);
  });

  // ==================== Compliance Report ====================

  // GET /api/v1/compliance/report/:policyId - Get compliance report
  app.get('/compliance/report/:policyId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getComplianceReport(request, reply);
  });

  // ==================== Compliance Score ====================

  // GET /api/v1/compliance/score - Get compliance score
  app.get('/compliance/score', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getComplianceScore(request, reply);
  });

  // ==================== Compliance Remediation ====================

  // POST /api/v1/compliance/remediate - Auto-remediate compliance gaps
  app.post('/compliance/remediate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.autoRemediateCompliance(request, reply);
  });

  // ==================== Audit Plans ====================

  // POST /api/v1/audit/plans - Create audit plan
  app.post('/audit/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createAuditPlan(request, reply);
  });

  // GET /api/v1/audit/plans - List audit plans
  app.get('/audit/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listAuditPlans(request, reply);
  });

  // ==================== Audit Execution ====================

  // POST /api/v1/audit/:id/execute - Execute audit
  app.post('/audit/:id/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeAudit(request, reply);
  });

  // ==================== Audit Report ====================

  // GET /api/v1/audit/:id/report - Get audit report
  app.get('/audit/:id/report', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditReport(request, reply);
  });

  // ==================== Audit Findings ====================

  // GET /api/v1/audit/:id/findings - Get audit findings
  app.get('/audit/:id/findings', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditFindings(request, reply);
  });

  // POST /api/v1/audit/findings/:id/close - Close finding
  app.post('/audit/findings/:id/close', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.closeFinding(request, reply);
  });

  // ==================== Compliance Frameworks ====================

  // GET /api/v1/compliance/frameworks - List supported frameworks
  app.get('/compliance/frameworks', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getFrameworks(request, reply);
  });

  // GET /api/v1/compliance/frameworks/:id - Get framework details
  app.get('/compliance/frameworks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getFramework(request, reply);
  });

  // ==================== Evidence Collection ====================

  // POST /api/v1/compliance/evidence - Collect evidence
  app.post('/compliance/evidence', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.collectEvidence(request, reply);
  });

  // GET /api/v1/compliance/evidence/:policyId - Get evidence for policy
  app.get('/compliance/evidence/:policyId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEvidence(request, reply);
  });

  // POST /api/v1/compliance/evidence/generate - Generate evidence collection
  app.post('/compliance/evidence/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.generateEvidenceCollection(request, reply);
  });

  // ==================== Gap Analysis ====================

  // POST /api/v1/compliance/gap-analysis - Perform gap analysis
  app.post('/compliance/gap-analysis', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.performGapAnalysis(request, reply);
  });
}
