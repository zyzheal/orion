import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../utils/database';
import { SecurityComplianceController } from '../controllers/SecurityComplianceController';

export async function complianceRoutes(app: FastifyInstance) {
  const pool = getPool();
  const controller = new SecurityComplianceController(pool);

  app.post('/compliance/policies', async (request: FastifyRequest, reply: FastifyReply) => controller.definePolicy(request, reply));
  app.get('/compliance/policies', async (request: FastifyRequest, reply: FastifyReply) => controller.listPolicies(request, reply));
  app.post('/compliance/evaluate', async (request: FastifyRequest, reply: FastifyReply) => controller.evaluateCompliance(request, reply));
  app.get('/compliance/report/:policyId', async (request: FastifyRequest, reply: FastifyReply) => controller.getComplianceReport(request, reply));
  app.get('/compliance/score', async (request: FastifyRequest, reply: FastifyReply) => controller.getComplianceScore(request, reply));
  app.post('/compliance/remediate', async (request: FastifyRequest, reply: FastifyReply) => controller.autoRemediateCompliance(request, reply));
  app.post('/audit/plans', async (request: FastifyRequest, reply: FastifyReply) => controller.createAuditPlan(request, reply));
  app.get('/audit/plans', async (request: FastifyRequest, reply: FastifyReply) => controller.listAuditPlans(request, reply));
  app.post('/audit/:id/execute', async (request: FastifyRequest, reply: FastifyReply) => controller.executeAudit(request, reply));
  app.get('/audit/:id/report', async (request: FastifyRequest, reply: FastifyReply) => controller.getAuditReport(request, reply));
  app.get('/audit/:id/findings', async (request: FastifyRequest, reply: FastifyReply) => controller.getAuditFindings(request, reply));
  app.post('/audit/findings/:id/close', async (request: FastifyRequest, reply: FastifyReply) => controller.closeFinding(request, reply));
  app.get('/compliance/frameworks', async (request: FastifyRequest, reply: FastifyReply) => controller.getFrameworks(request, reply));
  app.get('/compliance/frameworks/:id', async (request: FastifyRequest, reply: FastifyReply) => controller.getFramework(request, reply));
  app.post('/compliance/evidence', async (request: FastifyRequest, reply: FastifyReply) => controller.collectEvidence(request, reply));
  app.get('/compliance/evidence/:policyId', async (request: FastifyRequest, reply: FastifyReply) => controller.getEvidence(request, reply));
  app.post('/compliance/evidence/generate', async (request: FastifyRequest, reply: FastifyReply) => controller.generateEvidenceCollection(request, reply));
  app.post('/compliance/gap-analysis', async (request: FastifyRequest, reply: FastifyReply) => controller.performGapAnalysis(request, reply));
}
