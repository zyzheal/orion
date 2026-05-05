/**
 * QualityGateTrendService - 质量门禁趋势分析
 *
 * Computes metrics from policy_evaluations, policy_violations,
 * and policy_exemptions tables using SQL aggregation queries.
 */

import { v4 as uuidv4 } from 'uuid';

export type ViolationGroupBy = 'severity' | 'policy';

export interface PassRateTrendPoint {
  date: string;
  totalEvaluations: number;
  passedEvaluations: number;
  passRate: number; // 0-100
}

export interface ViolationDistributionItem {
  key: string;   // severity value or policy_id
  count: number;
  percentage: number;
}

export interface TopFailingPolicy {
  policyId: string;
  policyName: string;
  failureCount: number;
  failureRate: number; // 0-100
  totalEvaluations: number;
}

export interface ExemptionStats {
  active: number;
  expired: number;
  pending: number;
  revoked: number;
  total: number;
}

export interface Recommendation {
  id: string;
  policyId?: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  suggestedAction: string;
}

export class QualityGateTrendService {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  /**
   * Get pass rate trend over the last N days
   */
  async getPassRateTrend(days: number = 30, policyId?: string): Promise<PassRateTrendPoint[]> {
    const whereClause = policyId ? 'AND e.policy_id = $2' : '';
    const dateFilter = `e.evaluated_at >= NOW() - INTERVAL '${days} days'`;

    const query = `
      SELECT
        DATE(e.evaluated_at) AS date,
        COUNT(*) AS total_evaluations,
        COUNT(*) FILTER (
          WHERE NOT (e.result->>'allow' = 'false' OR e.result->>'allow' = 'f')
        ) AS passed_evaluations
      FROM policy_evaluations e
      WHERE ${dateFilter} ${whereClause}
      GROUP BY DATE(e.evaluated_at)
      ORDER BY date ASC
    `;

    const params: any[] = [];
    if (policyId) {
      params.push(days, policyId);
    } else {
      params.push(days);
    }

    const result = await this.db.query(query, params);

    return result.rows.map((row: any) => {
      const total = parseInt(row.total_evaluations, 10);
      const passed = parseInt(row.passed_evaluations, 10);
      return {
        date: row.date,
        totalEvaluations: total,
        passedEvaluations: passed,
        passRate: total > 0 ? Math.round((passed / total) * 10000) / 100 : 0,
      };
    });
  }

  /**
   * Get violation distribution grouped by severity or policy
   */
  async getViolationDistribution(days: number = 30, groupBy: ViolationGroupBy = 'severity'): Promise<ViolationDistributionItem[]> {
    let selectExpr: string;
    let whereClause = `v.created_at >= NOW() - INTERVAL '${days} days'`;

    if (groupBy === 'severity') {
      selectExpr = 'v.severity AS key';
    } else {
      selectExpr = 'v.policy_id AS key';
    }

    const query = `
      SELECT ${selectExpr}, COUNT(*) AS count
      FROM policy_violations v
      WHERE ${whereClause} AND v.status = 'open'
      GROUP BY ${groupBy === 'severity' ? 'v.severity' : 'v.policy_id'}
      ORDER BY count DESC
    `;

    const result = await this.db.query(query);

    const items: ViolationDistributionItem[] = result.rows.map((row: any) => ({
      key: row.key || 'unknown',
      count: parseInt(row.count, 10),
      percentage: 0, // will compute below
    }));

    const total = items.reduce((sum, item) => sum + item.count, 0);
    if (total > 0) {
      for (const item of items) {
        item.percentage = Math.round((item.count / total) * 10000) / 100;
      }
    }

    return items;
  }

  /**
   * Get top N policies with most failures
   */
  async getTopFailingPolicies(limit: number = 5, days: number = 30): Promise<TopFailingPolicy[]> {
    const query = `
      SELECT
        p.id AS policy_id,
        p.name AS policy_name,
        COUNT(v.id) AS failure_count,
        (
          SELECT COUNT(*) FROM policy_evaluations e2
          WHERE e2.policy_id = p.id
          AND e2.evaluated_at >= NOW() - INTERVAL '${days} days'
        ) AS total_evaluations
      FROM policy_definitions p
      LEFT JOIN policy_violations v ON v.policy_id = p.id
        AND v.created_at >= NOW() - INTERVAL '${days} days'
        AND v.status = 'open'
      WHERE p.enabled = true
      GROUP BY p.id, p.name
      ORDER BY failure_count DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);

    return result.rows.map((row: any) => {
      const total = parseInt(row.total_evaluations, 10);
      const failures = parseInt(row.failure_count, 10);
      return {
        policyId: row.policy_id,
        policyName: row.policy_name || 'Unknown',
        failureCount: failures,
        failureRate: total > 0 ? Math.round((failures / total) * 10000) / 100 : 0,
        totalEvaluations: total,
      };
    });
  }

  /**
   * Get exemption statistics (active, expired, pending, revoked)
   */
  async getExemptionStats(): Promise<ExemptionStats> {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'approved' AND expires_at > NOW()) AS active,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'revoked') AS revoked,
        COUNT(*) AS total
      FROM policy_exemptions
    `;

    const result = await this.db.query(query);
    const row = result.rows[0] || {};

    return {
      active: parseInt(row.active || '0', 10),
      expired: parseInt(row.expired || '0', 10),
      pending: parseInt(row.pending || '0', 10),
      revoked: parseInt(row.revoked || '0', 10),
      total: parseInt(row.total || '0', 10),
    };
  }

