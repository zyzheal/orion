import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { SecurityComplianceService } from '../services/SecurityComplianceService';

export class SecurityComplianceController {
  private service: SecurityComplianceService;

  constructor(pool: Pool) {
    this.service = new SecurityComplianceService(pool);
  }

  async definePolicy(request: FastifyRequest, reply: FastifyReply) {
    const policy = await this.service.definePolicy(request.body as any);
    return reply.status(201).send(policy);
  }

  async listPolicies(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { framework?: string };
    const policies = await this.service.listPolicies(query);
    return reply.send(policies);
  }

  async evaluateCompliance(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.service.evaluateCompliance(request.body as any);
    return reply.status(201).send(result);
  }

  async getComplianceReport(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { policyId: string };
    const report = await this.service.getComplianceReport(params.policyId);
    if (!report) return reply.status(404).send({ error: 'Report not found' });
    return reply.send(report);
  }

  async getComplianceScore(_request: FastifyRequest, reply: FastifyReply) {
    const scores = await this.service.getComplianceScore();
    return reply.send(scores);
  }

  async autoRemediateCompliance(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.service.autoRemediateCompliance(request.body as any);
    return reply.status(201).send(result);
  }

  async createAuditPlan(request: FastifyRequest, reply: FastifyReply) {
    const plan = await this.service.createAuditPlan(request.body as any);
    return reply.status(201).send(plan);
  }

  async listAuditPlans(_request: FastifyRequest, reply: FastifyReply) {
    const plans = await this.service.listAuditPlans();
    return reply.send(plans);
  }

  async executeAudit(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const result = await this.service.executeAudit(params.id);
    return reply.send(result);
  }

  async getAuditReport(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const report = await this.service.getAuditReport(params.id);
    if (!report) return reply.status(404).send({ error: 'Report not found' });
    return reply.send(report);
  }

  async getAuditFindings(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const findings = await this.service.getAuditFindings(params.id);
    return reply.send(findings);
  }

  async closeFinding(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const result = await this.service.closeFinding(params.id);
    return reply.send(result);
  }

  async getFrameworks(_request: FastifyRequest, reply: FastifyReply) {
    const frameworks = await this.service.getFrameworks();
    return reply.send(frameworks);
  }

  async getFramework(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const framework = await this.service.getFramework(params.id);
    if (!framework) return reply.status(404).send({ error: 'Framework not found' });
    return reply.send(framework);
  }

  async collectEvidence(request: FastifyRequest, reply: FastifyReply) {
    const evidence = await this.service.collectEvidence(request.body as any);
    return reply.status(201).send(evidence);
  }

  async getEvidence(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { policyId: string };
    const evidence = await this.service.getEvidence(params.policyId);
    return reply.send(evidence);
  }

  async generateEvidenceCollection(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.service.generateEvidenceCollection(request.body as any);
    return reply.status(201).send(result);
  }

  async performGapAnalysis(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.service.performGapAnalysis(request.body as any);
    return reply.send(result);
  }
}
