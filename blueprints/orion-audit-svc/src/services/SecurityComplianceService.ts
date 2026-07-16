import { Pool } from 'pg';

export class SecurityComplianceService {
  constructor(private pool: Pool) {}

  async definePolicy(data: any) {
    const result = await this.pool.query(
      'INSERT INTO compliance_policies (name, description, framework, rules, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [data.name, data.description, data.framework, JSON.stringify(data.rules), 'active']
    );
    return result.rows[0];
  }

  async listPolicies(filter?: { framework?: string }) {
    let sql = 'SELECT * FROM compliance_policies WHERE 1=1';
    const params: any[] = [];
    let idx = 1;
    if (filter?.framework) {
      sql += ` AND framework = $${idx++}`;
      params.push(filter.framework);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async evaluateCompliance(data: any) {
    const result = await this.pool.query(
      'INSERT INTO compliance_evaluations (policy_id, resource_id, status, score, evaluated_by, details) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [data.policyId, data.resourceId, data.status || 'evaluating', 0, data.evaluatedBy, JSON.stringify(data.details)]
    );
    return result.rows[0];
  }

  async getComplianceReport(policyId: string) {
    const result = await this.pool.query(
      'SELECT * FROM compliance_evaluations WHERE policy_id = $1 ORDER BY evaluated_at DESC LIMIT 1',
      [policyId]
    );
    return result.rows[0] || null;
  }

  async getComplianceScore() {
    const result = await this.pool.query(
      `SELECT p.id, p.name, p.framework,
        COUNT(e.id) as total_evaluations,
        AVG(e.score) as avg_score,
        COUNT(e.id) FILTER (WHERE e.status = 'compliant') as compliant_count
       FROM compliance_policies p
       LEFT JOIN compliance_evaluations e ON p.id = e.policy_id
       GROUP BY p.id, p.name, p.framework`
    );
    return result.rows;
  }

  async autoRemediateCompliance(data: any) {
    const result = await this.pool.query(
      'INSERT INTO remediations (finding_id, description, status, assigned_to) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.findingId, data.description, 'in_progress', data.assignedTo]
    );
    return result.rows[0];
  }

  async createAuditPlan(data: any) {
    const result = await this.pool.query(
      'INSERT INTO audit_plans (name, description, scope, status, created_by, start_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [data.name, data.description, JSON.stringify(data.scope), 'draft', data.createdBy, data.startDate]
    );
    return result.rows[0];
  }

  async listAuditPlans() {
    const result = await this.pool.query('SELECT * FROM audit_plans ORDER BY created_at DESC');
    return result.rows;
  }

  async executeAudit(auditId: string) {
    await this.pool.query("UPDATE audit_plans SET status = 'active', start_date = NOW() WHERE id = $1", [auditId]);
    const result = await this.pool.query('SELECT * FROM audit_plans WHERE id = $1', [auditId]);
    return result.rows[0];
  }

  async getAuditReport(auditId: string) {
    const result = await this.pool.query('SELECT * FROM audit_plans WHERE id = $1', [auditId]);
    return result.rows[0] || null;
  }

  async getAuditFindings(auditId: string) {
    const result = await this.pool.query('SELECT * FROM audit_findings WHERE audit_plan_id = $1', [auditId]);
    return result.rows;
  }

  async closeFinding(findingId: string) {
    const result = await this.pool.query(
      "UPDATE audit_findings SET status = 'resolved', updated_at = NOW() WHERE id = $1 RETURNING *",
      [findingId]
    );
    return result.rows[0];
  }

  async getFrameworks() {
    const result = await this.pool.query('SELECT * FROM compliance_frameworks ORDER BY name');
    return result.rows;
  }

  async getFramework(id: string) {
    const result = await this.pool.query('SELECT * FROM compliance_frameworks WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async collectEvidence(data: any) {
    const result = await this.pool.query(
      'INSERT INTO compliance_evidence (finding_id, type, content, source, collected_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [data.findingId, data.type, data.content, data.source, data.collectedBy]
    );
    return result.rows[0];
  }

  async getEvidence(policyId: string) {
    const result = await this.pool.query(
      'SELECT e.* FROM compliance_evidence e JOIN compliance_evaluations ce ON e.finding_id = ce.id WHERE ce.policy_id = $1',
      [policyId]
    );
    return result.rows;
  }

  async generateEvidenceCollection(data: any) {
    return { status: 'initiated', policyId: data.policyId, timestamp: new Date().toISOString() };
  }

  async performGapAnalysis(data: any) {
    return { status: 'analyzing', frameworkId: data.frameworkId, timestamp: new Date().toISOString() };
  }
}
