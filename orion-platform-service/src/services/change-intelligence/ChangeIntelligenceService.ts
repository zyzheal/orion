/**
 * ChangeIntelligenceService - AI Change Intelligence Analysis
 *
 * Provides comprehensive change analysis including:
 * - Risk assessment based on multiple factors
 * - Affected service identification
 * - Historical change matching
 * - Blast radius calculation
 * - Impact and risk aggregation
 */

import {
  ChangeIntelligenceRepository,
  AffectedServiceRepository,
  RiskFactorRepository,
  HistoricalMatchRepository,
  ChangeIntelligenceReportEntity,
  AffectedServiceEntity,
  RiskFactorEntity,
  HistoricalMatchEntity,
} from '../../repositories/ChangeIntelligenceRepository';

// Explicit type for array mappings
type AffectedServiceEntityArray = AffectedServiceEntity[];
type RiskFactorEntityArray = RiskFactorEntity[];
type HistoricalMatchEntityArray = HistoricalMatchEntity[];
type ReportEntityArray = ChangeIntelligenceReportEntity[];
import {
import pino from 'pino';

const logger = pino({ name: 'LChange-LIntelligence-LService' });
  ChangeIntelligenceAnalyzeInput,
  ChangeIntelligenceReport,
  AffectedService,
  RiskFactor,
  HistoricalMatch,
  RiskLevel,
  computeRiskLevel,
  createChangeIntelligenceReport,
  createAffectedService,
  createRiskFactor,
  createHistoricalMatch,
  ServiceTier,
  ImpactType,
  SloRisk,
} from '../../models/ChangeIntelligence';

// ==================== Interfaces ====================

export interface AnalyzeResult {
  report: ChangeIntelligenceReport;
  affectedServices: AffectedService[];
  riskFactors: RiskFactor[];
  historicalMatches: HistoricalMatch[];
}

export interface ListFilters {
  prId?: string;
  repoId?: string;
  riskLevel?: string;
  days?: number;
}

export interface BlastRadiusResult {
  report: ChangeIntelligenceReportEntity;
  affectedServices: AffectedServiceEntity[];
  totalChangedFiles: number;
  criticalServices: AffectedServiceEntity[];
  serviceTiers: Record<string, number>;
}

export interface ChangeImpactResult {
  totalAnalyses: number;
  highRiskCount: number;
  criticalRiskCount: number;
  avgRiskScore: number;
  topAffectedServices: { serviceName: string; count: number }[];
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface RiskAssessmentResult {
  overallRisk: RiskLevel;
  riskDistribution: Record<RiskLevel, number>;
  recentHighRiskReports: ChangeIntelligenceReportEntity[];
  recommendations: string[];
}

// ==================== Error Class ====================

export class ChangeIntelligenceServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ChangeIntelligenceServiceError';
  }
}

// ==================== Risk Factor Definitions ====================

/**
 * Predefined risk factor configurations used during analysis.
 * Each factor has a name, weight, and description.
 */
const RISK_FACTOR_CONFIGS: Array<{
  name: string;
  weight: number;
  description: string;
  compute: (context: AnalysisContext) => number;
}> = [
  {
    name: 'blast_radius',
    weight: 0.25,
    description: 'Number of services affected by the change',
    compute: (ctx) => Math.min(1.0, ctx.affectedServiceCount / 10),
  },
  {
    name: 'file_change_volume',
    weight: 0.15,
    description: 'Total number of files changed',
    compute: (ctx) => Math.min(1.0, ctx.changedFileCount / 50),
  },
  {
    name: 'service_tier',
    weight: 0.20,
    description: 'Highest tier of affected services (tier-0 is critical)',
    compute: (ctx) => ctx.highestServiceTier === 'tier-0' ? 1.0 : ctx.highestServiceTier === 'tier-1' ? 0.6 : 0.2,
  },
  {
    name: 'historical_incidents',
    weight: 0.15,
    description: 'Whether similar changes caused incidents in the past',
    compute: (ctx) => ctx.historicalIncidentMatch ? 1.0 : 0.1,
  },
  {
    name: 'change_complexity',
    weight: 0.10,
    description: 'Complexity of the change based on file types and patterns',
    compute: (ctx) => {
      const complexPatterns = ['.config.', '.yaml', '.yml', '.sql', 'migration', 'schema'];
      const complexCount = ctx.changedFiles.filter(f =>
        complexPatterns.some(p => f.toLowerCase().includes(p))
      ).length;
      return Math.min(1.0, complexCount / 5);
    },
  },
  {
    name: 'dependency_chain',
    weight: 0.15,
    description: 'Depth of dependency chain affected',
    compute: (ctx) => Math.min(1.0, ctx.dependencyDepth / 5),
  },
];

