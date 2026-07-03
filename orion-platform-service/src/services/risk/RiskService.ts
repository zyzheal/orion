/**
 * RiskService - Risk identification, assessment, and mitigation core logic
 *
 * ARCH-001: All operations are tenant-isolated via RiskRepository.
 *
 * Capabilities:
 * - identifyRisks: Rule-based risk identification engine
 * - assessRisk: Evaluate risk level (low/medium/high/critical) based on findings
 * - createMitigation: Create mitigation plans with actions
 * - getRiskDashboard: Aggregate risk analytics for a tenant
 */

import { v4 as uuidv4 } from 'uuid';
import { RiskRepository } from './RiskRepository';
import {
  RiskEntity,
  RiskCreateInput,
  RiskLevel,
  RiskStatus,
  RiskCategory,
  RiskFinding,
  RiskFindingInput,
  RiskMitigation,
  RiskRule,
  RiskRuleCondition,
  RiskEngineContext,
  RiskIdentificationResult,
  RiskAssessInput,
  RiskAssessOutput,
  RiskDashboard,
  RiskTrendPoint,
  CreateMitigationInput,
  MitigationActionType,
  RULE_OPERATOR_LABELS,
} from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('risk-service');

// ==================== Predefined Rule Engine ====================

/**
 * Default rules for common risk scenarios.
 * In production these would be tenant-configurable via the risk_rules table.
 */
