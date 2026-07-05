// orion-platform-service/src/services/efficiency/EfficiencyDashboardService.ts
/**
 * Efficiency Dashboard Service - 8 Scenario Templates
 * Provides comprehensive engineering efficiency insights
 *
 * Migration: Now supports PostgreSQL Repository for persistent scenario caching.
 * When db is provided, scenarios are persisted to PostgreSQL.
 */

import { createLogger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { OrionError } from '../../errors';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import {
  EfficiencyScenarioRepository,
  EfficiencyScenarioEntity,
} from '../../repositories/EfficiencyScenarioRepository';

const logger = createLogger('EfficiencyDashboardService');

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'heatmap' | 'funnel';
  title: string;
  data: unknown;
  layout?: { colSpan: number; rowSpan: number };
}

export interface EfficiencyScenario {
  id: string;
  name: string;
  description: string;
  category: 'delivery' | 'quality' | 'performance' | 'cost' | 'team' | 'incident' | 'security' | 'overview';
  widgets: DashboardWidget[];
  timeRange: TimeRange;
  summary: ScenarioSummary;
}

export interface ScenarioSummary {
  score: number;           // 0-100
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  highlights: string[];
  issues: string[];
}

export interface EfficiencyMetrics {
  // Delivery metrics
  leadTime: number;              // hours
  deploymentFrequency: number;   // per day
  changeFailureRate: number;     // percentage
  mttr: number;                  // minutes

  // Quality metrics
  codeReviewTime: number;        // hours
  bugEscapeRate: number;         // percentage
  testCoverage: number;          // percentage
  technicalDebt: number;         // hours

  // Performance metrics
  buildTime: number;             // minutes
  testExecutionTime: number;     // minutes
  pipelineSuccessRate: number;   // percentage
  apiLatencyP99: number;         // ms

  // Team metrics
  activeContributors: number;
  codeReviewParticipation: number;
  incidentResponseTime: number;
  knowledgeSharing: number;
}

// ============== Scenario Templates ==============