/**
 * Analysis context built from the input during analysis
 */
interface AnalysisContext {
  changedFiles: string[];
  affectedServiceCount: number;
  changedFileCount: number;
  highestServiceTier: ServiceTier;
  historicalIncidentMatch: boolean;
  dependencyDepth: number;
}

// ==================== Main Service ====================

export class ChangeIntelligenceService {
  private changeIntelligenceRepo: ChangeIntelligenceRepository;
  private affectedServiceRepo: AffectedServiceRepository;
  private riskFactorRepo: RiskFactorRepository;
  private historicalMatchRepo: HistoricalMatchRepository;

  constructor(
    changeIntelligenceRepo: ChangeIntelligenceRepository,
    affectedServiceRepo: AffectedServiceRepository,
    riskFactorRepo: RiskFactorRepository,
    historicalMatchRepo: HistoricalMatchRepository,
  ) {
    this.changeIntelligenceRepo = changeIntelligenceRepo;
    this.affectedServiceRepo = affectedServiceRepo;
    this.riskFactorRepo = riskFactorRepo;
    this.historicalMatchRepo = historicalMatchRepo;
  }

  // ==================== Core Analysis ====================

  /**
   * Analyze a code change and produce a comprehensive report.
   * Computes risk score, identifies affected services, calculates risk factors,
   * and searches for historical matches.
   */
  async analyze(input: ChangeIntelligenceAnalyzeInput): Promise<AnalyzeResult> {
    const { prId, repoId, commitSha } = input;

    // Step 1: Build analysis context (in a production system, this would come from
    // Git diff analysis, service registry, dependency graph, etc.)
    const context = await this.buildAnalysisContext(input);

    // Step 2: Compute risk factors with SHAP values
    const riskFactors = this.computeRiskFactors(context);

    // Step 3: Calculate overall risk score (weighted sum)
    const riskScore = this.calculateRiskScore(riskFactors);

    // Step 4: Identify affected services
    const affectedServices = await this.identifyAffectedServices(context, prId, repoId);

    // Step 5: Find historical matches
    const historicalMatches = await this.findHistoricalMatches(input, context);

    // Step 6: Create and persist the report
    const reportModel = createChangeIntelligenceReport(
      input,
      riskScore,
      riskFactors.map(f => ({ factor: f.factorName, value: f.factorValue, contribution: f.contribution })),
      affectedServices.length,
      affectedServices.filter(s => s.impactType === 'direct').length,
    );

    // Persist to PostgreSQL
    const reportEntity = await this.persistAnalysis(
      reportModel,
      affectedServices,
      riskFactors,
      historicalMatches,
    );

    // Convert back to domain model for response
    const report: ChangeIntelligenceReport = {
      id: reportEntity.id,
      prId: reportEntity.prId,
      repoId: reportEntity.repoId,
      commitSha: reportEntity.commitSha,
      riskScore: reportEntity.riskScore,
      riskLevel: reportEntity.riskLevel as RiskLevel,
      affectedServices: reportEntity.affectedServices,
      affectedCapabilities: reportEntity.affectedCapabilities,
      shapFactors: (reportEntity.shapFactors || []) as Array<{ factor: string; value: number; contribution: number }>,
      gitlabCommentPosted: reportEntity.gitlabCommentPosted,
      createdAt: reportEntity.createdAt,
      updatedAt: reportEntity.updatedAt,
    };

    return { report, affectedServices, riskFactors, historicalMatches };
  }

