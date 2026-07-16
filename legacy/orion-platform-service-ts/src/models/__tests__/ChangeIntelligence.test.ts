/**
 * ChangeIntelligence 模型测试
 */
import {
  computeRiskLevel,
  createChangeIntelligenceReport,
  createAffectedService,
  createRiskFactor,
  createHistoricalMatch,
} from '../ChangeIntelligence';

describe('ChangeIntelligence', () => {
  describe('computeRiskLevel', () => {
    it('should return critical for score >= 0.8', () => {
      expect(computeRiskLevel(0.8)).toBe('critical');
      expect(computeRiskLevel(0.95)).toBe('critical');
      expect(computeRiskLevel(1.0)).toBe('critical');
    });

    it('should return high for score >= 0.6', () => {
      expect(computeRiskLevel(0.6)).toBe('high');
      expect(computeRiskLevel(0.79)).toBe('high');
    });

    it('should return medium for score >= 0.3', () => {
      expect(computeRiskLevel(0.3)).toBe('medium');
      expect(computeRiskLevel(0.59)).toBe('medium');
    });

    it('should return low for score < 0.3', () => {
      expect(computeRiskLevel(0)).toBe('low');
      expect(computeRiskLevel(0.29)).toBe('low');
    });
  });

  describe('createChangeIntelligenceReport', () => {
    it('should create report with defaults', () => {
      const report = createChangeIntelligenceReport(
        { prId: 'pr-1', repoId: 'repo-1', commitSha: 'abc123' },
        0.75,
        [{ factor: 'lines_changed', value: 500, contribution: 0.3 }]
      );

      expect(report.id).toBeDefined();
      expect(report.prId).toBe('pr-1');
      expect(report.riskScore).toBe(0.75);
      expect(report.riskLevel).toBe('high');
      expect(report.affectedServices).toBe(0);
      expect(report.affectedCapabilities).toBe(0);
      expect(report.gitlabCommentPosted).toBe(false);
    });

    it('should clamp riskScore to 0-1', () => {
      const report1 = createChangeIntelligenceReport(
        { prId: 'p', repoId: 'r', commitSha: 's' }, 1.5, []
      );
      expect(report1.riskScore).toBe(1);

      const report2 = createChangeIntelligenceReport(
        { prId: 'p', repoId: 'r', commitSha: 's' }, -0.5, []
      );
      expect(report2.riskScore).toBe(0);
    });

    it('should accept affected counts', () => {
      const report = createChangeIntelligenceReport(
        { prId: 'p', repoId: 'r', commitSha: 's' }, 0.5, [], 3, 5
      );
      expect(report.affectedServices).toBe(3);
      expect(report.affectedCapabilities).toBe(5);
    });
  });

  describe('createAffectedService', () => {
    it('should create service with defaults', () => {
      const svc = createAffectedService({
        reportId: 'report-1',
        serviceName: 'auth-svc',
      });

      expect(svc.id).toBeDefined();
      expect(svc.reportId).toBe('report-1');
      expect(svc.serviceName).toBe('auth-svc');
      expect(svc.changedFiles).toEqual([]);
      expect(svc.recommendedReviewers).toEqual([]);
    });

    it('should accept optional fields', () => {
      const svc = createAffectedService({
        reportId: 'r1',
        serviceName: 'svc',
        serviceTier: 'tier-0',
        impactType: 'direct',
        changedFiles: ['src/main.ts'],
        sloRisk: 'high',
        recommendedReviewers: ['alice'],
      });

      expect(svc.serviceTier).toBe('tier-0');
      expect(svc.impactType).toBe('direct');
      expect(svc.changedFiles).toEqual(['src/main.ts']);
      expect(svc.sloRisk).toBe('high');
    });
  });

  describe('createRiskFactor', () => {
    it('should create factor', () => {
      const factor = createRiskFactor({
        reportId: 'r1',
        factorName: 'lines_changed',
        factorValue: 500,
        weight: 0.3,
        contribution: 0.15,
      });

      expect(factor.id).toBeDefined();
      expect(factor.factorName).toBe('lines_changed');
      expect(factor.factorValue).toBe(500);
      expect(factor.weight).toBe(0.3);
      expect(factor.contribution).toBe(0.15);
    });
  });

  describe('createHistoricalMatch', () => {
    it('should create match with defaults', () => {
      const match = createHistoricalMatch({
        reportId: 'r1',
      });

      expect(match.id).toBeDefined();
      expect(match.reportId).toBe('r1');
      expect(match.incidentLinked).toBe(false);
    });

    it('should accept optional fields', () => {
      const match = createHistoricalMatch({
        reportId: 'r1',
        historicalPr: 'pr-123',
        similarity: 0.85,
        incidentLinked: true,
        incidentId: 'inc-1',
      });

      expect(match.historicalPr).toBe('pr-123');
      expect(match.similarity).toBe(0.85);
      expect(match.incidentLinked).toBe(true);
      expect(match.incidentId).toBe('inc-1');
    });
  });
});