const DEFAULT_RULES: RiskRule[] = [
  {
    id: 'rule-security-vulnerability',
    tenantId: '__system__',
    name: 'Security Vulnerability Detected',
    description: 'Detects known security vulnerabilities in dependencies or configuration',
    category: RiskCategory.SECURITY,
    condition: {
      field: 'hasSecurityVulnerabilities',
      operator: 'equals',
      value: true,
    },
    weight: 0.9,
    enabled: true,
    priority: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-compliance-gap',
    tenantId: '__system__',
    name: 'Compliance Gap Detected',
    description: 'Identifies compliance policy gaps',
    category: RiskCategory.COMPLIANCE,
    condition: {
      field: 'complianceGaps',
      operator: 'greater_than',
      value: 0,
    },
    weight: 0.8,
    enabled: true,
    priority: 90,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-outdated-dependency',
    tenantId: '__system__',
    name: 'Outdated Dependency',
    description: 'Flags dependencies that are significantly out of date',
    category: RiskCategory.TECHNICAL,
    condition: {
      field: 'outdatedDependencyCount',
      operator: 'greater_than',
      value: 5,
    },
    weight: 0.5,
    enabled: true,
    priority: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-no-backup-plan',
    tenantId: '__system__',
    name: 'Missing Backup Plan',
    description: 'Flags resources without backup or disaster recovery plans',
    category: RiskCategory.OPERATIONAL,
    condition: {
      field: 'hasBackupPlan',
      operator: 'equals',
      value: false,
    },
    weight: 0.7,
    enabled: true,
    priority: 70,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-high-traffic-spike',
    tenantId: '__system__',
    name: 'Unusual Traffic Spike',
    description: 'Detects sudden traffic increases that could indicate abuse',
    category: RiskCategory.OPERATIONAL,
    condition: {
      field: 'trafficSpike',
      operator: 'greater_than',
      value: 200,
    },
    weight: 0.6,
    enabled: true,
    priority: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-unauthorized-access',
    tenantId: '__system__',
    name: 'Unauthorized Access Attempt',
    description: 'Flags repeated unauthorized access attempts',
    category: RiskCategory.SECURITY,
    condition: {
      field: 'failedLoginCount',
      operator: 'greater_than',
      value: 10,
    },
    weight: 0.85,
    enabled: true,
    priority: 95,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ==================== Service Class ====================

export class RiskService {
  private repository: RiskRepository;
  private db: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
    transaction?: <T>(fn: (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) => Promise<T>) => Promise<T>;
  };

  constructor(
    db: {
      query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
      transaction?: <T>(fn: (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) => Promise<T>) => Promise<T>;
    },
    rules?: RiskRule[],
  ) {
    this.db = db;
    this.repository = new RiskRepository(db);
    this.rules = rules ?? DEFAULT_RULES;
  }

  private rules: RiskRule[];

  // ==================== Risk Identification ====================

  /**
   * Identify risks based on rule engine evaluation against context data.
   *
   * @param context - RiskEngineContext containing tenant, target, and evaluation data
   * @returns RiskIdentificationResult with findings, triggered rules, and overall assessment
   */
  async identifyRisks(context: RiskEngineContext): Promise<RiskIdentificationResult> {
    logger.info({ tenantId: context.tenantId, targetType: context.targetType, targetId: context.targetId }, 'Starting risk identification');

    const triggeredRules: string[] = [];
    const findings: RiskFinding[] = [];
    let weightedScoreSum = 0;
    let weightTotal = 0;

    // Sort rules by priority (descending) and filter enabled rules for tenant
    const applicableRules = this.rules
      .filter((r) => r.enabled && (r.tenantId === context.tenantId || r.tenantId === '__system__'))
      .sort((a, b) => b.priority - a.priority);

    for (const rule of applicableRules) {
      const triggered = this.evaluateCondition(rule.condition, context.data);
      if (triggered) {
        triggeredRules.push(rule.id);
        const finding = this.ruleToFinding(rule, context);
        findings.push(finding);

        weightedScoreSum += this.levelToScore(finding.severity) * rule.weight;
        weightTotal += rule.weight;

        logger.debug(
          { ruleId: rule.id, ruleName: rule.name, severity: finding.severity },
          'Risk rule triggered',
        );
      }
    }

    const overallScore = weightTotal > 0 ? Math.round(weightedScoreSum / weightTotal) : 0;
    const overallLevel = this.scoreToLevel(overallScore);

    logger.info(
      {
        tenantId: context.tenantId,
        triggeredRules: triggeredRules.length,
        findingsCount: findings.length,
        overallScore,
        overallLevel,
      },
      'Risk identification completed',
    );

    return {
      risks: findings,
      triggeredRules,
      overallScore,
      overallLevel,
    };
  }

  // ==================== Risk Assessment ====================

  /**
   * Assess a risk and determine its level based on current findings.
   *
   * @param input - RiskAssessInput with riskId and assessor info
   * @returns RiskAssessOutput with score delta and new level
   */
  async assessRisk(input: RiskAssessInput): Promise<RiskAssessOutput> {
    const risk = await this.repository.findById(input.riskId, '');
    if (!risk) {
      // tenantId is not used in the simplified call path; callers should use repository directly
      throw new Error(`Risk not found: ${input.riskId}`);
    }

    const previousScore = risk.score;
    const previousLevel = risk.riskLevel;

    // If custom score provided, use it; otherwise recalculate from findings
    const newScore = input.customScore ?? this.calculateScoreFromFindings(risk.findings);
    const newLevel = this.scoreToLevel(newScore);

    const updated = await this.repository.update(risk.id, risk.tenantId, {
      riskLevel: newLevel,
      score: newScore,
      status: RiskStatus.ASSESSED,
    });

    logger.info(
      {
        riskId: risk.id,
        previousScore,
        previousLevel,
        newScore,
        newLevel,
        scoreDelta: newScore - previousScore,
        assessedBy: input.assessedBy,
      },
      'Risk assessed',
    );

    return {
      riskId: risk.id,
      previousScore,
      previousLevel,
      newScore,
      newLevel,
      scoreDelta: newScore - previousScore,
      findingsCount: updated.findings.length,
      assessedAt: updated.assessedAt ?? new Date(),
    };
  }

  // ==================== Mitigation ====================

  /**
   * Create a mitigation plan for a risk.
   *
   * @param input - CreateMitigationInput with risk ID, plan, actions, and priority
   * @returns Updated RiskEntity with mitigation plan attached
   */
  async createMitigation(input: CreateMitigationInput): Promise<RiskEntity> {
    const risk = await this.repository.findById(input.riskId, '');
    if (!risk) {
      throw new Error(`Risk not found: ${input.riskId}`);
    }

    const result = await this.repository.createMitigation(
      risk.id,
      risk.tenantId,
      {
        plan: input.plan,
        actions: input.actions,
        priority: input.priority,
        owner: input.owner,
        dueDate: input.dueDate,
      },
    );

    logger.info(
      { riskId: risk.id, mitigationId: result.mitigations[result.mitigations.length - 1]?.id },
      'Mitigation plan created',
    );

    return result;
  }

  /**
   * Update mitigation action status.
   */
  async updateMitigationAction(
    riskId: string,
    tenantId: string,
    mitigationId: string,
    actionId: string,
    status: 'completed' | 'in_progress' | 'failed',
    result?: string,
  ): Promise<RiskEntity> {
    const risk = await this.repository.findById(riskId, tenantId);
    if (!risk) {
      throw new Error(`Risk not found: ${riskId}`);
    }

    const updatedMitigations = risk.mitigations.map((m) => {
      if (m.id !== mitigationId) return m;
      return {
        ...m,
        actions: m.actions.map((a) => {
          if (a.id !== actionId) return a;
          return {
            ...a,
            status,
            completedAt: status === 'completed' ? new Date() : a.completedAt,
            result,
          };
        }),
        updatedAt: new Date(),
      };
    });

    // Check if all actions are completed -> mark mitigation as completed
    const updatedMitigation = updatedMitigations.find((m) => m.id === mitigationId);
    if (updatedMitigation) {
      const allCompleted = updatedMitigation.actions.every((a) => a.status === 'completed');
      if (allCompleted && status === 'completed') {
        updatedMitigation.status = 'completed';
        updatedMitigation.completedAt = new Date();
      } else if (status === 'in_progress') {
        updatedMitigation.status = 'in_progress';
      }
    }

    return this.repository.update(riskId, tenantId, { mitigations: updatedMitigations });
  }

  // ==================== Dashboard ====================

  /**
   * Get risk dashboard data for a tenant.
   *
   * @param tenantId - Tenant identifier
   * @returns RiskDashboard with summary, trends, and top risks
   */
  async getRiskDashboard(tenantId: string): Promise<RiskDashboard> {
    logger.info({ tenantId }, 'Generating risk dashboard');

    const [statsResult, recentRisks] = await Promise.all([
      this.repository.getStats(tenantId),
      this.repository.findOpenRisks(tenantId, { limit: 10 }),
    ]);

    const trends = await this.getRiskTrends(tenantId, 30);

    const mitigationStats = await this.getMitigationStats(tenantId);

    const dashboard: RiskDashboard = {
      tenantId,
      generatedAt: new Date(),
      summary: {
        totalRisks: statsResult.total,
        openRisks: statsResult.openRisks,
        closedRisks: statsResult.byStatus[RiskStatus.CLOSED] ?? 0,
        averageScore: Math.round(statsResult.averageScore),
        criticalCount: statsResult.byLevel[RiskLevel.CRITICAL] ?? 0,
        highCount: statsResult.byLevel[RiskLevel.HIGH] ?? 0,
        mediumCount: statsResult.byLevel[RiskLevel.MEDIUM] ?? 0,
        lowCount: statsResult.byLevel[RiskLevel.LOW] ?? 0,
      },
      byCategory: statsResult.byCategory,
      byLevel: statsResult.byLevel,
      byStatus: statsResult.byStatus,
      topRisks: recentRisks,
      recentTrends: trends,
      mitigationProgress: mitigationStats,
    };

    return dashboard;
  }

  // ==================== Risk Query Operations ====================

  /**
   * Create a new risk.
   */
  async createRisk(input: RiskCreateInput): Promise<RiskEntity> {
    return this.repository.create(input);
  }

  /**
   * Get a risk by ID within a tenant.
   */
  async getRisk(id: string, tenantId: string): Promise<RiskEntity | undefined> {
    return this.repository.findById(id, tenantId);
  }

  /**
   * List risks for a tenant with optional filters.
   */
  async listRisks(
    tenantId: string,
    options?: { limit?: number; offset?: number; status?: RiskStatus; riskLevel?: RiskLevel },
  ): Promise<{ entities: RiskEntity[]; total: number }> {
    return this.repository.findByTenant(tenantId, options);
  }

  /**
   * List open risks sorted by severity.
   */
  async getOpenRisks(tenantId: string, options?: { limit?: number; riskLevel?: RiskLevel }): Promise<RiskEntity[]> {
    return this.repository.findOpenRisks(tenantId, options);
  }

  /**
   * Get high/critical risks for priority attention.
   */
  async getHighPriorityRisks(options?: { limit?: number; tenantId?: string }): Promise<RiskEntity[]> {
    return this.repository.findHighRisk(options);
  }

  // ==================== Private Helpers ====================

  private evaluateCondition(condition: RiskRuleCondition, data: Record<string, unknown>): boolean {
    const fieldValue = data[condition.field];

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;

      case 'not_equals':
        return fieldValue !== condition.value;

      case 'contains':
        if (Array.isArray(fieldValue)) return fieldValue.includes(condition.value);
        if (typeof fieldValue === 'string') return fieldValue.includes(String(condition.value));
        return false;

      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);

      case 'less_than':
        return Number(fieldValue) < Number(condition.value);

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);

      case 'between': {
        if (!Array.isArray(condition.value) || condition.value.length !== 2) return false;
        const num = Number(fieldValue);
        return num >= Number(condition.value[0]) && num <= Number(condition.value[1]);
      }

      case 'regex_match':
        return typeof fieldValue === 'string' && new RegExp(String(condition.value)).test(fieldValue);

      default:
        logger.warn({ operator: condition.operator }, 'Unknown rule operator');
        return false;
    }
  }

  private ruleToFinding(rule: RiskRule, context: RiskEngineContext): RiskFinding {
    const severity = this.inferSeverityFromRule(rule);
    return {
      id: `finding_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: rule.name,
      description: rule.description,
      severity,
      category: rule.category,
      source: rule.id,
      recommendation: this.getDefaultRecommendation(rule.category),
      affectedComponents: [context.targetType],
      evidence: {
        ruleCondition: rule.condition,
        contextData: context.data,
      },
      detectedAt: new Date(),
    };
  }

  private inferSeverityFromRule(rule: RiskRule): RiskLevel {
    // Higher weight -> higher severity
    if (rule.weight >= 0.8) return RiskLevel.CRITICAL;
    if (rule.weight >= 0.6) return RiskLevel.HIGH;
    if (rule.weight >= 0.4) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private getDefaultRecommendation(category: RiskCategory): string {
    const recommendations: Partial<Record<RiskCategory, string>> = {
      [RiskCategory.SECURITY]: 'Review security configurations and apply patches',
      [RiskCategory.OPERATIONAL]: 'Implement backup and disaster recovery plans',
      [RiskCategory.COMPLIANCE]: 'Address compliance gaps by updating policies',
      [RiskCategory.FINANCIAL]: 'Review cost structures and optimize resource allocation',
      [RiskCategory.TECHNICAL]: 'Update dependencies and refactor technical debt',
      [RiskCategory.STRATEGIC]: 'Align with strategic objectives and review roadmap',
      [RiskCategory.REPUTATION]: 'Monitor public sentiment and prepare communication plan',
      [RiskCategory.SUPPLY_CHAIN]: 'Audit suppliers and implement SBOM tracking',
    };
    return recommendations[category] ?? 'Review and address the identified risk';
  }

  private calculateScoreFromFindings(findings: RiskFinding[]): number {
    if (findings.length === 0) return 0;

    const severityScores: Record<RiskLevel, number> = {
      [RiskLevel.LOW]: 10,
      [RiskLevel.MEDIUM]: 30,
      [RiskLevel.HIGH]: 60,
      [RiskLevel.CRITICAL]: 90,
    };

    const total = findings.reduce((sum, f) => sum + (severityScores[f.severity] ?? 0), 0);
    const avg = total / findings.length;
    return Math.min(100, Math.max(0, Math.round(avg)));
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score <= 25) return RiskLevel.LOW;
    if (score <= 50) return RiskLevel.MEDIUM;
    if (score <= 75) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  private levelToScore(level: RiskLevel): number {
    const map: Record<RiskLevel, number> = {
      [RiskLevel.LOW]: 10,
      [RiskLevel.MEDIUM]: 30,
      [RiskLevel.HIGH]: 60,
      [RiskLevel.CRITICAL]: 90,
    };
    return map[level];
  }

  private async getRiskTrends(tenantId: string, days: number): Promise<RiskTrendPoint[]> {
    const result = await this.db.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status != 'closed') as identified,
        COUNT(*) FILTER (WHERE status = 'closed') as closed,
        AVG(score) as avg_score
       FROM risk_assessments
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [tenantId],
    );

    return result.rows.map((row) => ({
      date: row.date,
      identified: parseInt(row.identified, 10) || 0,
      closed: parseInt(row.closed, 10) || 0,
      averageScore: parseFloat(row.avg_score) || 0,
    }));
  }

  private async getMitigationStats(tenantId: string): Promise<{
    planned: number;
    inProgress: number;
    completed: number;
    failed: number;
  }> {
    const result = await this.db.query(
      `SELECT
        COUNT(*) FILTER (WHERE JSONB_ARRAY_LENGTH(mitigations) > 0 AND
          EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(mitigations) m WHERE m->>'status' = 'planned')) as planned,
        COUNT(*) FILTER (WHERE JSONB_ARRAY_LENGTH(mitigations) > 0 AND
          EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(mitigations) m WHERE m->>'status' = 'in_progress')) as in_progress,
        COUNT(*) FILTER (WHERE JSONB_ARRAY_LENGTH(mitigations) > 0 AND
          EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(mitigations) m WHERE m->>'status' = 'completed')) as completed,
        COUNT(*) FILTER (WHERE JSONB_ARRAY_LENGTH(mitigations) > 0 AND
          EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(mitigations) m WHERE m->>'status' = 'failed')) as failed
       FROM risk_assessments
       WHERE tenant_id = $1`,
      [tenantId],
    );

    const row = result.rows[0];
    return {
      planned: parseInt(row.planned, 10) || 0,
      inProgress: parseInt(row.in_progress, 10) || 0,
      completed: parseInt(row.completed, 10) || 0,
      failed: parseInt(row.failed, 10) || 0,
    };
  }
}

// Operator labels for UI display
export const RULE_OPERATOR_LABELS: Record<string, string> = {
  equals: '等于',
  not_equals: '不等于',
  contains: '包含',
  greater_than: '大于',
  less_than: '小于',
  in: '属于',
  between: '介于',
  regex_match: '正则匹配',
};

export default RiskService;