  /**
   * Get analysis result by report ID, including all related data.
   */
  async getAnalysis(id: string): Promise<AnalyzeResult | null> {
    const reportEntity = await this.changeIntelligenceRepo.findById(id);
    if (!reportEntity) return null;

    const [affectedServices, riskFactors, historicalMatches] = await Promise.all([
      this.affectedServiceRepo.findByReport(id),
      this.riskFactorRepo.findByReport(id),
      this.historicalMatchRepo.findByReport(id),
    ]);

    const report: ChangeIntelligenceReport = {
      id: reportEntity.id,
      prId: reportEntity.prId,
      repoId: reportEntity.repoId,
      commitSha: reportEntity.commitSha,
      riskScore: reportEntity.riskScore,
      riskLevel: reportEntity.riskLevel as RiskLevel,
      affectedServices: reportEntity.affectedServices,
      affectedCapabilities: reportEntity.affectedCapabilities,
      shapFactors: (reportEntity.shapFactors || []) as Array<{ factor: string; value: number; contribution: number }>,
      gitlabCommentPosted: reportEntity.gitlabCommentPosted,
      createdAt: reportEntity.createdAt,
      updatedAt: reportEntity.updatedAt,
    };

    const mappedAffectedServices = affectedServices.map((s: AffectedServiceEntity) => this.mapAffectedService(s));
    const mappedRiskFactors = riskFactors.map((f: RiskFactorEntity) => this.mapRiskFactor(f));
    const mappedHistoricalMatches = historicalMatches.map((h: HistoricalMatchEntity) => this.mapHistoricalMatch(h));

    return {
      report,
      affectedServices: mappedAffectedServices,
      riskFactors: mappedRiskFactors,
      historicalMatches: mappedHistoricalMatches,
    };
  }

  /**
   * Get a report by ID (simplified, for controller).
   */
  async getById(id: string): Promise<ChangeIntelligenceReport | null> {
    const result = await this.getAnalysis(id);
    return result ? result.report : null;
  }

  // ==================== Query Methods ====================

  /**
   * List analysis reports with optional filters.
   */
  async list(filters: ListFilters = {}): Promise<ChangeIntelligenceReport[]> {
    let entities: ChangeIntelligenceReportEntity[] = [];

    if (filters.prId && filters.repoId) {
      entities = await this.changeIntelligenceRepo.findByPrRepo(filters.prId, filters.repoId);
    } else if (filters.riskLevel) {
      entities = await this.changeIntelligenceRepo.findByRiskLevel(filters.riskLevel);
    } else if (filters.days) {
      entities = await this.changeIntelligenceRepo.findRecent(filters.days);
    } else {
      // Default: find recent 30 days
      entities = await this.changeIntelligenceRepo.findRecent(30);
    }

    return entities.map(e => this.mapReport(e));
  }

  /**
   * List analyses by tenant (via repoId prefix convention).
   */
  async listAnalyses(tenantId: string, limit: number = 50): Promise<ChangeIntelligenceReport[]> {
    const recent = await this.changeIntelligenceRepo.findRecent(30);
    const tenantReports = recent
      .filter(r => r.repoId.startsWith(`${tenantId}-`) || r.repoId === tenantId)
      .slice(0, limit);
    return tenantReports.map(e => this.mapReport(e));
  }

  // ==================== Impact & Risk ====================

  /**
   * Get the blast radius for a specific report.
   * Includes affected services, changed file counts, critical services.
   */
  async getBlastRadius(reportId: string): Promise<BlastRadiusResult> {
    const report = await this.changeIntelligenceRepo.findById(reportId);
    if (!report) {
      throw new ChangeIntelligenceServiceError(`Report not found: ${reportId}`, 'REPORT_NOT_FOUND');
    }

    const affectedServices = await this.affectedServiceRepo.findByReport(reportId);

    const allChangedFiles = affectedServices.flatMap(s => s.changedFiles || []);
    const uniqueFiles = [...new Set(allChangedFiles)];

    const criticalServices = affectedServices.filter(
      s => s.serviceTier === 'tier-0' && s.impactType === 'direct',
    );

    const serviceTiers: Record<string, number> = {};
    for (const svc of affectedServices) {
      const tier = svc.serviceTier || 'unknown';
      serviceTiers[tier] = (serviceTiers[tier] || 0) + 1;
    }

    return {
      report,
      affectedServices,
      totalChangedFiles: uniqueFiles.length,
      criticalServices,
      serviceTiers,
    };
  }

