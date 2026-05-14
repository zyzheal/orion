import { BaseRepository } from '../db/base-repository';

// Entity types
export interface ChangeIntelligenceReportEntity {
  id: string;
  prId: string;
  repoId: string;
  commitSha: string;
  riskScore: number;
  riskLevel: string;
  affectedServices: number;
  affectedCapabilities: number;
  shapFactors: Record<string, any>[] | null;
  gitlabCommentPosted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AffectedServiceEntity {
  id: string;
  reportId: string;
  serviceName: string;
  serviceTier: string | null;
  impactType: string | null;
  changedFiles: string[];
  sloRisk: string | null;
  recommendedReviewers: string[];
}

export interface RiskFactorEntity {
  id: string;
  reportId: string;
  factorName: string;
  factorValue: number;
  weight: number;
  contribution: number;
  description: string | null;
}

export interface HistoricalMatchEntity {
  id: string;
  reportId: string;
  historicalPr: string | null;
  similarity: number | null;
  incidentLinked: boolean;
  incidentId: string | null;
}

// Main Repository
export class ChangeIntelligenceRepository extends BaseRepository<ChangeIntelligenceReportEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'change_intelligence_reports');
  }

  async findByPrRepo(prId: string, repoId: string): Promise<ChangeIntelligenceReportEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_intelligence_reports WHERE pr_id = $1 AND repo_id = $2 ORDER BY created_at DESC`,
      [prId, repoId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByRiskLevel(riskLevel: string): Promise<ChangeIntelligenceReportEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_intelligence_reports WHERE risk_level = $1 ORDER BY created_at DESC`,
      [riskLevel],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findRecent(days: number): Promise<ChangeIntelligenceReportEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_intelligence_reports WHERE created_at >= NOW() - INTERVAL '1 day' * $1 ORDER BY created_at DESC`,
      [days],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async markCommentPosted(id: string): Promise<ChangeIntelligenceReportEntity | null> {
    const result = await this.db.query(
      `UPDATE change_intelligence_reports SET gitlab_comment_posted = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ChangeIntelligenceReportEntity {
    return {
      id: row.id,
      prId: row.pr_id,
      repoId: row.repo_id,
      commitSha: row.commit_sha,
      riskScore: row.risk_score ?? 0,
      riskLevel: row.risk_level ?? 'low',
      affectedServices: row.affected_services ?? 0,
      affectedCapabilities: row.affected_capabilities ?? 0,
      shapFactors: row.shap_factors,
      gitlabCommentPosted: row.gitlab_comment_posted ?? false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Affected Services Repository
export class AffectedServiceRepository extends BaseRepository<AffectedServiceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'change_intelligence_affected_services');
  }

  async findByReport(reportId: string): Promise<AffectedServiceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_intelligence_affected_services WHERE report_id = $1`,
      [reportId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async batchCreate(services: Omit<AffectedServiceEntity, 'id'>[]): Promise<AffectedServiceEntity[]> {
    const results: AffectedServiceEntity[] = [];
    for (const svc of services) {
      const result = await this.db.query(
        `INSERT INTO change_intelligence_affected_services (report_id, service_name, service_tier, impact_type, changed_files, slo_risk, recommended_reviewers) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [svc.reportId, svc.serviceName, svc.serviceTier, svc.impactType, svc.changedFiles, svc.sloRisk, svc.recommendedReviewers],
      );
      results.push(this.mapRowToEntity(result.rows[0]));
    }
    return results;
  }

  protected mapRowToEntity(row: any): AffectedServiceEntity {
    return {
      id: row.id,
      reportId: row.report_id,
      serviceName: row.service_name,
      serviceTier: row.service_tier,
      impactType: row.impact_type,
      changedFiles: row.changed_files ?? [],
      sloRisk: row.slo_risk,
      recommendedReviewers: row.recommended_reviewers ?? [],
    };
  }
}

// Risk Factors Repository
export class RiskFactorRepository extends BaseRepository<RiskFactorEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'change_intelligence_risk_factors');
  }

  async findByReport(reportId: string): Promise<RiskFactorEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_intelligence_risk_factors WHERE report_id = $1 ORDER BY contribution DESC`,
      [reportId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async batchCreate(factors: Omit<RiskFactorEntity, 'id'>[]): Promise<RiskFactorEntity[]> {
    const results: RiskFactorEntity[] = [];
    for (const factor of factors) {
      const result = await this.db.query(
        `INSERT INTO change_intelligence_risk_factors (report_id, factor_name, factor_value, weight, contribution, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [factor.reportId, factor.factorName, factor.factorValue, factor.weight, factor.contribution, factor.description],
      );
      results.push(this.mapRowToEntity(result.rows[0]));
    }
    return results;
  }

  protected mapRowToEntity(row: any): RiskFactorEntity {
    return {
      id: row.id,
      reportId: row.report_id,
      factorName: row.factor_name,
      factorValue: row.factor_value,
      weight: row.weight,
      contribution: row.contribution,
      description: row.description,
    };
  }
}

// Historical Matches Repository
export class HistoricalMatchRepository extends BaseRepository<HistoricalMatchEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'change_intelligence_historical_matches');
  }

  async findByReport(reportId: string): Promise<HistoricalMatchEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_intelligence_historical_matches WHERE report_id = $1 ORDER BY similarity DESC`,
      [reportId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByIncident(incidentId: string): Promise<HistoricalMatchEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_intelligence_historical_matches WHERE incident_id = $1`,
      [incidentId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): HistoricalMatchEntity {
    return {
      id: row.id,
      reportId: row.report_id,
      historicalPr: row.historical_pr,
      similarity: row.similarity,
      incidentLinked: row.incident_linked ?? false,
      incidentId: row.incident_id,
    };
  }
}