  /**
   * Generate improvement recommendations based on rule engine
   *
   * Rules:
   * - Overall pass rate < 60% → suggest improving test coverage
   * - Top failing policy has > 50% failure rate → suggest policy review
   * - Many 'false-positive' exemptions → suggest tuning policy rules
   * - Many 'business-urgency' exemptions → suggest creating emergency bypass workflow
   * - High 'open' violation count → suggest establishing resolution SLA
   */
  async getRecommendations(policyId?: string): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Rule 1: Check overall pass rate
    const trend = await this.getPassRateTrend(30, policyId);
    if (trend.length > 0) {
      const avgPassRate = trend.reduce((sum, p) => sum + p.passRate, 0) / trend.length;
      if (avgPassRate < 60) {
        recommendations.push({
          id: uuidv4(),
          policyId: policyId || undefined,
          category: 'test-coverage',
          priority: 'high',
          message: `门禁通过率过低 (平均 ${avgPassRate.toFixed(1)}%)，建议提升测试覆盖率`,
          suggestedAction: '增加单元测试和集成测试覆盖率，确保关键路径有充分测试',
        });
      } else if (avgPassRate < 80) {
        recommendations.push({
          id: uuidv4(),
          policyId: policyId || undefined,
          category: 'test-coverage',
          priority: 'medium',
          message: `门禁通过率偏低 (平均 ${avgPassRate.toFixed(1)}%)，建议关注高频失败项`,
          suggestedAction: '分析失败趋势，针对 Top 失败策略进行专项优化',
        });
      }
    }

    // Rule 2: Check top failing policies
    const topFailing = await this.getTopFailingPolicies(5, 30);
    for (const policy of topFailing) {
      if (policy.failureRate > 50) {
        recommendations.push({
          id: uuidv4(),
          policyId: policy.policyId,
          category: 'policy-review',
          priority: 'high',
          message: `策略 "${policy.policyName}" 失败率高达 ${policy.failureRate}%`,
          suggestedAction: '审查策略规则是否过于严格，考虑调整为 warning 级别或优化规则逻辑',
        });
      }
    }

    // Rule 3: Check false-positive exemption ratio
    const exemptionResult = await this.getExemptionsByCategory(30);
    const falsePositiveRatio = exemptionResult.total > 0
      ? (exemptionResult.falsePositive / exemptionResult.total) * 100
      : 0;

    if (falsePositiveRatio > 30) {
      recommendations.push({
        id: uuidv4(),
        policyId: policyId || undefined,
        category: 'policy-tuning',
        priority: 'high',
        message: `误报率较高 (${falsePositiveRatio.toFixed(1)}%)，大量豁免归类为 false-positive`,
        suggestedAction: '调整检测规则，排除已知安全场景，减少误报',
      });
    }

    // Rule 4: Check business-urgency exemptions
    const businessUrgencyRatio = exemptionResult.total > 0
      ? (exemptionResult.businessUrgency / exemptionResult.total) * 100
      : 0;

    if (businessUrgencyRatio > 20) {
      recommendations.push({
        id: uuidv4(),
        policyId: policyId || undefined,
        category: 'emergency-bypass',
        priority: 'medium',
        message: `业务紧急豁免占比高 (${businessUrgencyRatio.toFixed(1)}%)`,
        suggestedAction: '建议建立紧急发布通道，避免频繁使用豁免机制绕过门禁',
      });
    }

    // Rule 5: Check open violation count
    const openViolationResult = await this.db.query(`
      SELECT COUNT(*) AS count FROM policy_violations
      WHERE status = 'open' AND created_at < NOW() - INTERVAL '7 days'
    `);
    const staleOpenCount = parseInt(openViolationResult.rows[0]?.count || '0', 10);
    if (staleOpenCount > 10) {
      recommendations.push({
        id: uuidv4(),
        policyId: policyId || undefined,
        category: 'resolution-sla',
        priority: 'medium',
        message: `存在 ${staleOpenCount} 个超过 7 天未处理的违规`,
        suggestedAction: '建立违规处理 SLA，定期清理长期未处理的违规项',
      });
    }

    // If no issues found
    if (recommendations.length === 0) {
      recommendations.push({
        id: uuidv4(),
        policyId: policyId || undefined,
        category: 'maintain',
        priority: 'low',
        message: '质量门禁运行良好，建议保持当前策略配置',
        suggestedAction: '定期回顾策略有效性，持续优化',
      });
    }

    return recommendations;
  }

  /**
   * Helper: Get exemption counts by category over N days
   */
  private async getExemptionsByCategory(days: number = 30): Promise<{
    total: number;
    falsePositive: number;
    businessUrgency: number;
    techDebt: number;
    temporary: number;
  }> {
    const query = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE category = 'false-positive') AS false_positive,
        COUNT(*) FILTER (WHERE category = 'business-urgency') AS business_urgency,
        COUNT(*) FILTER (WHERE category = 'tech-debt') AS tech_debt,
        COUNT(*) FILTER (WHERE category = 'temporary') AS temporary
      FROM policy_exemptions
      WHERE created_at >= NOW() - INTERVAL '${days} days'
    `;

    const result = await this.db.query(query);
    const row = result.rows[0] || {};

    return {
      total: parseInt(row.total || '0', 10),
      falsePositive: parseInt(row.false_positive || '0', 10),
      businessUrgency: parseInt(row.business_urgency || '0', 10),
      techDebt: parseInt(row.tech_debt || '0', 10),
      temporary: parseInt(row.temporary || '0', 10),
    };
  }
}