  /**
   * Get change impact summary across all analyses.
   */
  async getChangeImpact(days: number = 30): Promise<ChangeImpactResult> {
    const reports: ReportEntityArray = await this.changeIntelligenceRepo.findRecent(days);

    const totalAnalyses = reports.length;
    const highRiskCount = reports.filter((r: ChangeIntelligenceReportEntity) => r.riskLevel === 'high').length;
    const criticalRiskCount = reports.filter((r: ChangeIntelligenceReportEntity) => r.riskLevel === 'critical').length;
    const avgRiskScore = totalAnalyses > 0
      ? reports.reduce((sum: number, r: ChangeIntelligenceReportEntity) => sum + r.riskScore, 0) / totalAnalyses
      : 0;

    // Aggregate affected services across all reports
    const serviceCount: Map<string, number> = new Map();
    for (const report of reports) {
      const services: AffectedServiceEntityArray = await this.affectedServiceRepo.findByReport(report.id);
      for (const svc of services) {
        serviceCount.set(svc.serviceName, (serviceCount.get(svc.serviceName) || 0) + 1);
      }
    }

    const topAffectedServices = Array.from(serviceCount.entries())
      .map(([serviceName, count]) => ({ serviceName, count }))
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
      .slice(0, 10);

    // Determine trend by comparing recent 7 days vs previous 23 days
    const recent7 = await this.changeIntelligenceRepo.findRecent(7);
    const avgRecent7 = recent7.length > 0
      ? recent7.reduce((sum, r) => sum + r.riskScore, 0) / recent7.length
      : 0;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (avgRecent7 > avgRiskScore * 1.1) trend = 'increasing';
    else if (avgRecent7 < avgRiskScore * 0.9) trend = 'decreasing';

    return {
      totalAnalyses,
      highRiskCount,
      criticalRiskCount,
      avgRiskScore: Math.round(avgRiskScore * 100) / 100,
      topAffectedServices,
      trend,
    };
  }

  /**
   * Get risk assessment summary.
   */
  async getRiskAssessment(days: number = 30): Promise<RiskAssessmentResult> {
    const reports: ReportEntityArray = await this.changeIntelligenceRepo.findRecent(days);

    const riskDistribution: Record<RiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const report of reports) {
      const level = report.riskLevel as RiskLevel;
      if (riskDistribution[level] !== undefined) {
        riskDistribution[level]++;
      }
    }

    // Determine overall risk based on distribution
    let overallRisk: RiskLevel = 'low';
    if (riskDistribution.critical > 0) overallRisk = 'critical';
    else if (riskDistribution.high > 2) overallRisk = 'high';
    else if (riskDistribution.high > 0) overallRisk = 'high';
    else if (riskDistribution.medium > 5) overallRisk = 'medium';

    // Get recent high-risk reports
    const recentHighRiskReports = reports
      .filter((r: ChangeIntelligenceReportEntity) => r.riskLevel === 'high' || r.riskLevel === 'critical')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    // Generate recommendations
    const recommendations = this.generateRecommendations(riskDistribution, recentHighRiskReports);

