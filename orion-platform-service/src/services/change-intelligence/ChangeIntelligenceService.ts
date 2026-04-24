/**
 * Change Intelligence Service - AI 变更智能分析
 */

import { EventBusService } from '../event-bus-service';
import {
  ChangeIntelligenceReport,
  ChangeIntelligenceAnalyzeInput,
  createChangeIntelligenceReport,
  computeRiskLevel,
  ShapFactor,
  AffectedService,
  AffectedServiceCreateInput,
  createAffectedService,
  RiskFactor,
  RiskFactorCreateInput,
  createRiskFactor,
  HistoricalMatch,
  HistoricalMatchCreateInput,
  createHistoricalMatch,
} from '../../models/ChangeIntelligence';
import {
  ChangeIntelligenceRepository,
  AffectedServiceRepository,
  RiskFactorRepository,
  HistoricalMatchRepository,
} from '../../repositories/ChangeIntelligenceRepository';

export interface ChangeIntelligenceReportListFilter {
  prId?: string;
  repoId?: string;
  riskLevel?: string;
  days?: number;
}

export interface BlastRadiusResponse {
  nodes: Array<{ id: string; label: string; type: string; risk?: number }>;
  edges: Array<{ from: string; to: string; label: string }>;
}

export class ChangeIntelligenceService {
  private reports: Map<string, ChangeIntelligenceReport> = new Map();
  private affectedServices: Map<string, AffectedService[]> = new Map();
  private riskFactors: Map<string, RiskFactor[]> = new Map();
  private historicalMatches: Map<string, HistoricalMatch[]> = new Map();
  private eventBus?: EventBusService;

  // Repositories
  private reportRepository?: ChangeIntelligenceRepository;
  private affectedServiceRepository?: AffectedServiceRepository;
  private riskFactorRepository?: RiskFactorRepository;
  private historicalMatchRepository?: HistoricalMatchRepository;

