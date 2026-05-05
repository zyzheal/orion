/**
 * ModelVersionService 单元测试
 */

import { ModelVersionService } from '../ModelVersionService';

describe('ModelVersionService', () => {
  let service: ModelVersionService;

  beforeEach(() => {
    service = new ModelVersionService();
  });

  // ==================== registerModel ====================

  describe('registerModel', () => {
    it('should register a new model', () => {
      const model = service.registerModel({
        name: 'code-review-model',
        version: 'v1.0.0',
        framework: 'openai',
        description: 'Initial code review model',
        registeredBy: 'admin',
      });

      expect(model.id).toBeDefined();
      expect(model.name).toBe('code-review-model');
      expect(model.version).toBe('v1.0.0');
      expect(model.status).toBe('registered');
      expect(model.registeredAt).toBeInstanceOf(Date);
    });

    it('should throw error for duplicate model version', () => {
      service.registerModel({
        name: 'test-model',
        version: 'v1.0.0',
        framework: 'anthropic',
      });

      expect(() =>
        service.registerModel({
          name: 'test-model',
          version: 'v1.0.0',
          framework: 'openai',
        })
      ).toThrow('already exists');
    });

    it('should register model with metrics', () => {
      const model = service.registerModel({
        name: 'risk-model',
        version: 'v2.0.0',
        framework: 'custom',
        metrics: {
          accuracy: 0.95,
          precision: 0.93,
          recall: 0.91,
          f1Score: 0.92,
        },
      });

      expect(model.metrics.accuracy).toBe(0.95);
      expect(model.metrics.f1Score).toBe(0.92);
    });

    it('should register model with tags', () => {
      const model = service.registerModel({
        name: 'tagged-model',
        version: 'v1.0.0',
        framework: 'rule-based',
        tags: ['production', 'stable'],
      });

      expect(model.tags).toEqual(['production', 'stable']);
    });
  });

  // ==================== activateModel ====================

  describe('activateModel', () => {
    it('should activate a registered model', () => {
      const model = service.registerModel({
        name: 'activate-test',
        version: 'v1.0.0',
        framework: 'openai',
      });

      const activated = service.activateModel(model.id);

      expect(activated.status).toBe('active');
      expect(activated.activatedAt).toBeInstanceOf(Date);
    });

    it('should deactivate previous active model of same name', () => {
      const v1 = service.registerModel({
        name: 'multi-version',
        version: 'v1.0.0',
        framework: 'openai',
      });
      service.activateModel(v1.id);

      const v2 = service.registerModel({
        name: 'multi-version',
        version: 'v2.0.0',
        framework: 'openai',
      });
      service.activateModel(v2.id);

      const activeModel = service.getActiveModel('multi-version');
      expect(activeModel?.id).toBe(v2.id);

      // v1 should no longer be active
      const v1Model = service.getModelById(v1.id);
      expect(v1Model?.status).not.toBe('active');
    });

    it('should throw error for deprecated model', () => {
      const model = service.registerModel({
        name: 'deprecated-test',
        version: 'v1.0.0',
        framework: 'openai',
      });
      service.deprecateModel(model.id);

      expect(() => service.activateModel(model.id)).toThrow('deprecated');
    });

    it('should throw error for non-existent model', () => {
      expect(() => service.activateModel('non-existent')).toThrow('not found');
    });
  });

  // ==================== getModelVersions ====================

  describe('getModelVersions', () => {
    beforeEach(() => {
      service.registerModel({ name: 'versioned-model', version: 'v1.0.0', framework: 'openai' });
      service.registerModel({ name: 'versioned-model', version: 'v2.0.0', framework: 'openai' });
      service.registerModel({ name: 'versioned-model', version: 'v3.0.0', framework: 'anthropic' });
    });

    it('should return all non-deprecated versions', () => {
      const versions = service.getModelVersions('versioned-model');

      expect(versions.length).toBe(3);
    });

    it('should exclude deprecated versions by default', () => {
      const allVersions = service.getModelVersions('versioned-model');
      const v1 = allVersions.find((v) => v.version === 'v1.0.0');
      if (v1) service.deprecateModel(v1.id);

      const versions = service.getModelVersions('versioned-model');
      expect(versions.length).toBe(2);
    });

    it('should include deprecated versions when flag is set', () => {
      const allVersions = service.getModelVersions('versioned-model');
      const v1 = allVersions.find((v) => v.version === 'v1.0.0');
      if (v1) service.deprecateModel(v1.id);

      const versions = service.getModelVersions('versioned-model', true);
      expect(versions.length).toBe(3);
    });

    it('should return sorted by registeredAt desc', () => {
      const versions = service.getModelVersions('versioned-model');

      for (let i = 1; i < versions.length; i++) {
        expect(versions[i].registeredAt.getTime()).toBeLessThanOrEqual(
          versions[i - 1].registeredAt.getTime()
        );
      }
    });
  });

  // ==================== getActiveModel ====================

  describe('getActiveModel', () => {
    it('should return the active model', () => {
      const model = service.registerModel({
        name: 'active-test',
        version: 'v1.0.0',
        framework: 'openai',
      });
      service.activateModel(model.id);

      const active = service.getActiveModel('active-test');
      expect(active?.id).toBe(model.id);
    });

    it('should return undefined if no active model', () => {
      const active = service.getActiveModel('non-existent');
      expect(active).toBeUndefined();
    });
  });

  // ==================== getAllActiveModels ====================

  describe('getAllActiveModels', () => {
    it('should return all active models', () => {
      const m1 = service.registerModel({ name: 'model-a', version: 'v1', framework: 'openai' });
      const m2 = service.registerModel({ name: 'model-b', version: 'v1', framework: 'anthropic' });

      service.activateModel(m1.id);
      service.activateModel(m2.id);

      const allActive = service.getAllActiveModels();
      expect(allActive.length).toBe(2);
    });
  });

  // ==================== deprecateModel ====================

  describe('deprecateModel', () => {
    it('should deprecate a model', () => {
      const model = service.registerModel({
        name: 'deprecate-test',
        version: 'v1.0.0',
        framework: 'openai',
      });

      const deprecated = service.deprecateModel(model.id);

      expect(deprecated.status).toBe('deprecated');
      expect(deprecated.deprecatedAt).toBeInstanceOf(Date);
    });

    it('should clear active status if model was active', () => {
      const model = service.registerModel({
        name: 'active-deprecate',
        version: 'v1.0.0',
        framework: 'openai',
      });
      service.activateModel(model.id);

      service.deprecateModel(model.id);

      const active = service.getActiveModel('active-deprecate');
      expect(active).toBeUndefined();
    });

    it('should throw error for archived model', () => {
      const model = service.registerModel({
        name: 'archived-test',
        version: 'v1.0.0',
        framework: 'openai',
      });
      service.deprecateModel(model.id);
      service.archiveModel(model.id);

      expect(() => service.deprecateModel(model.id)).toThrow('archived');
    });
  });

  // ==================== getModelById ====================

  describe('getModelById', () => {
    it('should return model by ID', () => {
      const model = service.registerModel({
        name: 'get-by-id',
        version: 'v1.0.0',
        framework: 'openai',
      });

      const found = service.getModelById(model.id);
      expect(found?.id).toBe(model.id);
    });

    it('should return undefined for non-existent ID', () => {
      const found = service.getModelById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  // ==================== updateModelMetrics ====================

  describe('updateModelMetrics', () => {
    it('should update model metrics', () => {
      const model = service.registerModel({
        name: 'metrics-test',
        version: 'v1.0.0',
        framework: 'openai',
      });

      const updated = service.updateModelMetrics(model.id, {
        accuracy: 0.97,
        avgLatency: 150,
        errorRate: 0.02,
      });

      expect(updated.metrics.accuracy).toBe(0.97);
      expect(updated.metrics.avgLatency).toBe(150);
      expect(updated.metrics.errorRate).toBe(0.02);
    });

    it('should throw error for non-existent model', () => {
      expect(() =>
        service.updateModelMetrics('non-existent', { accuracy: 0.9 })
      ).toThrow('not found');
    });
  });

  // ==================== A/B Testing ====================

  describe('AB Testing', () => {
    let modelA: ReturnType<typeof service.registerModel>;
    let modelB: ReturnType<typeof service.registerModel>;

    beforeEach(() => {
      modelA = service.registerModel({
        name: 'ab-test-model',
        version: 'v1.0.0',
        framework: 'openai',
      });
      modelB = service.registerModel({
        name: 'ab-test-model',
        version: 'v2.0.0',
        framework: 'anthropic',
      });
    });

    it('should create an AB test', () => {
      const abTest = service.createABTest({
        modelName: 'ab-test-model',
        variants: [
          { modelId: modelA.id, name: 'Control (v1)' },
          { modelId: modelB.id, name: 'Treatment (v2)' },
        ],
        trafficSplit: { [modelA.id]: 50, [modelB.id]: 50 },
        targetMetrics: ['accuracy', 'errorRate'],
      });

      expect(abTest.modelName).toBe('ab-test-model');
      expect(abTest.variants.length).toBe(2);
      expect(abTest.status).toBe('running');
    });

    it('should throw error for invalid traffic split', () => {
      expect(() =>
        service.createABTest({
          modelName: 'ab-test-model',
          variants: [
            { modelId: modelA.id, name: 'A' },
            { modelId: modelB.id, name: 'B' },
          ],
          trafficSplit: { [modelA.id]: 30, [modelB.id]: 30 },
          targetMetrics: ['accuracy'],
        })
      ).toThrow('must sum to 100');
    });

    it('should throw error for non-existent variant model', () => {
      expect(() =>
        service.createABTest({
          modelName: 'ab-test-model',
          variants: [{ modelId: 'non-existent', name: 'Ghost' }],
          trafficSplit: { 'non-existent': 100 },
          targetMetrics: ['accuracy'],
        })
      ).toThrow('not found');
    });

    it('should record AB test results', () => {
      service.createABTest({
        modelName: 'ab-test-model',
        variants: [
          { modelId: modelA.id, name: 'A' },
          { modelId: modelB.id, name: 'B' },
        ],
        trafficSplit: { [modelA.id]: 50, [modelB.id]: 50 },
        targetMetrics: ['errorRate'],
      });

      service.recordABTestResult('ab-test-model', modelA.id, { success: true, latency: 100 });
      service.recordABTestResult('ab-test-model', modelA.id, { success: false, latency: 200 });
      service.recordABTestResult('ab-test-model', modelB.id, { success: true, latency: 150 });

      const results = service.getABTestResults('ab-test-model');
      expect(results).toBeDefined();
      expect(results?.results.length).toBe(2);

      const resultA = results?.results.find((r) => r.modelId === modelA.id);
      expect(resultA?.requestCount).toBe(2);
      expect(resultA?.metrics.totalPredictions).toBe(2);
    });

    it('should complete AB test and determine winner', () => {
      service.createABTest({
        modelName: 'ab-test-model',
        variants: [
          { modelId: modelA.id, name: 'A' },
          { modelId: modelB.id, name: 'B' },
        ],
        trafficSplit: { [modelA.id]: 50, [modelB.id]: 50 },
        targetMetrics: ['errorRate'],
      });

      // Model A: all success
      for (let i = 0; i < 10; i++) {
        service.recordABTestResult('ab-test-model', modelA.id, { success: true });
      }
      // Model B: some failures
      for (let i = 0; i < 10; i++) {
        service.recordABTestResult('ab-test-model', modelB.id, { success: i < 7 });
      }

      const result = service.completeABTest('ab-test-model');

      expect(result.config.status).toBe('completed');
      expect(result.winner).toBe(modelA.id);
      expect(result.conclusion).toBeDefined();
    });

    it('should pause AB test', () => {
      service.createABTest({
        modelName: 'ab-test-model',
        variants: [
          { modelId: modelA.id, name: 'A' },
          { modelId: modelB.id, name: 'B' },
        ],
        trafficSplit: { [modelA.id]: 50, [modelB.id]: 50 },
        targetMetrics: ['errorRate'],
      });

      const paused = service.pauseABTest('ab-test-model');
      expect(paused.status).toBe('paused');
    });

    it('should return undefined for non-existent AB test', () => {
      const results = service.getABTestResults('non-existent-model');
      expect(results).toBeUndefined();
    });
  });

  // ==================== Model Performance ====================

  describe('getModelPerformanceOverview', () => {
    it('should return performance overview', () => {
      service.registerModel({ name: 'perf-model', version: 'v1.0.0', framework: 'openai' });
      const v2 = service.registerModel({ name: 'perf-model', version: 'v2.0.0', framework: 'openai' });
      service.activateModel(v2.id);

      const overview = service.getModelPerformanceOverview('perf-model');

      expect(overview.versions).toBe(2);
      expect(overview.activeVersion).toBe('v2.0.0');
      expect(overview.allMetrics.length).toBe(2);
    });
  });

  // ==================== listModels ====================

  describe('listModels', () => {
    beforeEach(() => {
      service.registerModel({ name: 'model-a', version: 'v1', framework: 'openai' });
      service.registerModel({ name: 'model-b', version: 'v1', framework: 'anthropic' });
      service.registerModel({ name: 'model-c', version: 'v1', framework: 'openai' });
    });

    it('should return all models by default', () => {
      const models = service.listModels();
      expect(models.length).toBe(3);
    });

    it('should filter by status', () => {
      const models = service.listModels({ status: 'registered' });
      expect(models.length).toBe(3);
    });

    it('should filter by framework', () => {
      const models = service.listModels({ framework: 'openai' });
      expect(models.length).toBe(2);
    });

    it('should filter by name', () => {
      const models = service.listModels({ name: 'model-a' });
      expect(models.length).toBe(1);
      expect(models[0].name).toBe('model-a');
    });
  });

  // ==================== archiveModel ====================

  describe('archiveModel', () => {
    it('should archive a deprecated model', () => {
      const model = service.registerModel({
        name: 'archive-test',
        version: 'v1.0.0',
        framework: 'openai',
      });
      service.deprecateModel(model.id);

      const archived = service.archiveModel(model.id);
      expect(archived.status).toBe('archived');
    });

    it('should throw error for active model', () => {
      const model = service.registerModel({
        name: 'active-archive',
        version: 'v1.0.0',
        framework: 'openai',
      });
      service.activateModel(model.id);

      expect(() => service.archiveModel(model.id)).toThrow('active');
    });
  });
});