    return {
      overallRisk,
      riskDistribution,
      recentHighRiskReports,
      recommendations,
    };
  }

  // ==================== CRUD Operations ====================

  /**
   * Delete a report and all its related data.
   */
  async deleteReport(id: string): Promise<boolean> {
    const existing = await this.changeIntelligenceRepo.findById(id);
    if (!existing) {
      throw new ChangeIntelligenceServiceError(`Report not found: ${id}`, 'REPORT_NOT_FOUND');
    }
    // Cascade delete handles related records via DB foreign keys
    return this.changeIntelligenceRepo.delete(id);
  }

  /**
   * Mark GitLab comment as posted for a report.
   */
  async markCommentPosted(id: string): Promise<ChangeIntelligenceReport | null> {
    const entity = await this.changeIntelligenceRepo.markCommentPosted(id);
    if (!entity) return null;
    return this.mapReport(entity);
  }

  // ==================== Internal Methods ====================

  /**
   * Build analysis context from the input.
   * In production, this would integrate with Git service, service registry,
   * dependency graph, and historical database.
   */
  private async buildAnalysisContext(input: ChangeIntelligenceAnalyzeInput): Promise<AnalysisContext> {
    // TODO: In production, fetch real data from:
    // 1. Git service - get changed files from diff
    // 2. Service registry - map files to services
    // 3. Dependency graph - compute dependency depth
    // 4. Historical DB - check for past incidents

    // Default context for stub implementation
    return {
      changedFiles: [],
      affectedServiceCount: 0,
      changedFileCount: 0,
      highestServiceTier: 'tier-2',
      historicalIncidentMatch: false,
      dependencyDepth: 1,
    };
  }

  /**
   * Compute risk factors based on the analysis context.
   * Uses predefined risk factor configurations with SHAP-like contributions.
   */
  private computeRiskFactors(context: AnalysisContext): RiskFactor[] {
    const factors: RiskFactor[] = [];
    let totalContribution = 0;

    for (const config of RISK_FACTOR_CONFIGS) {
      const value = config.compute(context);
      const contribution = Math.round(value * config.weight * 1000) / 1000;

      factors.push(createRiskFactor({
        reportId: '', // Will be set when persisting
        factorName: config.name,
        factorValue: value,
        weight: config.weight,
        contribution,
        description: config.description,
      }));

      totalContribution += contribution;
    }

    // Normalize contributions to sum to total risk score
    if (totalContribution > 0) {
      for (const factor of factors) {
        factor.contribution = Math.round((factor.contribution / totalContribution) * totalContribution * 1000) / 1000;
      }
    }

    return factors;
  }

  /**
   * Calculate overall risk score from risk factors.
   */
  private calculateRiskScore(factors: RiskFactor[]): number {
    let score = 0;
    for (const factor of factors) {
      score += factor.factorValue * factor.weight;
    }
    return Math.min(1, Math.max(0, Math.round(score * 100) / 100));
  }

  /**
   * Identify affected services from the analysis context.
   * In production, this would use a service registry and file-to-service mapping.
   */
  private async identifyAffectedServices(
    context: AnalysisContext,
    prId: string,
    repoId: string,
  ): Promise<AffectedService[]> {
    // TODO: In production, integrate with:
    // 1. File-to-service mapping from service registry
    // 2. Dependency graph to find downstream services
    // 3. CODEOWNERS file for recommended reviewers

    // Stub: return empty array (real data would come from service mapping)
    return [];
  }

  /**
   * Find historical matches for the given change.
   * In production, this would use vector similarity or git diff comparison.
   */
  private async findHistoricalMatches(
    input: ChangeIntelligenceAnalyzeInput,
    context: AnalysisContext,
  ): Promise<HistoricalMatch[]> {
    // TODO: In production, integrate with:
    // 1. Vector store of historical PR diffs
    // 2. Incident database to find linked incidents
    // 3. Similarity scoring based on file overlap and diff patterns

    // Stub: return empty array (real data would come from historical search)
    return [];
  }

  /**
   * Persist the analysis result to PostgreSQL.
   */
  private async persistAnalysis(
    report: ChangeIntelligenceReport,
    affectedServices: AffectedService[],
    riskFactors: RiskFactor[],
    historicalMatches: HistoricalMatch[],
  ): Promise<ChangeIntelligenceReportEntity> {
    // Create report entity
    const reportEntity = await this.changeIntelligenceRepo.create({
      prId: report.prId,
      repoId: report.repoId,
      commitSha: report.commitSha,
      riskScore: report.riskScore,
      riskLevel: report.riskLevel,
      affectedServices: report.affectedServices,
      affectedCapabilities: report.affectedCapabilities,
      shapFactors: report.shapFactors,
      gitlabCommentPosted: report.gitlabCommentPosted,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    });

    const reportId = reportEntity.id;

    // Create related entities (failures are non-blocking)
    try {
      if (affectedServices.length > 0) {
        const serviceEntities = affectedServices.map(s => ({
          reportId,
          serviceName: s.serviceName,
          serviceTier: s.serviceTier || null,
          impactType: s.impactType || null,
          changedFiles: s.changedFiles,
          sloRisk: s.sloRisk || null,
          recommendedReviewers: s.recommendedReviewers,
        }));
        await this.affectedServiceRepo.batchCreate(serviceEntities);
      }
    } catch (err) {
      logger.error(`Failed to persist affected services for report ${reportId}:`, err);
    }

    try {
      if (riskFactors.length > 0) {
        const factorEntities = riskFactors.map(f => ({
          reportId,
          factorName: f.factorName,
          factorValue: f.factorValue,
          weight: f.weight,
          contribution: f.contribution,
          description: f.description || null,
        }));
        await this.riskFactorRepo.batchCreate(factorEntities);
      }
    } catch (err) {
      logger.error(`Failed to persist risk factors for report ${reportId}:`, err);
    }

    try {
      if (historicalMatches.length > 0) {
        const matchEntities = historicalMatches.map(h => ({
          reportId,
          historicalPr: h.historicalPr || null,
          similarity: h.similarity || null,
          incidentLinked: h.incidentLinked,
          incidentId: h.incidentId || null,
        }));
        // Note: HistoricalMatchRepository doesn't have batchCreate, so we use individual creates
        for (const match of matchEntities) {
          await this.historicalMatchRepo.create(match as any);
        }
      }
    } catch (err) {
      logger.error(`Failed to persist historical matches for report ${reportId}:`, err);
    }

    return reportEntity;
  }

  /**
   * Generate recommendations based on risk distribution.
   */
  private generateRecommendations(
    distribution: Record<RiskLevel, number>,
    highRiskReports: ChangeIntelligenceReportEntity[],
  ): string[] {
    const recommendations: string[] = [];

    if (distribution.critical > 0) {
      recommendations.push(
        `Critical risk changes detected (${distribution.critical}). ` +
        'Review these changes with senior team members before merging.',
      );
    }

    if (distribution.high > 5) {
      recommendations.push(
        'High number of high-risk changes. Consider implementing more granular PRs ' +
        'to reduce blast radius.',
      );
    }

    if (distribution.medium > 10) {
      recommendations.push(
        'Moderate risk changes are frequent. Review team\'s change patterns ' +
        'and consider adding more automated tests.',
      );
    }

    // Check for service concentration
    const serviceCounts: Map<string, number> = new Map();
    for (const report of highRiskReports) {
      if (report.affectedServices > 3) {
        serviceCounts.set(report.repoId, (serviceCounts.get(report.repoId) || 0) + 1);
      }
    }

    for (const [repo, count] of serviceCounts.entries()) {
      if (count >= 3) {
        recommendations.push(
          `Repository "${repo}" has multiple high-risk changes. ` +
          'Review architecture to reduce coupling.',
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Risk levels are within normal parameters. Continue current practices.');
    }

    return recommendations;
  }

  // ==================== Entity Mapping Helpers ====================

  private mapReport(entity: ChangeIntelligenceReportEntity): ChangeIntelligenceReport {
    return {
      id: entity.id,
      prId: entity.prId,
      repoId: entity.repoId,
      commitSha: entity.commitSha,
      riskScore: entity.riskScore,
      riskLevel: entity.riskLevel as RiskLevel,
      affectedServices: entity.affectedServices,
      affectedCapabilities: entity.affectedCapabilities,
      shapFactors: (entity.shapFactors || []) as Array<{ factor: string; value: number; contribution: number }>,
      gitlabCommentPosted: entity.gitlabCommentPosted,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private mapAffectedService(entity: AffectedServiceEntity): AffectedService {
    return {
      id: entity.id,
      reportId: entity.reportId,
      serviceName: entity.serviceName,
      serviceTier: (entity.serviceTier || undefined) as ServiceTier | undefined,
      impactType: (entity.impactType || undefined) as ImpactType | undefined,
      changedFiles: entity.changedFiles || [],
      sloRisk: (entity.sloRisk || undefined) as SloRisk | undefined,
      recommendedReviewers: entity.recommendedReviewers || [],
    };
  }

  private mapRiskFactor(entity: RiskFactorEntity): RiskFactor {
    return {
      id: entity.id,
      reportId: entity.reportId,
      factorName: entity.factorName,
      factorValue: entity.factorValue,
      weight: entity.weight,
      contribution: entity.contribution,
      description: entity.description || undefined,
    };
  }

  private mapHistoricalMatch(entity: HistoricalMatchEntity): HistoricalMatch {
    return {
      id: entity.id,
      reportId: entity.reportId,
      historicalPr: entity.historicalPr || undefined,
      similarity: entity.similarity || undefined,
      incidentLinked: entity.incidentLinked,
      incidentId: entity.incidentId || undefined,
    };
  }
}

export default ChangeIntelligenceService;