  constructor(options?: { eventBus?: EventBusService; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    this.eventBus = options?.eventBus;
    if (options?.db) {
      this.reportRepository = new ChangeIntelligenceRepository(options.db);
      this.affectedServiceRepository = new AffectedServiceRepository(options.db);
      this.riskFactorRepository = new RiskFactorRepository(options.db);
      this.historicalMatchRepository = new HistoricalMatchRepository(options.db);
    }
  }

  /**
   * Analyze a PR/MR change for semantic blast radius
   * MVP: mock analysis with realistic data
   */
  async analyze(input: ChangeIntelligenceAnalyzeInput): Promise<{
    report: ChangeIntelligenceReport;
    affectedServices: AffectedService[];
    riskFactors: RiskFactor[];
    historicalMatches: HistoricalMatch[];
  }> {
    // Mock SHAP factors from XGBoost
    const shapFactors: ShapFactor[] = [
      { factor: 'blast_radius', value: 0.7, contribution: 0.25 },
      { factor: 'service_tier', value: 0.9, contribution: 0.20 },
      { factor: 'file_count', value: 0.3, contribution: 0.10 },
      { factor: 'test_coverage', value: 0.2, contribution: -0.05 },
      { factor: 'dependency_depth', value: 0.6, contribution: 0.15 },
    ];

    const rawScore = shapFactors.reduce((sum, f) => sum + f.contribution, 0);
    const riskScore = Math.min(1, Math.max(0, rawScore + 0.3));

    const report = createChangeIntelligenceReport(input, riskScore, shapFactors, 3, 5);
    this.reports.set(report.id, report);

    // Store report in repository
    if (this.reportRepository) {
      await this.reportRepository.create({
        prId: input.prId,
        repoId: input.repoId,
        commitSha: input.commitSha,
        riskScore,
        riskLevel: report.riskLevel,
        affectedServices: 3,
        affectedCapabilities: 5,
        shapFactors: shapFactors,
        gitlabCommentPosted: false,
        createdAt: report.createdAt,
        updatedAt: report.createdAt,
      });
    }

    // Mock affected services
    const services: AffectedService[] = [
      createAffectedService({
        reportId: report.id,
        serviceName: 'payment-service',
        serviceTier: 'tier-0',
        impactType: 'direct',
        changedFiles: ['src/payment/processor.ts', 'src/payment/validator.ts'],
        sloRisk: 'high',
        recommendedReviewers: ['user-payment-lead', 'user-sre-1'],
      }),
      createAffectedService({
        reportId: report.id,
        serviceName: 'order-service',
        serviceTier: 'tier-0',
        impactType: 'dependency',
        changedFiles: ['src/payment/processor.ts'],
        sloRisk: 'medium',
        recommendedReviewers: ['user-order-lead'],
      }),
      createAffectedService({
        reportId: report.id,
        serviceName: 'notification-service',
        serviceTier: 'tier-1',
        impactType: 'indirect',
        changedFiles: ['src/payment/processor.ts'],
        sloRisk: 'low',
        recommendedReviewers: [],
      }),
    ];
    this.affectedServices.set(report.id, services);
    report.affectedServices = services.length;

    // Store affected services in repository
    if (this.affectedServiceRepository) {
      await this.affectedServiceRepository.batchCreate(services.map(s => ({
        reportId: report.id,
        serviceName: s.serviceName,
        serviceTier: s.serviceTier ?? null,
        impactType: s.impactType ?? null,
        changedFiles: s.changedFiles ?? [],
        sloRisk: s.sloRisk ?? null,
        recommendedReviewers: s.recommendedReviewers ?? [],
      })));
    }

    // Mock risk factors
    const factors: RiskFactor[] = [
      createRiskFactor({
        reportId: report.id,
        factorName: 'blast_radius',
        factorValue: 0.7,
        weight: 0.35,
        contribution: 0.25,
        description: 'Number of downstream services affected',
      }),
      createRiskFactor({
        reportId: report.id,
        factorName: 'service_tier',
        factorValue: 0.9,
        weight: 0.25,
        contribution: 0.20,
        description: 'Impact on tier-0 critical services',
      }),
      createRiskFactor({
        reportId: report.id,
        factorName: 'file_count',
        factorValue: 0.3,
        weight: 0.20,
        contribution: 0.10,
        description: 'Number of changed files',
      }),
    ];
    this.riskFactors.set(report.id, factors);

    // Store risk factors in repository
    if (this.riskFactorRepository) {
      await this.riskFactorRepository.batchCreate(factors.map(f => ({
        reportId: report.id,
        factorName: f.factorName,
        factorValue: f.factorValue,
        weight: f.weight,
        contribution: f.contribution,
        description: f.description ?? null,
      })));
    }

    // Mock historical matches
    const matches: HistoricalMatch[] = [
      createHistoricalMatch({
        reportId: report.id,
        historicalPr: 'PR-4521',
        similarity: 0.85,
        incidentLinked: true,
        incidentId: 'INC-2024-001',
      }),
      createHistoricalMatch({
        reportId: report.id,
        historicalPr: 'PR-3892',
        similarity: 0.62,
        incidentLinked: false,
      }),
    ];
    this.historicalMatches.set(report.id, matches);

    // Store historical matches in repository
    if (this.historicalMatchRepository) {
      for (const match of matches) {
        await this.historicalMatchRepository.create({
          reportId: report.id,
          historicalPr: match.historicalPr ?? null,
          similarity: match.similarity ?? null,
          incidentLinked: match.incidentLinked ?? false,
          incidentId: match.incidentId ?? null,
        });
      }
    }

    await this.eventBus?.publish('change-intelligence.analyzed', {
      reportId: report.id,
      prId: input.prId,
      riskScore,
      riskLevel: report.riskLevel,
    });

    return { report, affectedServices: services, riskFactors: factors, historicalMatches: matches };
  }

  // Report CRUD
  async getById(id: string): Promise<ChangeIntelligenceReport | undefined> {
    const cached = this.reports.get(id);
    if (cached) return cached;

    // Load from repository
    if (this.reportRepository) {
      const entity = await this.reportRepository.findById(id);
      if (entity) {
        const report: ChangeIntelligenceReport = {
          id: entity.id,
          prId: entity.prId,
          repoId: entity.repoId,
          commitSha: entity.commitSha,
          riskScore: entity.riskScore,
          riskLevel: entity.riskLevel,
          affectedServices: entity.affectedServices,
          affectedCapabilities: entity.affectedCapabilities,
          shapFactors: entity.shapFactors ?? [],
          gitlabCommentPosted: entity.gitlabCommentPosted,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        };
        this.reports.set(id, report);
        return report;
      }
    }
    return undefined;
  }

  async list(filter: ChangeIntelligenceReportListFilter = {}): Promise<ChangeIntelligenceReport[]> {
    // Use repository if available
    if (this.reportRepository) {
      let entities;
      if (filter.prId && filter.repoId) {
        entities = await this.reportRepository.findByPrRepo(filter.prId, filter.repoId);
      } else if (filter.riskLevel) {
        entities = await this.reportRepository.findByRiskLevel(filter.riskLevel);
      } else if (filter.days) {
        entities = await this.reportRepository.findRecent(filter.days);
      } else {
        const result = await this.reportRepository.findAll({ limit: 100 });
        entities = result.entities;
      }
      return entities.map(e => ({
        id: e.id,
        prId: e.prId,
        repoId: e.repoId,
        commitSha: e.commitSha,
        riskScore: e.riskScore,
        riskLevel: e.riskLevel,
        affectedServices: e.affectedServices,
        affectedCapabilities: e.affectedCapabilities,
        shapFactors: e.shapFactors ?? [],
        gitlabCommentPosted: e.gitlabCommentPosted,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
    }

    // Fallback to in-memory
    let items = Array.from(this.reports.values());
    if (filter.prId) {
      items = items.filter(r => r.prId === filter.prId);
    }
    if (filter.repoId) {
      items = items.filter(r => r.repoId === filter.repoId);
    }
    if (filter.riskLevel) {
      items = items.filter(r => r.riskLevel === filter.riskLevel);
    }
    if (filter.days) {
      const cutoff = new Date(Date.now() - filter.days * 24 * 60 * 60 * 1000);
      items = items.filter(r => r.createdAt >= cutoff);
    }
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Affected services
  async getAffectedServices(reportId: string): Promise<AffectedService[]> {
    return this.affectedServices.get(reportId) ?? [];
  }

  async addAffectedService(input: AffectedServiceCreateInput): Promise<AffectedService> {
    const service = createAffectedService(input);
    const services = this.affectedServices.get(input.reportId) ?? [];
    services.push(service);
    this.affectedServices.set(input.reportId, services);
    return service;
  }

  // Risk factors
  async getRiskFactors(reportId: string): Promise<RiskFactor[]> {
    return this.riskFactors.get(reportId) ?? [];
  }

  async addRiskFactor(input: RiskFactorCreateInput): Promise<RiskFactor> {
    const factor = createRiskFactor(input);
    const factors = this.riskFactors.get(input.reportId) ?? [];
    factors.push(factor);
    this.riskFactors.set(input.reportId, factors);
    return factor;
  }

  // Historical matches
  async getHistoricalMatches(reportId: string): Promise<HistoricalMatch[]> {
    return this.historicalMatches.get(reportId) ?? [];
  }

  async addHistoricalMatch(input: HistoricalMatchCreateInput): Promise<HistoricalMatch> {
    const match = createHistoricalMatch(input);
    const matches = this.historicalMatches.get(input.reportId) ?? [];
    matches.push(match);
    this.historicalMatches.set(input.reportId, matches);
    return match;
  }

  /**
   * Get blast radius graph data for visualization
   */
  async getBlastRadius(reportId: string): Promise<BlastRadiusResponse> {
    const services = this.affectedServices.get(reportId) ?? [];
    const report = this.reports.get(reportId);

    const nodes: BlastRadiusResponse['nodes'] = [];
    const edges: BlastRadiusResponse['edges'] = [];

    // Add PR node
    nodes.push({
      id: `pr-${reportId}`,
      label: `PR: ${report?.prId ?? 'unknown'}`,
      type: 'pr',
      risk: report?.riskScore,
    });

    for (const svc of services) {
      nodes.push({
        id: `svc-${svc.serviceName}`,
        label: svc.serviceName,
        type: 'service',
        risk: svc.sloRisk === 'high' ? 0.9 : svc.sloRisk === 'medium' ? 0.6 : 0.3,
      });

      edges.push({
        from: `pr-${reportId}`,
        to: `svc-${svc.serviceName}`,
        label: svc.impactType ?? 'direct',
      });
    }

    return { nodes, edges };
  }
}
