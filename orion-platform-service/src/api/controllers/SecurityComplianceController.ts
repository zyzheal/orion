/**
 * SecurityComplianceController - API controller for security compliance and audit endpoints
 *
 * Handles compliance policy management, evaluation, reporting, and audit operations.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../../services/database';
import {
  ComplianceFrameworkService,
  CompliancePolicyInput,
} from '../../services/security/ComplianceFrameworkService';
import {
  SecurityAuditService,
  AuditPlanInput,
} from '../../services/security/SecurityAuditService';

// ==================== Request/Response Types ====================

interface DefinePolicyBody {
  name: string;
  description?: string;
  frameworkType: string;
  requirements?: unknown[];
  rules?: unknown[];
  severityThreshold?: string;
  createdBy?: string;
}

interface EvaluateComplianceBody {
  policyId: string;
}

interface ListPoliciesQuery {
  frameworkType?: string;
}

interface RemediateComplianceBody {
  gaps: Array<{ gapId: string; evaluationId: string }>;
}

interface CreateAuditPlanBody {
  name: string;
  description?: string;
  scope?: Record<string, unknown>;
  auditType: string;
  scheduleType?: string;
  cronExpression?: string;
  reviewers?: string[];
  createdBy?: string;
}

interface AuditParams {
  id: string;
}

interface PolicyParams {
  policyId: string;
}

interface FrameworkParams {
  id: string;
}

interface CloseFindingBody {
  resolution?: string;
}

interface CollectEvidenceBody {
  policyId: string;
  controlId: string;
  evidenceType: 'document' | 'screenshot' | 'log' | 'config' | 'automated';
  description: string;
  source?: string;
}

interface GenerateEvidenceBody {
  frameworkId: string;
}

interface GapAnalysisBody {
  frameworkId: string;
}

export class SecurityComplianceController {
  private complianceService: ComplianceFrameworkService;
  private auditService: SecurityAuditService;

  constructor(db?: DatabasePool) {
    this.complianceService = new ComplianceFrameworkService(db);
    this.auditService = new SecurityAuditService(db);
  }

  // ==================== Compliance Policies ====================

  /**
   * POST /api/v1/compliance/policies
   * Define a new compliance policy
   */
  async definePolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const body = request.body as DefinePolicyBody;

      const { name, description, frameworkType, requirements, rules, severityThreshold, createdBy } = body;

      if (!name || !frameworkType) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, frameworkType',
        });
        return;
      }

      const input: CompliancePolicyInput = {
        name,
        description,
        frameworkType,
        requirements,
        rules,
        severityThreshold,
        createdBy,
      };

      const policy = await this.complianceService.definePolicy(tenantId, input);

      await reply.status(201).send({
        id: policy.id,
        name: policy.name,
        frameworkType: policy.framework_type,
        description: policy.description,
        enabled: policy.enabled,
        createdAt: policy.created_at,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to define policy',
      });
    }
  }

  /**
   * GET /api/v1/compliance/policies
   * List compliance policies
   */
  async listPolicies(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const query = request.query as ListPoliciesQuery;
      const frameworkType = query?.frameworkType;

      const policies = await this.complianceService.listPolicies(tenantId, frameworkType);

      await reply.send({
        data: policies.map(p => ({
          id: p.id,
          name: p.name,
          frameworkType: p.framework_type,
          description: p.description,
          enabled: p.enabled,
          severityThreshold: p.severity_threshold,
          createdAt: p.created_at,
        })),
        total: policies.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to list policies',
      });
    }
  }

  // ==================== Compliance Evaluation ====================

  /**
   * POST /api/v1/compliance/evaluate
   * Evaluate compliance for a policy
   */
  async evaluateCompliance(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const body = request.body as EvaluateComplianceBody;
      const { policyId } = body;

      if (!policyId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: policyId',
        });
        return;
      }

      const evaluation = await this.complianceService.evaluateCompliance(tenantId, policyId);

      await reply.status(201).send({
        id: evaluation.id,
        policyId: evaluation.policy_id,
        status: evaluation.status,
        score: evaluation.score,
        totalChecks: evaluation.total_checks,
        passedChecks: evaluation.passed_checks,
        failedChecks: evaluation.failed_checks,
        startedAt: evaluation.started_at,
        completedAt: evaluation.completed_at,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to evaluate compliance';
      const statusCode = message.includes('not found') ? 404 : 500;
      await reply.status(statusCode).send({
        error: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message,
      });
    }
  }

  // ==================== Compliance Report ====================

  /**
   * GET /api/v1/compliance/report/:policyId
   * Get compliance report for a policy
   */
  async getComplianceReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const params = request.params as PolicyParams;
      const { policyId } = params;

      const report = await this.complianceService.getComplianceReport(tenantId, policyId);

      await reply.send({
        policy: {
          id: report.policy.id,
          name: report.policy.name,
          frameworkType: report.policy.framework_type,
        },
        evaluation: {
          id: report.evaluation.id,
          status: report.evaluation.status,
          score: report.evaluation.score,
          totalChecks: report.evaluation.total_checks,
          passedChecks: report.evaluation.passed_checks,
          failedChecks: report.evaluation.failed_checks,
        },
        gaps: report.gaps,
        score: report.score,
        status: report.status,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get compliance report';
      const statusCode = message.includes('not found') || message.includes('No evaluation') ? 404 : 500;
      await reply.status(statusCode).send({
        error: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message,
      });
    }
  }

  // ==================== Compliance Score ====================

  /**
   * GET /api/v1/compliance/score
   * Get overall compliance score for a tenant
   */
  async getComplianceScore(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';

      const score = await this.complianceService.getComplianceScore(tenantId);

      await reply.send({
        tenantId: score.tenantId,
        overallScore: score.overallScore,
        policiesEvaluated: score.policiesEvaluated,
        policiesByFramework: score.policiesByFramework,
        openGaps: score.openGaps,
        criticalGaps: score.criticalGaps,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get compliance score',
      });
    }
  }

  // ==================== Compliance Remediation ====================

  /**
   * POST /api/v1/compliance/remediate
   * Auto-remediate compliance gaps
   */
  async autoRemediateCompliance(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const body = request.body as RemediateComplianceBody;
      const { gaps } = body;

      if (!gaps || !Array.isArray(gaps)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: gaps (array of { gapId, evaluationId })',
        });
        return;
      }

      const remediations = await this.complianceService.autoRemediateCompliance(tenantId, gaps);

      await reply.status(201).send({
        data: remediations.map(r => ({
          id: r.id,
          gapId: r.gap_id,
          status: r.status,
          actionTaken: r.action_taken,
          result: r.result,
          createdAt: r.created_at,
          completedAt: r.completed_at,
        })),
        total: remediations.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to remediate compliance',
      });
    }
  }

  // ==================== Audit Plans ====================

  /**
   * POST /api/v1/audit/plans
   * Create an audit plan
   */
  async createAuditPlan(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const body = request.body as CreateAuditPlanBody;

      const { name, description, scope, auditType, scheduleType, cronExpression, reviewers, createdBy } = body;

      if (!name || !auditType) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, auditType',
        });
        return;
      }

      const input: AuditPlanInput = {
        name,
        description,
        scope,
        auditType,
        scheduleType,
        cronExpression,
        reviewers,
        createdBy,
      };

      const plan = await this.auditService.createAuditPlan(tenantId, input);

      await reply.status(201).send({
        id: plan.id,
        name: plan.name,
        auditType: plan.audit_type,
        description: plan.description,
        status: plan.status,
        scheduleType: plan.schedule_type,
        createdAt: plan.created_at,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create audit plan',
      });
    }
  }

  /**
   * GET /api/v1/audit/plans
   * List audit plans
   */
  async listAuditPlans(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';

      const plans = await this.auditService.listAuditPlans(tenantId);

      await reply.send({
        data: plans.map(p => ({
          id: p.id,
          name: p.name,
          auditType: p.audit_type,
          description: p.description,
          status: p.status,
          scheduleType: p.schedule_type,
          createdAt: p.created_at,
        })),
        total: plans.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to list audit plans',
      });
    }
  }

  // ==================== Audit Execution ====================

  /**
   * POST /api/v1/audit/:id/execute
   * Execute an audit
   */
  async executeAudit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const params = request.params as AuditParams;
      const { id } = params;

      const execution = await this.auditService.executeAudit(tenantId, id);

      await reply.status(201).send({
        id: execution.id,
        planId: execution.plan_id,
        status: execution.status,
        findingsCount: execution.findings_count,
        startedAt: execution.started_at,
        completedAt: execution.completed_at,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute audit';
      const statusCode = message.includes('not found') ? 404 : 500;
      await reply.status(statusCode).send({
        error: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message,
      });
    }
  }

  // ==================== Audit Report ====================

  /**
   * GET /api/v1/audit/:id/report
   * Get audit report
   */
  async getAuditReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const params = request.params as AuditParams;
      const { id } = params;

      const report = await this.auditService.generateAuditReport(tenantId, id);

      await reply.send({
        plan: {
          id: report.plan.id,
          name: report.plan.name,
          auditType: report.plan.audit_type,
        },
        execution: {
          id: report.execution.id,
          status: report.execution.status,
          findingsCount: report.execution.findings_count,
          startedAt: report.execution.started_at,
          completedAt: report.execution.completed_at,
        },
        findings: report.findings.map(f => ({
          id: f.id,
          title: f.title,
          severity: f.severity,
          category: f.category,
          status: f.status,
          description: f.description,
          recommendation: f.recommendation,
        })),
        summary: report.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get audit report';
      const statusCode = message.includes('not found') || message.includes('No executions') ? 404 : 500;
      await reply.status(statusCode).send({
        error: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message,
      });
    }
  }

  // ==================== Audit Findings ====================

  /**
   * GET /api/v1/audit/:id/findings
   * Get audit findings
   */
  async getAuditFindings(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const params = request.params as AuditParams;
      const { id } = params;

      const findings = await this.auditService.trackAuditFindings(tenantId, id);

      await reply.send({
        data: findings.map(f => ({
          id: f.id,
          title: f.title,
          severity: f.severity,
          category: f.category,
          status: f.status,
          description: f.description,
          recommendation: f.recommendation,
          assignedTo: f.assigned_to,
          createdAt: f.created_at,
          closedAt: f.closed_at,
        })),
        total: findings.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get audit findings';
      const statusCode = message.includes('not found') || message.includes('No executions') ? 404 : 500;
      await reply.status(statusCode).send({
        error: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message,
      });
    }
  }

  /**
   * POST /api/v1/audit/findings/:id/close
   * Close an audit finding
   */
  async closeFinding(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const params = request.params as AuditParams;
      const body = request.body as CloseFindingBody;
      const { id } = params;
      const { resolution } = body;

      const finding = await this.auditService.closeFinding(tenantId, id, resolution);

      await reply.send({
        id: finding.id,
        title: finding.title,
        status: finding.status,
        closedAt: finding.closed_at,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to close finding';
      const statusCode = message.includes('not found') ? 404 : 500;
      await reply.status(statusCode).send({
        error: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message,
      });
    }
  }

  // ==================== Compliance Frameworks ====================

  /**
   * GET /api/v1/compliance/frameworks
   * Get all supported compliance frameworks
   */
  async getFrameworks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const frameworks = await this.complianceService.getSupportedFrameworks();
      await reply.send({
        data: frameworks,
        total: frameworks.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get frameworks',
      });
    }
  }

  /**
   * GET /api/v1/compliance/frameworks/:id
   * Get a specific compliance framework
   */
  async getFramework(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as FrameworkParams;
      const { id } = params;
      const framework = await this.complianceService.getFramework(id);
      if (!framework) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Framework '${id}' not found`,
        });
        return;
      }
      await reply.send(framework);
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get framework',
      });
    }
  }

  // ==================== Evidence Collection ====================

  /**
   * POST /api/v1/compliance/evidence
   * Collect compliance evidence
   */
  async collectEvidence(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const body = request.body as CollectEvidenceBody;
      const { policyId, controlId, evidenceType, description, source } = body;

      if (!policyId || !controlId || !evidenceType || !description) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: policyId, controlId, evidenceType, description',
        });
        return;
      }

      const evidence = await this.complianceService.collectEvidence(tenantId, policyId, controlId, {
        evidenceType,
        description,
        source: source || 'manual',
      });

      await reply.status(201).send(evidence);
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to collect evidence',
      });
    }
  }

  /**
   * GET /api/v1/compliance/evidence/:policyId
   * Get evidence for a policy
   */
  async getEvidence(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as PolicyParams;
      const { policyId } = params;

      const evidence = await this.complianceService.getEvidence(policyId);

      await reply.send({
        data: evidence,
        total: evidence.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get evidence',
      });
    }
  }

  /**
   * POST /api/v1/compliance/evidence/generate
   * Generate evidence collection for a framework
   */
  async generateEvidenceCollection(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const body = request.body as GenerateEvidenceBody;
      const { frameworkId } = body;

      if (!frameworkId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: frameworkId',
        });
        return;
      }

      const result = await this.complianceService.generateEvidenceCollection(tenantId, frameworkId);

      await reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate evidence';
      const statusCode = message.includes('not found') ? 404 : 500;
      await reply.status(statusCode).send({
        error: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message,
      });
    }
  }

  // ==================== Gap Analysis ====================

  /**
   * POST /api/v1/compliance/gap-analysis
   * Perform gap analysis with remediation recommendations
   */
  async performGapAnalysis(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const body = request.body as GapAnalysisBody;
      const { frameworkId } = body;

      if (!frameworkId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: frameworkId',
        });
        return;
      }

      const result = await this.complianceService.performGapAnalysis(tenantId, frameworkId);

      await reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to perform gap analysis';
      const statusCode = message.includes('not found') ? 404 : 500;
      await reply.status(statusCode).send({
        error: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message,
      });
    }
  }
}