export class EfficiencyDashboardService {
  /** In-memory fallback cache */
  private scenarioCache: Map<string, EfficiencyScenario> = new Map();
  /** PostgreSQL repository for persistent caching */
  private scenarioRepo: EfficiencyScenarioRepository | null;
  private tenantId: string;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }, tenantId?: string) {
    this.scenarioRepo = db ? new EfficiencyScenarioRepository(db) : null;
    this.tenantId = tenantId || getCurrentTenantId();
    logger.info('[EfficiencyDashboard] Initialized');
  }

  /**
   * Get scenario dashboard by ID
   */
  async getScenario(
    scenarioId: string,
    timeRange: TimeRange
  ): Promise<EfficiencyScenario> {
    const cacheKey = `${scenarioId}-${timeRange.start.getTime()}-${timeRange.end.getTime()}`;

    // Try PostgreSQL cache first
    if (this.scenarioRepo) {
      try {
        const cached = await this.scenarioRepo.findByCacheKey(cacheKey);
        if (cached) {
          return this.entityToScenario(cached);
        }
      } catch {
        // Fall back to in-memory
      }
    }

    // Try in-memory cache
    const memCached = this.scenarioCache.get(cacheKey);
    if (memCached) return memCached;

    let scenario: EfficiencyScenario;

    switch (scenarioId) {
      case 'delivery-speed':
        scenario = await this.buildDeliverySpeedScenario(timeRange);
        break;
      case 'release-quality':
        scenario = await this.buildReleaseQualityScenario(timeRange);
        break;
      case 'pipeline-performance':
        scenario = await this.buildPipelinePerformanceScenario(timeRange);
        break;
      case 'incident-response':
        scenario = await this.buildIncidentResponseScenario(timeRange);
        break;
      case 'cost-optimization':
        scenario = await this.buildCostOptimizationScenario(timeRange);
        break;
      case 'team-productivity':
        scenario = await this.buildTeamProductivityScenario(timeRange);
        break;
      case 'security-compliance':
        scenario = await this.buildSecurityComplianceScenario(timeRange);
        break;
      case 'overview':
        scenario = await this.buildOverviewScenario(timeRange);
        break;
      default:
        throw new OrionError(`Unknown scenario: ${scenarioId}`, 'NOT_FOUND')
    }

    // Cache in PostgreSQL
    if (this.scenarioRepo) {
      try {
        await this.scenarioRepo.create({
          id: uuidv4(),
          tenantId: this.tenantId,
          scenarioId,
          name: scenario.name,
          description: scenario.description,
          category: scenario.category,
          widgets: scenario.widgets,
          timeRange: scenario.timeRange,
          summary: scenario.summary,
          cacheKey,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        });
      } catch {
        // Ignore persistence failure
      }
    }

    // Also cache in memory
    this.scenarioCache.set(cacheKey, scenario);
    return scenario;
  }

  /**
   * Scenario 1: Delivery Speed - 交付速度
   */
  private async buildDeliverySpeedScenario(timeRange: TimeRange): Promise<EfficiencyScenario> {
    const metrics = await this.getSampleMetrics(timeRange);

    const widgets: DashboardWidget[] = [
      {
        id: 'lead-time',
        type: 'metric',
        title: 'Lead Time (hours)',
        data: {
          value: metrics.leadTime,
          unit: 'hours',
          target: 24,
          trend: 'down',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'deploy-freq',
        type: 'metric',
        title: 'Deployment Frequency',
        data: {
          value: metrics.deploymentFrequency,
          unit: 'deploys/day',
          target: 10,
          trend: 'up',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'lead-time-trend',
        type: 'chart',
        title: 'Lead Time Trend',
        data: this.generateTrendData(timeRange, 'leadTime', 'hours'),
        layout: { colSpan: 6, rowSpan: 2 },
      },
      {
        id: 'deploy-breakdown',
        type: 'funnel',
        title: 'Deploy Pipeline',
        data: {
          stages: [
            { name: 'Commit', count: 150, rate: 100 },
            { name: 'Build', count: 145, rate: 96 },
            { name: 'Test', count: 138, rate: 92 },
            { name: 'Staging', count: 130, rate: 87 },
            { name: 'Production', count: 125, rate: 83 },
          ],
        },
        layout: { colSpan: 6, rowSpan: 2 },
      },
      {
        id: 'time-breakdown',
        type: 'chart',
        title: 'Time Breakdown',
        data: {
          labels: ['Coding', 'Code Review', 'Testing', 'Staging', 'Waiting'],
          values: [4, 8, 6, 4, 2],
        },
        layout: { colSpan: 6, rowSpan: 2 },
      },
    ];

    const score = this.calculateScore(metrics.leadTime, 24, 'lower') * 0.4 +
                  this.calculateScore(metrics.deploymentFrequency, 10, 'higher') * 0.4 +
                  this.calculateScore(metrics.changeFailureRate, 15, 'lower') * 0.2;

    return {
      id: 'delivery-speed',
      name: 'Delivery Speed',
      description: 'Track lead time and deployment frequency',
      category: 'delivery',
      widgets,
      timeRange,
      summary: {
        score: Math.round(score),
        trend: 'up',
        changePercent: 12,
        highlights: [
          `Lead time improved by 15%`,
          `${metrics.deploymentFrequency} deployments/day`,
        ],
        issues: metrics.leadTime > 24 ? ['Lead time exceeds target'] : [],
      },
    };
  }

  /**
   * Scenario 2: Release Quality - 发布质量
   */
  private async buildReleaseQualityScenario(timeRange: TimeRange): Promise<EfficiencyScenario> {
    const metrics = await this.getSampleMetrics(timeRange);

    const widgets: DashboardWidget[] = [
      {
        id: 'change-failure-rate',
        type: 'metric',
        title: 'Change Failure Rate',
        data: {
          value: metrics.changeFailureRate,
          unit: '%',
          target: 15,
          trend: 'down',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'test-coverage',
        type: 'metric',
        title: 'Test Coverage',
        data: {
          value: metrics.testCoverage,
          unit: '%',
          target: 80,
          trend: 'up',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'bug-escape',
        type: 'metric',
        title: 'Bug Escape Rate',
        data: {
          value: metrics.bugEscapeRate,
          unit: '%',
          target: 5,
          trend: 'down',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'quality-trend',
        type: 'chart',
        title: 'Quality Metrics Trend',
        data: this.generateTrendData(timeRange, 'quality'),
        layout: { colSpan: 9, rowSpan: 2 },
      },
      {
        id: 'defect-density',
        type: 'chart',
        title: 'Defect Density by Component',
        data: {
          labels: ['API', ' Frontend', 'Database', 'Worker', 'Admin'],
          values: [2.1, 3.5, 1.2, 1.8, 0.8],
        },
        layout: { colSpan: 6, rowSpan: 2 },
      },
    ];

    const score = this.calculateScore(metrics.changeFailureRate, 15, 'lower') * 0.35 +
                  this.calculateScore(metrics.testCoverage, 80, 'higher') * 0.35 +
                  this.calculateScore(metrics.bugEscapeRate, 5, 'lower') * 0.3;

    return {
      id: 'release-quality',
      name: 'Release Quality',
      description: 'Monitor release quality and test coverage',
      category: 'quality',
      widgets,
      timeRange,
      summary: {
        score: Math.round(score),
        trend: 'up',
        changePercent: 8,
        highlights: [
          `Test coverage: ${metrics.testCoverage}%`,
          `Bug escape: ${metrics.bugEscapeRate}%`,
        ],
        issues: metrics.testCoverage < 80 ? ['Test coverage below target'] : [],
      },
    };
  }

  /**
   * Scenario 3: Pipeline Performance - 流水线性能
   */
  private async buildPipelinePerformanceScenario(timeRange: TimeRange): Promise<EfficiencyScenario> {
    const metrics = await this.getSampleMetrics(timeRange);

    const widgets: DashboardWidget[] = [
      {
        id: 'build-time',
        type: 'metric',
        title: 'Build Time',
        data: {
          value: metrics.buildTime,
          unit: 'min',
          target: 15,
          trend: 'down',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'test-time',
        type: 'metric',
        title: 'Test Execution Time',
        data: {
          value: metrics.testExecutionTime,
          unit: 'min',
          target: 30,
          trend: 'down',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'pipeline-success',
        type: 'metric',
        title: 'Pipeline Success Rate',
        data: {
          value: metrics.pipelineSuccessRate,
          unit: '%',
          target: 90,
          trend: 'up',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'pipeline-stage',
        type: 'chart',
        title: 'Pipeline Stage Duration',
        data: {
          labels: ['Checkout', 'Install', 'Lint', 'Test', 'Build', 'Deploy'],
          values: [30, 120, 45, 300, 180, 120],
        },
        layout: { colSpan: 9, rowSpan: 2 },
      },
      {
        id: 'bottlenecks',
        type: 'table',
        title: 'Top Bottlenecks',
        data: {
          columns: ['Stage', 'Avg Duration', 'P95 Duration', 'Failure Rate'],
          rows: [
            ['Unit Tests', '5m', '8m', '2%'],
            ['Integration Tests', '12m', '20m', '5%'],
            ['Build', '3m', '5m', '1%'],
          ],
        },
        layout: { colSpan: 6, rowSpan: 2 },
      },
    ];

    const score = this.calculateScore(metrics.buildTime, 15, 'lower') * 0.3 +
                  this.calculateScore(metrics.testExecutionTime, 30, 'lower') * 0.3 +
                  this.calculateScore(metrics.pipelineSuccessRate, 90, 'higher') * 0.4;

    return {
      id: 'pipeline-performance',
      name: 'Pipeline Performance',
      description: 'Analyze CI/CD pipeline efficiency',
      category: 'performance',
      widgets,
      timeRange,
      summary: {
        score: Math.round(score),
        trend: 'stable',
        changePercent: 2,
        highlights: [`Success rate: ${metrics.pipelineSuccessRate}%`],
        issues: metrics.buildTime > 15 ? ['Build time exceeds target'] : [],
      },
    };
  }

  /**
   * Scenario 4: Incident Response - 事件响应
   */
  private async buildIncidentResponseScenario(timeRange: TimeRange): Promise<EfficiencyScenario> {
    const metrics = await this.getSampleMetrics(timeRange);

    const widgets: DashboardWidget[] = [
      {
        id: 'mttr',
        type: 'metric',
        title: 'MTTR',
        data: {
          value: metrics.mttr,
          unit: 'min',
          target: 60,
          trend: 'down',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'incident-volume',
        type: 'metric',
        title: 'Incident Volume',
        data: {
          value: 24,
          unit: 'incidents',
          target: 20,
          trend: 'down',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'incident-trend',
        type: 'chart',
        title: 'Incident Trend',
        data: this.generateTrendData(timeRange, 'incidents'),
        layout: { colSpan: 9, rowSpan: 2 },
      },
      {
        id: 'mttr-breakdown',
        type: 'chart',
        title: 'MTTR Breakdown',
        data: {
          labels: ['Detection', 'Triage', 'Mitigation', 'Resolution', 'Post-mortem'],
          values: [5, 10, 15, 20, 10],
        },
        layout: { colSpan: 6, rowSpan: 2 },
      },
    ];

    const score = this.calculateScore(metrics.mttr, 60, 'lower') * 0.6 +
                  this.calculateScore(24, 20, 'lower') * 0.4;

    return {
      id: 'incident-response',
      name: 'Incident Response',
      description: 'Track incident response and resolution',
      category: 'incident',
      widgets,
      timeRange,
      summary: {
        score: Math.round(score),
        trend: 'up',
        changePercent: 15,
        highlights: [`MTTR: ${metrics.mttr} minutes`],
        issues: metrics.mttr > 60 ? ['MTTR exceeds target'] : [],
      },
    };
  }

  /**
   * Scenario 5: Cost Optimization - 成本优化
   */
  private async buildCostOptimizationScenario(timeRange: TimeRange): Promise<EfficiencyScenario> {
    const widgets: DashboardWidget[] = [
      {
        id: 'cloud-cost',
        type: 'metric',
        title: 'Cloud Cost',
        data: {
          value: 45000,
          unit: 'USD',
          trend: 'down',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'cost-per-deploy',
        type: 'metric',
        title: 'Cost per Deployment',
        data: {
          value: 12.5,
          unit: 'USD',
          trend: 'down',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'cost-trend',
        type: 'chart',
        title: 'Cost Trend',
        data: this.generateTrendData(timeRange, 'cost'),
        layout: { colSpan: 9, rowSpan: 2 },
      },
      {
        id: 'cost-breakdown',
        type: 'chart',
        title: 'Cost by Service',
        data: {
          labels: ['API', 'Worker', 'Database', 'Cache', 'Storage'],
          values: [35, 25, 20, 12, 8],
        },
        layout: { colSpan: 6, rowSpan: 2 },
      },
    ];

    return {
      id: 'cost-optimization',
      name: 'Cost Optimization',
      description: 'Track and optimize infrastructure costs',
      category: 'cost',
      widgets,
      timeRange,
      summary: {
        score: 78,
        trend: 'up',
        changePercent: 10,
        highlights: ['Cost reduced by 10%'],
        issues: [],
      },
    };
  }

  /**
   * Scenario 6: Team Productivity - 团队效能
   */
  private async buildTeamProductivityScenario(timeRange: TimeRange): Promise<EfficiencyScenario> {
    const metrics = await this.getSampleMetrics(timeRange);

    const widgets: DashboardWidget[] = [
      {
        id: 'contributors',
        type: 'metric',
        title: 'Active Contributors',
        data: {
          value: metrics.activeContributors,
          unit: 'engineers',
          trend: 'up',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'review-participation',
        type: 'metric',
        title: 'Code Review Participation',
        data: {
          value: metrics.codeReviewParticipation,
          unit: '%',
          target: 80,
          trend: 'up',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'contribution-heatmap',
        type: 'heatmap',
        title: 'Contribution Heatmap',
        data: this.generateHeatmapData(),
        layout: { colSpan: 9, rowSpan: 3 },
      },
    ];

    const score = this.calculateScore(metrics.codeReviewParticipation, 80, 'higher') * 0.5 +
                  this.calculateScore(metrics.knowledgeSharing, 70, 'higher') * 0.5;

    return {
      id: 'team-productivity',
      name: 'Team Productivity',
      description: 'Monitor team collaboration and productivity',
      category: 'team',
      widgets,
      timeRange,
      summary: {
        score: Math.round(score),
        trend: 'stable',
        changePercent: 5,
        highlights: [`${metrics.activeContributors} active contributors`],
        issues: [],
      },
    };
  }

  /**
   * Scenario 7: Security Compliance - 安全合规
   */
  private async buildSecurityComplianceScenario(timeRange: TimeRange): Promise<EfficiencyScenario> {
    const widgets: DashboardWidget[] = [
      {
        id: 'vulnerabilities',
        type: 'metric',
        title: 'Open Vulnerabilities',
        data: {
          value: 12,
          unit: 'issues',
          target: 10,
          trend: 'down',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'security-score',
        type: 'metric',
        title: 'Security Score',
        data: {
          value: 92,
          unit: '/100',
          target: 90,
          trend: 'up',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'vuln-trend',
        type: 'chart',
        title: 'Vulnerability Trend',
        data: this.generateTrendData(timeRange, 'vulnerabilities'),
        layout: { colSpan: 9, rowSpan: 2 },
      },
      {
        id: 'vuln-severity',
        type: 'chart',
        title: 'By Severity',
        data: {
          labels: ['Critical', 'High', 'Medium', 'Low'],
          values: [2, 4, 4, 2],
        },
        layout: { colSpan: 6, rowSpan: 2 },
      },
    ];

    return {
      id: 'security-compliance',
      name: 'Security & Compliance',
      description: 'Track security vulnerabilities and compliance',
      category: 'security',
      widgets,
      timeRange,
      summary: {
        score: 92,
        trend: 'up',
        changePercent: 5,
        highlights: ['Security score improved'],
        issues: [],
      },
    };
  }

  /**
   * Scenario 8: Overview - 综合概览
   */
  private async buildOverviewScenario(timeRange: TimeRange): Promise<EfficiencyScenario> {
    const scenarios = await Promise.all([
      this.getScenario('delivery-speed', timeRange),
      this.getScenario('release-quality', timeRange),
      this.getScenario('pipeline-performance', timeRange),
      this.getScenario('incident-response', timeRange),
    ]);

    const avgScore = scenarios.reduce((sum, s) => sum + s.summary.score, 0) / scenarios.length;

    const widgets: DashboardWidget[] = [
      {
        id: 'overall-score',
        type: 'metric',
        title: 'Overall Score',
        data: {
          value: Math.round(avgScore),
          unit: '/100',
          trend: 'up',
        },
        layout: { colSpan: 3, rowSpan: 1 },
      },
      {
        id: 'score-breakdown',
        type: 'chart',
        title: 'Score by Category',
        data: {
          labels: scenarios.map(s => s.name),
          values: scenarios.map(s => s.summary.score),
        },
        layout: { colSpan: 9, rowSpan: 2 },
      },
    ];

    return {
      id: 'overview',
      name: 'Efficiency Overview',
      description: 'Overall engineering efficiency summary',
      category: 'overview',
      widgets,
      timeRange,
      summary: {
        score: Math.round(avgScore),
        trend: 'up',
        changePercent: 8,
        highlights: scenarios.flatMap(s => s.summary.highlights),
        issues: scenarios.flatMap(s => s.summary.issues),
      },
    };
  }

  // ============== Utility Methods ==============

  private async getSampleMetrics(_timeRange: TimeRange): Promise<EfficiencyMetrics> {
    return {
      leadTime: 18,
      deploymentFrequency: 8,
      changeFailureRate: 12,
      mttr: 45,
      codeReviewTime: 6,
      bugEscapeRate: 4,
      testCoverage: 75,
      technicalDebt: 120,
      buildTime: 12,
      testExecutionTime: 25,
      pipelineSuccessRate: 92,
      apiLatencyP99: 150,
      activeContributors: 15,
      codeReviewParticipation: 85,
      incidentResponseTime: 30,
      knowledgeSharing: 65,
    };
  }

  private calculateScore(value: number, target: number, direction: 'higher' | 'lower'): number {
    if (direction === 'higher') {
      return Math.min(100, (value / target) * 100);
    } else {
      return Math.min(100, (target / value) * 100);
    }
  }

  private generateTrendData(_timeRange: TimeRange, _metric: string, _unit?: string): unknown {
    return {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      values: [65, 72, 68, 78],
    };
  }

  private generateHeatmapData(): unknown {
    return {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      hours: Array.from({ length: 12 }, (_, i) => i + 8),
      data: Array.from({ length: 60 }, () => Math.floor(Math.random() * 10)),
    };
  }

  /**
   * Convert repository entity to domain scenario
   */
  private entityToScenario(entity: EfficiencyScenarioEntity): EfficiencyScenario {
    return {
      id: entity.scenarioId,
      name: entity.name,
      description: entity.description,
      category: entity.category as EfficiencyScenario['category'],
      widgets: entity.widgets,
      timeRange: entity.timeRange,
      summary: entity.summary,
    };
  }

  /**
   * Get all available scenarios
   */
  getAvailableScenarios(): { id: string; name: string; category: string }[] {
    return [
      { id: 'delivery-speed', name: 'Delivery Speed', category: 'delivery' },
      { id: 'release-quality', name: 'Release Quality', category: 'quality' },
      { id: 'pipeline-performance', name: 'Pipeline Performance', category: 'performance' },
      { id: 'incident-response', name: 'Incident Response', category: 'incident' },
      { id: 'cost-optimization', name: 'Cost Optimization', category: 'cost' },
      { id: 'team-productivity', name: 'Team Productivity', category: 'team' },
      { id: 'security-compliance', name: 'Security & Compliance', category: 'security' },
      { id: 'overview', name: 'Overview', category: 'overview' },
    ];
  }
}

export default EfficiencyDashboardService;
