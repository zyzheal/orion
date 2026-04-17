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

  constructor(options?: { eventBus?: EventBusService }) {
    this.eventBus = options?.eventBus;
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
    return this.reports.get(id);
  }

  async list(filter: ChangeIntelligenceReportListFilter = {}): Promise<ChangeIntelligenceReport[]> {
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
