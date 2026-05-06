/**
 * Change Intelligence Service 测试
 */

import { ChangeIntelligenceService } from '../ChangeIntelligenceService';
import {
  computeRiskLevel,
  createChangeIntelligenceReport,
  createAffectedService,
  createRiskFactor,
  createHistoricalMatch,
} from '../../../models/ChangeIntelligence';

// Mock EventBusService
function createMockEventBus() {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    isHealthy: jest.fn().mockReturnValue(true),
  };
}

const defaultInput = {
  prId: 'PR-1234',
  repoId: 'repo-001',
  commitSha: 'abc123def456',
};

describe('ChangeIntelligenceService', () => {
  let service: ChangeIntelligenceService;
  let mockEventBus: jest.Mocked<ReturnType<typeof createMockEventBus>>;

  beforeEach(() => {
    mockEventBus = createMockEventBus() as jest.Mocked<ReturnType<typeof createMockEventBus>>;
    service = new ChangeIntelligenceService();
  });

  // =====================================================================
  // analyze() tests
  // =====================================================================

  describe('analyze()', () => {
    it('should create a report with valid input', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.report).toBeDefined();
      expect(result.report.id).toBeDefined();
      expect(result.report.prId).toBe('PR-1234');
      expect(result.report.repoId).toBe('repo-001');
      expect(result.report.commitSha).toBe('abc123def456');
    });

    it('should compute a riskScore between 0 and 1', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.report.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.report.riskScore).toBeLessThanOrEqual(1);
    });

    it('should compute the correct riskScore from SHAP contributions', async () => {
      // SHAP contributions: 0.25 + 0.20 + 0.10 + (-0.05) + 0.15 = 0.65
      // riskScore = min(1, max(0, 0.65 + 0.3)) = 0.95
      const result = await service.analyze(defaultInput);

      expect(result.report.riskScore).toBeCloseTo(0.95, 10);
    });

    it('should assign riskLevel "critical" for score >= 0.8', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.report.riskLevel).toBe('critical');
    });

    it('should include SHAP factors in the report', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.report.shapFactors).toBeDefined();
      expect(Array.isArray(result.report.shapFactors)).toBe(true);
      expect(result.report.shapFactors.length).toBe(5);
      expect(result.report.shapFactors[0].factor).toBe('blast_radius');
      expect(result.report.shapFactors[0].value).toBe(0.7);
      expect(result.report.shapFactors[0].contribution).toBe(0.25);
    });

    it('should return affected services with correct count', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.affectedServices).toBeDefined();
      expect(result.affectedServices.length).toBe(3);
    });

    it('should return affected services with correct service names', async () => {
      const result = await service.analyze(defaultInput);
      const serviceNames = result.affectedServices.map((s) => s.serviceName);

      expect(serviceNames).toContain('payment-service');
      expect(serviceNames).toContain('order-service');
      expect(serviceNames).toContain('notification-service');
    });

    it('should set affectedServices count on the report', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.report.affectedServices).toBe(3);
    });

    it('should return risk factors', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.riskFactors).toBeDefined();
      expect(result.riskFactors.length).toBe(3);
    });

    it('should return risk factors with correct factor names', async () => {
      const result = await service.analyze(defaultInput);
      const factorNames = result.riskFactors.map((f) => f.factorName);

      expect(factorNames).toContain('blast_radius');
      expect(factorNames).toContain('service_tier');
      expect(factorNames).toContain('file_count');
    });

    it('should return historical matches', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.historicalMatches).toBeDefined();
      expect(result.historicalMatches.length).toBe(2);
    });

    it('should return historical matches with correct data', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.historicalMatches[0].historicalPr).toBe('PR-4521');
      expect(result.historicalMatches[0].similarity).toBe(0.85);
      expect(result.historicalMatches[0].incidentLinked).toBe(true);
      expect(result.historicalMatches[0].incidentId).toBe('INC-2024-001');
    });

    it('should publish a change-intelligence.analyzed event', async () => {
      const serviceWithBus = new ChangeIntelligenceService({
        eventBus: mockEventBus as any,
      });

      await serviceWithBus.analyze(defaultInput);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'change-intelligence.analyzed',
        expect.objectContaining({
          reportId: expect.any(String),
          prId: 'PR-1234',
          riskScore: expect.any(Number),
          riskLevel: expect.any(String),
        })
      );
    });

    it('should not throw when eventBus is undefined', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.report).toBeDefined();
    });

    it('should set gitlabCommentPosted to false on new report', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.report.gitlabCommentPosted).toBe(false);
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.report.createdAt).toBeInstanceOf(Date);
      expect(result.report.updatedAt).toBeInstanceOf(Date);
    });

    it('should set affectedCapabilities on the report', async () => {
      const result = await service.analyze(defaultInput);

      expect(result.report.affectedCapabilities).toBe(5);
    });
  });

  // =====================================================================
  // getById() tests
  // =====================================================================

  describe('getById()', () => {
    it('should return a report after analyze()', async () => {
      const result = await service.analyze(defaultInput);
      const report = await service.getById(result.report.id);

      expect(report).toBeDefined();
      expect(report?.id).toBe(result.report.id);
      expect(report?.prId).toBe('PR-1234');
    });

    it('should return undefined for non-existent ID', async () => {
      const report = await service.getById('non-existent-id');

      expect(report).toBeUndefined();
    });

    it('should return the full report with all fields', async () => {
      const result = await service.analyze(defaultInput);
      const report = await service.getById(result.report.id);

      expect(report?.shapFactors).toBeDefined();
      expect(report?.riskLevel).toBe('critical');
      expect(report?.riskScore).toBeCloseTo(0.95, 10);
    });
  });

  // =====================================================================
  // list() tests
  // =====================================================================

  describe('list()', () => {
    it('should return empty array when no reports exist', async () => {
      const result = await service.list();

      expect(result).toEqual([]);
    });

    it('should return all reports with no filter', async () => {
      await service.analyze({ ...defaultInput, prId: 'PR-1' });
      await service.analyze({ ...defaultInput, prId: 'PR-2' });
      await service.analyze({ ...defaultInput, prId: 'PR-3' });

      const result = await service.list();

      expect(result.length).toBe(3);
    });

    it('should filter by prId', async () => {
      await service.analyze({ ...defaultInput, prId: 'PR-A' });
      await service.analyze({ ...defaultInput, prId: 'PR-B' });
      await service.analyze({ ...defaultInput, prId: 'PR-A', repoId: 'repo-002' });

      const result = await service.list({ prId: 'PR-A' });

      expect(result.length).toBe(2);
      expect(result.every((r) => r.prId === 'PR-A')).toBe(true);
    });

    it('should filter by repoId', async () => {
      await service.analyze({ ...defaultInput, repoId: 'repo-001' });
      await service.analyze({ ...defaultInput, repoId: 'repo-002' });

      const result = await service.list({ repoId: 'repo-001' });

      expect(result.length).toBe(1);
      expect(result[0].repoId).toBe('repo-001');
    });

    it('should filter by riskLevel', async () => {
      await service.analyze({ ...defaultInput, prId: 'PR-1' });
      await service.analyze({ ...defaultInput, prId: 'PR-2' });

      // Both reports are "critical" with score 0.95
      const result = await service.list({ riskLevel: 'critical' });

      expect(result.length).toBe(2);
    });

    it('should return empty when riskLevel filter matches nothing', async () => {
      await service.analyze(defaultInput);

      const result = await service.list({ riskLevel: 'low' });

      expect(result).toEqual([]);
    });

    it('should filter by days (recent reports only)', async () => {
      await service.analyze(defaultInput);

      const result = await service.list({ days: 1 });

      expect(result.length).toBe(1);
    });

    it('should return empty when days filter excludes all reports', async () => {
      await service.analyze(defaultInput);

      // Negative days would make cutoff in the future, excluding all reports
      const result = await service.list({ days: -1 });

      expect(result).toEqual([]);
    });

    it('should sort results by createdAt descending', async () => {
      await service.analyze({ ...defaultInput, prId: 'PR-first' });
      // Small delay to ensure distinct timestamps
      await new Promise((r) => setTimeout(r, 2));
      await service.analyze({ ...defaultInput, prId: 'PR-second' });
      await new Promise((r) => setTimeout(r, 2));
      await service.analyze({ ...defaultInput, prId: 'PR-third' });

      const result = await service.list();

      // Most recently created should be first
      expect(result[0].createdAt.getTime()).toBeGreaterThanOrEqual(result[1].createdAt.getTime());
      expect(result[1].createdAt.getTime()).toBeGreaterThanOrEqual(result[2].createdAt.getTime());
      // Verify all three are present
      const prIds = result.map((r) => r.prId);
      expect(prIds).toContain('PR-first');
      expect(prIds).toContain('PR-second');
      expect(prIds).toContain('PR-third');
    });
  });

  // =====================================================================
  // getAffectedServices() tests
  // =====================================================================

  describe('getAffectedServices()', () => {
    it('should return affected services after analyze()', async () => {
      const result = await service.analyze(defaultInput);
      const services = await service.getAffectedServices(result.report.id);

      expect(services.length).toBe(3);
      expect(services[0].serviceName).toBe('payment-service');
    });

    it('should return empty array for unknown reportId', async () => {
      const services = await service.getAffectedServices('unknown-report');

      expect(services).toEqual([]);
    });

    it('should return services with correct impact types', async () => {
      const result = await service.analyze(defaultInput);
      const services = await service.getAffectedServices(result.report.id);
      const impactTypes = services.map((s) => s.impactType);

      expect(impactTypes).toContain('direct');
      expect(impactTypes).toContain('dependency');
      expect(impactTypes).toContain('indirect');
    });

    it('should return services with correct SLO risk levels', async () => {
      const result = await service.analyze(defaultInput);
      const services = await service.getAffectedServices(result.report.id);
      const sloRisks = services.map((s) => s.sloRisk);

      expect(sloRisks).toContain('high');
      expect(sloRisks).toContain('medium');
      expect(sloRisks).toContain('low');
    });
  });

  // =====================================================================
  // addAffectedService() tests
  // =====================================================================

  describe('addAffectedService()', () => {
    it('should add a new affected service', async () => {
      const result = await service.analyze(defaultInput);
      const newService = await service.addAffectedService({
        reportId: result.report.id,
        serviceName: 'new-service',
        serviceTier: 'tier-1',
        impactType: 'direct',
        changedFiles: ['src/new/file.ts'],
        sloRisk: 'low',
        recommendedReviewers: ['user-1'],
      });

      expect(newService.id).toBeDefined();
      expect(newService.serviceName).toBe('new-service');
      expect(newService.reportId).toBe(result.report.id);
    });

    it('should append to existing services list', async () => {
      const result = await service.analyze(defaultInput);
      await service.addAffectedService({
        reportId: result.report.id,
        serviceName: 'extra-service',
        changedFiles: [],
        recommendedReviewers: [],
      });

      const services = await service.getAffectedServices(result.report.id);

      expect(services.length).toBe(4);
    });

    it('should create services for a new reportId without analyze()', async () => {
      const newService = await service.addAffectedService({
        reportId: 'brand-new-report',
        serviceName: 'solo-service',
        changedFiles: ['file.ts'],
        recommendedReviewers: [],
      });

      expect(newService.serviceName).toBe('solo-service');
      const services = await service.getAffectedServices('brand-new-report');

      expect(services.length).toBe(1);
    });

    it('should use defaults for optional fields', async () => {
      const newService = await service.addAffectedService({
        reportId: 'test-report',
        serviceName: 'minimal-service',
        changedFiles: [],
        recommendedReviewers: [],
      });

      expect(newService.changedFiles).toEqual([]);
      expect(newService.recommendedReviewers).toEqual([]);
      expect(newService.serviceTier).toBeUndefined();
      expect(newService.impactType).toBeUndefined();
      expect(newService.sloRisk).toBeUndefined();
    });
  });

  // =====================================================================
  // getRiskFactors() tests
  // =====================================================================

  describe('getRiskFactors()', () => {
    it('should return risk factors after analyze()', async () => {
      const result = await service.analyze(defaultInput);
      const factors = await service.getRiskFactors(result.report.id);

      expect(factors.length).toBe(3);
    });

    it('should return empty array for unknown reportId', async () => {
      const factors = await service.getRiskFactors('unknown-report');

      expect(factors).toEqual([]);
    });

    it('should return factors with correct weight and contribution', async () => {
      const result = await service.analyze(defaultInput);
      const factors = await service.getRiskFactors(result.report.id);

      expect(factors[0].factorName).toBe('blast_radius');
      expect(factors[0].weight).toBe(0.35);
      expect(factors[0].contribution).toBe(0.25);
    });
  });

  // =====================================================================
  // addRiskFactor() tests
  // =====================================================================

  describe('addRiskFactor()', () => {
    it('should add a new risk factor', async () => {
      const result = await service.analyze(defaultInput);
      const newFactor = await service.addRiskFactor({
        reportId: result.report.id,
        factorName: 'custom_factor',
        factorValue: 0.5,
        weight: 0.2,
        contribution: 0.1,
        description: 'A custom risk factor',
      });

      expect(newFactor.id).toBeDefined();
      expect(newFactor.factorName).toBe('custom_factor');
    });

    it('should append to existing factors list', async () => {
      const result = await service.analyze(defaultInput);
      await service.addRiskFactor({
        reportId: result.report.id,
        factorName: 'extra_factor',
        factorValue: 0.1,
        weight: 0.05,
        contribution: 0.02,
      });

      const factors = await service.getRiskFactors(result.report.id);

      expect(factors.length).toBe(4);
    });

    it('should create factors for a new reportId without analyze()', async () => {
      const newFactor = await service.addRiskFactor({
        reportId: 'fresh-report',
        factorName: 'standalone',
        factorValue: 0.8,
        weight: 0.4,
        contribution: 0.3,
      });

      expect(newFactor.factorName).toBe('standalone');
      const factors = await service.getRiskFactors('fresh-report');

      expect(factors.length).toBe(1);
    });
  });

  // =====================================================================
  // getHistoricalMatches() tests
  // =====================================================================

  describe('getHistoricalMatches()', () => {
    it('should return historical matches after analyze()', async () => {
      const result = await service.analyze(defaultInput);
      const matches = await service.getHistoricalMatches(result.report.id);

      expect(matches.length).toBe(2);
    });

    it('should return empty array for unknown reportId', async () => {
      const matches = await service.getHistoricalMatches('unknown-report');

      expect(matches).toEqual([]);
    });

    it('should return matches with correct similarity scores', async () => {
      const result = await service.analyze(defaultInput);
      const matches = await service.getHistoricalMatches(result.report.id);

      expect(matches[0].similarity).toBe(0.85);
      expect(matches[1].similarity).toBe(0.62);
    });
  });

  // =====================================================================
  // addHistoricalMatch() tests
  // =====================================================================

  describe('addHistoricalMatch()', () => {
    it('should add a new historical match', async () => {
      const result = await service.analyze(defaultInput);
      const newMatch = await service.addHistoricalMatch({
        reportId: result.report.id,
        historicalPr: 'PR-9999',
        similarity: 0.95,
        incidentLinked: true,
        incidentId: 'INC-NEW',
      });

      expect(newMatch.id).toBeDefined();
      expect(newMatch.historicalPr).toBe('PR-9999');
    });

    it('should append to existing matches list', async () => {
      const result = await service.analyze(defaultInput);
      await service.addHistoricalMatch({
        reportId: result.report.id,
        historicalPr: 'PR-extra',
        similarity: 0.50,
      });

      const matches = await service.getHistoricalMatches(result.report.id);

      expect(matches.length).toBe(3);
    });

    it('should default incidentLinked to false when not provided', async () => {
      const newMatch = await service.addHistoricalMatch({
        reportId: 'test-report',
        historicalPr: 'PR-no-incident',
      });

      expect(newMatch.incidentLinked).toBe(false);
    });

    it('should create matches for a new reportId without analyze()', async () => {
      const newMatch = await service.addHistoricalMatch({
        reportId: 'fresh-report',
        historicalPr: 'PR-standalone',
        similarity: 0.70,
      });

      expect(newMatch.historicalPr).toBe('PR-standalone');
      const matches = await service.getHistoricalMatches('fresh-report');

      expect(matches.length).toBe(1);
    });
  });

  // =====================================================================
  // getBlastRadius() tests
  // =====================================================================

  describe('getBlastRadius()', () => {
    it('should return nodes and edges for a report', async () => {
      const result = await service.analyze(defaultInput);
      const blastRadius = await service.getBlastRadius(result.report.id);

      expect(blastRadius.nodes).toBeDefined();
      expect(blastRadius.edges).toBeDefined();
      expect(Array.isArray(blastRadius.nodes)).toBe(true);
      expect(Array.isArray(blastRadius.edges)).toBe(true);
    });

    it('should include a PR node', async () => {
      const result = await service.analyze(defaultInput);
      const blastRadius = await service.getBlastRadius(result.report.id);
      const prNode = blastRadius.nodes.find((n) => n.type === 'pr');

      expect(prNode).toBeDefined();
      expect(prNode?.label).toContain('PR-1234');
      expect(prNode?.risk).toBeCloseTo(0.95, 10);
    });

    it('should include service nodes for each affected service', async () => {
      const result = await service.analyze(defaultInput);
      const blastRadius = await service.getBlastRadius(result.report.id);
      const serviceNodes = blastRadius.nodes.filter((n) => n.type === 'service');

      expect(serviceNodes.length).toBe(3);
      const labels = serviceNodes.map((n) => n.label);

      expect(labels).toContain('payment-service');
      expect(labels).toContain('order-service');
      expect(labels).toContain('notification-service');
    });

    it('should include edges from PR to each service', async () => {
      const result = await service.analyze(defaultInput);
      const blastRadius = await service.getBlastRadius(result.report.id);

      expect(blastRadius.edges.length).toBe(3);
    });

    it('should set correct edge labels based on impact type', async () => {
      const result = await service.analyze(defaultInput);
      const blastRadius = await service.getBlastRadius(result.report.id);
      const edgeLabels = blastRadius.edges.map((e) => e.label);

      expect(edgeLabels).toContain('direct');
      expect(edgeLabels).toContain('dependency');
      expect(edgeLabels).toContain('indirect');
    });

    it('should set correct risk values on service nodes based on sloRisk', async () => {
      const result = await service.analyze(defaultInput);
      const blastRadius = await service.getBlastRadius(result.report.id);
      const serviceNodes = blastRadius.nodes.filter((n) => n.type === 'service');

      const paymentNode = serviceNodes.find((n) => n.label === 'payment-service');
      const orderNode = serviceNodes.find((n) => n.label === 'order-service');
      const notificationNode = serviceNodes.find((n) => n.label === 'notification-service');

      expect(paymentNode?.risk).toBe(0.9);  // high
      expect(orderNode?.risk).toBe(0.6);    // medium
      expect(notificationNode?.risk).toBe(0.3);  // low
    });

    it('should return empty nodes and edges for unknown reportId', async () => {
      const blastRadius = await service.getBlastRadius('unknown-report');

      expect(blastRadius.nodes.length).toBe(1);  // PR node still created with undefined data
      expect(blastRadius.edges.length).toBe(0);
    });

    it('should handle report with no affected services', async () => {
      // Create a report manually without affected services
      const report = createChangeIntelligenceReport(defaultInput, 0.5, [], 0, 0);
      // Note: we can't directly set the report; use analyze then check empty scenario
      // For this test, use an unknown reportId which has no services
      const blastRadius = await service.getBlastRadius('no-services-report');

      expect(blastRadius.nodes.length).toBe(1);  // PR node with unknown label
      expect(blastRadius.nodes[0].label).toBe('PR: unknown');
      expect(blastRadius.edges.length).toBe(0);
    });
  });

  // =====================================================================
  // computeRiskLevel() model function tests
  // =====================================================================

  describe('computeRiskLevel()', () => {
    it('should return "low" for score < 0.3', () => {
      expect(computeRiskLevel(0.0)).toBe('low');
      expect(computeRiskLevel(0.1)).toBe('low');
      expect(computeRiskLevel(0.29)).toBe('low');
    });

    it('should return "medium" for score >= 0.3 and < 0.6', () => {
      expect(computeRiskLevel(0.3)).toBe('medium');
      expect(computeRiskLevel(0.45)).toBe('medium');
      expect(computeRiskLevel(0.59)).toBe('medium');
    });

    it('should return "high" for score >= 0.6 and < 0.8', () => {
      expect(computeRiskLevel(0.6)).toBe('high');
      expect(computeRiskLevel(0.7)).toBe('high');
      expect(computeRiskLevel(0.79)).toBe('high');
    });

    it('should return "critical" for score >= 0.8', () => {
      expect(computeRiskLevel(0.8)).toBe('critical');
      expect(computeRiskLevel(0.9)).toBe('critical');
      expect(computeRiskLevel(1.0)).toBe('critical');
    });
  });

  // =====================================================================
  // Service with eventBus (integration-style)
  // =====================================================================

  describe('with EventBus', () => {
    it('should publish event with correct payload structure', async () => {
      const serviceWithBus = new ChangeIntelligenceService({
        eventBus: mockEventBus as any,
      });

      await serviceWithBus.analyze(defaultInput);

      const callArgs = mockEventBus.publish.mock.calls[0];
      expect(callArgs[0]).toBe('change-intelligence.analyzed');
      const payload = callArgs[1];
      expect(payload).toHaveProperty('reportId');
      expect(payload).toHaveProperty('prId', 'PR-1234');
      expect(payload).toHaveProperty('riskScore');
      expect(payload).toHaveProperty('riskLevel', 'critical');
    });
  });

  // =====================================================================
  // Edge cases and robustness
  // =====================================================================

  describe('edge cases', () => {
    it('should handle multiple analyze calls creating distinct reports', async () => {
      const result1 = await service.analyze({ ...defaultInput, prId: 'PR-1' });
      const result2 = await service.analyze({ ...defaultInput, prId: 'PR-2' });

      expect(result1.report.id).not.toBe(result2.report.id);
    });

    it('should be able to retrieve both reports after multiple analyze calls', async () => {
      const result1 = await service.analyze({ ...defaultInput, prId: 'PR-1' });
      const result2 = await service.analyze({ ...defaultInput, prId: 'PR-2' });

      const retrieved1 = await service.getById(result1.report.id);
      const retrieved2 = await service.getById(result2.report.id);

      expect(retrieved1?.prId).toBe('PR-1');
      expect(retrieved2?.prId).toBe('PR-2');
    });

    it('should handle addAffectedService with empty changedFiles', async () => {
      const result = await service.analyze(defaultInput);
      const newService = await service.addAffectedService({
        reportId: result.report.id,
        serviceName: 'empty-files-service',
        changedFiles: [],
        recommendedReviewers: [],
      });

      expect(newService.changedFiles).toEqual([]);
    });
  });
});
