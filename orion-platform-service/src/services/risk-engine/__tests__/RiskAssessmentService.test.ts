/**
 * RiskAssessmentService Unit Tests
 */

import { RiskAssessmentService, RiskFeature, RiskPrediction } from '../RiskAssessmentService';
import { RiskPredictionRepository } from '../../../repositories/RiskPredictionRepository';

// Mock repository
const mockRepository = {
  findById: jest.fn().mockResolvedValue(null),
  findByTarget: jest.fn().mockResolvedValue(null),
  findByTenant: jest.fn().mockResolvedValue([]),
  findHighRisk: jest.fn().mockResolvedValue([]),
  clearExpired: jest.fn().mockResolvedValue(0),
  getStats: jest.fn().mockResolvedValue({
    totalPredictions: 0,
    avgScore: 0,
    byLevel: { critical: 0, high: 0, medium: 0, low: 0 },
  }),
  create: jest.fn().mockResolvedValue({
    id: 'test-id',
    riskScore: 0.5,
    riskLevel: 'medium',
    features: {},
  }),
  findAll: jest.fn().mockResolvedValue({ entities: [], total: 0 }),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue(true),
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
};

const createTestFeatures = (overrides: Partial<RiskFeature> = {}): RiskFeature => ({
  blastRadius: 0.3,
  serviceTier: 0.5,
  fileCount: 5,
  testCoverage: 0.8,
  dependencyDepth: 0.2,
  changeType: 2,
  hasBreakingChanges: 0,
  authorExperience: 0.6,
  timeOfChange: 0.5,
  dayOfWeek: 0.3,
  PRSize: 100,
  testFilesChanged: 2,
  configFilesChanged: 0,
  dependencyUpdates: 0,
  hasDatabaseMigration: 0,
  hasAPIBreakingChange: 0,
  reviewComments: 3,
  reviewApprovalCount: 1,
  CIStatus: 1,
  codeComplexityDelta: 0,
  duplicationDetected: 0,
  securitySensitive: 0,
  priorFailureRate: 0.1,
  hotPathModified: 0,
  externalDependency: 0,
  ...overrides,
});

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;

  beforeEach(() => {
    service = new RiskAssessmentService(mockRepository as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Prediction ====================

  describe('predictRisk', () => {
    it('should predict risk score for given features', async () => {
      const features = createTestFeatures();

      const result = await service.predictRisk(features);

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(1);
      expect(result.riskLevel).toBeDefined();
      expect(['critical', 'high', 'medium', 'low']).toContain(result.riskLevel);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.modelVersion).toBe('v2.1.0');
      expect(result.shapValues).toBeDefined();
      expect(result.topRiskFactors).toBeDefined();
    });

    it('should cache prediction in memory', async () => {
      const features = createTestFeatures();

      const result1 = await service.predictRisk(features);
      const result2 = await service.predictRisk(features);

      // Second call should return cached result
      expect(result1.riskScore).toBe(result2.riskScore);
      expect(mockRepository.create).toHaveBeenCalledTimes(0); // No target info, not persisted
    });

    it('should persist prediction when target info provided', async () => {
      const features = createTestFeatures();

      await service.predictRisk(features, {
        targetType: 'pr',
        targetId: 'pr-123',
        tenantId: 'tenant-1',
      });

      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        targetType: 'pr',
        targetId: 'pr-123',
        tenantId: 'tenant-1',
      }));
    });

    it('should return cached result from database', async () => {
      const features = createTestFeatures();
      const cachedEntity = {
        id: 'cached-id',
        targetType: 'pr',
        targetId: 'pr-123',
        riskScore: 0.7,
        riskLevel: 'high',
        confidence: 0.9,
        modelVersion: 'v2.1.0',
        features: features as unknown as Record<string, number>,
        shapValues: [],
        topRiskFactors: ['blast radius'],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {},
      };

      mockRepository.findByTarget.mockResolvedValueOnce(cachedEntity as any);

      const result = await service.predictRisk(features, {
        targetType: 'pr',
        targetId: 'pr-123',
      });

      expect(result.riskScore).toBe(0.7);
      expect(result.riskLevel).toBe('high');
      expect(mockRepository.findByTarget).toHaveBeenCalledWith('pr', 'pr-123');
    });
  });

  // ==================== Risk Level ====================

  describe('risk level classification', () => {
    it('should classify as critical for high blast radius + breaking changes', async () => {
      const features = createTestFeatures({
        blastRadius: 0.9,
        hasBreakingChanges: 1,
        serviceTier: 0.8,
        securitySensitive: 1,
      });

      const result = await service.predictRisk(features);

      expect(result.riskLevel).toBe('critical');
      expect(result.riskScore).toBeGreaterThan(0.8);
    });

    it('should classify as high for high service tier', async () => {
      const features = createTestFeatures({
        serviceTier: 0.8,
        blastRadius: 0.4,
        hasBreakingChanges: 0,
      });

      const result = await service.predictRisk(features);

      expect(['high', 'critical']).toContain(result.riskLevel);
    });

    it('should classify as low for safe changes', async () => {
      const features = createTestFeatures({
        blastRadius: 0.1,
        serviceTier: 0.2,
        testCoverage: 0.95,
        hasBreakingChanges: 0,
        securitySensitive: 0,
        priorFailureRate: 0,
      });

      const result = await service.predictRisk(features);

      expect(['low', 'medium']).toContain(result.riskLevel);
      expect(result.riskScore).toBeLessThan(0.5);
    });
  });

  // ==================== SHAP Values ====================

  describe('SHAP values', () => {
    it('should compute SHAP contributions', async () => {
      const features = createTestFeatures();

      const result = await service.predictRisk(features);

      expect(result.shapValues.length).toBeGreaterThan(0);
      expect(result.shapValues[0].feature).toBeDefined();
      expect(result.shapValues[0].contribution).toBeDefined();
      expect(['positive', 'negative']).toContain(result.shapValues[0].direction);
    });

    it('should identify top risk factors from SHAP values', async () => {
      const features = createTestFeatures({
        blastRadius: 0.8,
        securitySensitive: 1,
      });

      const result = await service.predictRisk(features);

      expect(result.topRiskFactors.length).toBeGreaterThan(0);
      expect(result.topRiskFactors.length).toBeLessThanOrEqual(5);
    });
  });

  // ==================== Validation ====================

  describe('validation', () => {
    it('should throw for missing required features', async () => {
      const incompleteFeatures = {
        blastRadius: 0.3,
        // Missing other required features
      } as RiskFeature;

      await expect(service.predictRisk(incompleteFeatures)).rejects.toThrow('Missing required feature');
    });
  });

  // ==================== Batch Prediction ====================

  describe('predictBatch', () => {
    it('should predict for multiple feature sets', async () => {
      const featuresList = [
        createTestFeatures({ blastRadius: 0.1 }),
        createTestFeatures({ blastRadius: 0.5 }),
        createTestFeatures({ blastRadius: 0.9 }),
      ];

      const results = await service.predictBatch(featuresList);

      expect(results.length).toBe(3);
      expect(results[0].riskScore).toBeLessThan(results[2].riskScore);
    });
  });

  // ==================== Model Info ====================

  describe('getModelInfo', () => {
    it('should return model metadata', () => {
      const info = service.getModelInfo();

      expect(info.version).toBe('v2.1.0');
      expect(info.features).toBe(26);
      expect(info.loaded).toBe(true);
      expect(info.repositoryAvailable).toBe(true);
    });
  });

  // ==================== Stats ====================

  describe('getPredictionStats', () => {
    it('should return stats from repository', async () => {
      const stats = await service.getPredictionStats();

      expect(stats.totalPredictions).toBe(0);
      expect(stats.avgScore).toBe(0);
      expect(stats.byLevel).toBeDefined();
      expect(mockRepository.getStats).toHaveBeenCalled();
    });

    it('should return fallback stats when no repository', async () => {
      const noRepoService = new RiskAssessmentService();

      const stats = await noRepoService.getPredictionStats();

      expect(stats.totalPredictions).toBe(0);
      expect(stats.byLevel).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
    });
  });

  // ==================== Retrain ====================

  describe('retrain', () => {
    it('should clear cache after retrain', async () => {
      const features = createTestFeatures();
      await service.predictRisk(features);

      const infoBefore = service.getModelInfo();
      expect(infoBefore.memoryCacheSize).toBe(1);

      await service.retrain([
        { features, label: 0 },
        { features: createTestFeatures({ blastRadius: 0.8 }), label: 1 },
      ]);

      const infoAfter = service.getModelInfo();
      expect(infoAfter.memoryCacheSize).toBe(0);
      expect(mockRepository.clearExpired).toHaveBeenCalled();
    });
  });
});