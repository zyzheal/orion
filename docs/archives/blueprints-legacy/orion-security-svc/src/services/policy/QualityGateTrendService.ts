/**
 * QualityGateTrendService - Quality Gate Trend Analysis
 *
 * Provides trend analysis, violation distribution, top failing policies,
 * exemption statistics, and recommendations.
 */

import { DatabasePool } from '../../utils/database';

export class QualityGateTrendService {
  constructor(private db: DatabasePool) {}

  async getPassRateTrend(days: number, policyId?: string): Promise<any> {
    const query = policyId
      ? `SELECT DATE(evaluated_at) as date, COUNT(*) as total,
           SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count
         FROM policy_evaluations
         WHERE policy_id = $1 AND evaluated_at >= NOW() - INTERVAL '${days} days'
         GROUP BY DATE(evaluated_at) ORDER BY date`
      : `SELECT DATE(evaluated_at) as date, COUNT(*) as total,
           SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count
         FROM policy_evaluations
         WHERE evaluated_at >= NOW() - INTERVAL '${days} days'
         GROUP BY DATE(evaluated_at) ORDER BY date`;

    const params = policyId ? [policyId] : [];
    const result = await this.db.query(query, params);

    const trend = result.rows.map((row: any) => ({
      date: row.date,
      total: parseInt(row.total, 10),
      passed: parseInt(row.passed_count, 10),
      passRate: parseInt(row.total, 10) > 0
        ? Math.round((parseInt(row.passed_count, 10) / parseInt(row.total, 10)) * 100)
        : 0,
    }));

    return { days, policyId, trend };
  }

  async getViolationDistribution(days: number, groupBy: 'severity' | 'policy' = 'severity'): Promise<any> {
    const query = groupBy === 'severity'
      ? `SELECT severity, COUNT(*) as count
         FROM policy_violations
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY severity ORDER BY count DESC`
      : `SELECT policy_id, COUNT(*) as count
         FROM policy_violations
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY policy_id ORDER BY count DESC`;

    const result = await this.db.query(query);
    return { days, groupBy, distribution: result.rows };
  }

  async getTopFailingPolicies(limit: number, days: number): Promise<any[]> {
    const result = await this.db.query(
      `SELECT p.name as policy_name, p.id as policy_id, COUNT(v.id) as violation_count
       FROM policy_violations v
       JOIN policies p ON v.policy_id = p.id
       WHERE v.created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY p.id, p.name
       ORDER BY violation_count DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async getExemptionStats(): Promise<any> {
    const result = await this.db.query(
      `SELECT status, COUNT(*) as count
       FROM policy_exemptions
       GROUP BY status`
    );

    const total = await this.db.query('SELECT COUNT(*) as total FROM policy_exemptions');
    const expired = await this.db.query(
      `SELECT COUNT(*) as count FROM policy_exemptions WHERE expires_at < NOW() AND status != 'expired'`
    );

    return {
      byStatus: result.rows.reduce((acc: Record<string, number>, row: any) => {
        acc[row.status] = parseInt(row.count, 10);
        return acc;
      }, {}),
      total: parseInt(total.rows[0].total, 10),
      expired: parseInt(expired.rows[0].count, 10),
    };
  }

  async getRecommendations(policyId?: string): Promise<any[]> {
    const recommendations: any[] = [];

    // Check for frequently failing policies
    const topFailing = await this.getTopFailingPolicies(5, 30);
    for (const policy of topFailing) {
      recommendations.push({
        type: 'policy_review',
        policyId: policy.policy_id,
        policyName: policy.policy_name,
        message: `Policy "${policy.policy_name}" has ${policy.violation_count} violations in the last 30 days. Consider reviewing or adjusting the policy.`,
        priority: 'high',
      });
    }

    // Check for expired exemptions
    const stats = await this.getExemptionStats();
    if (stats.expired > 0) {
      recommendations.push({
        type: 'expired_exemptions',
        message: `${stats.expired} exemptions have expired. Review and renew or revoke as needed.`,
        priority: 'medium',
      });
    }

    return recommendations;
  }
}
