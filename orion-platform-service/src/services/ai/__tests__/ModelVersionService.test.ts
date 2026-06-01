/**
 * ModelVersionService Tests
 *
 * Covers: model registration, activation, versioning, A/B testing,
 * performance overview, archiving.
 * Uses in-memory mock repositories.
 */

import {
  ModelVersionService,
  ModelRegistrationInput,
} from '../ModelVersionService';
import {
  ModelVersionRepository,
  ABTestRepository,
  ABTestMetricRepository,
} from '../../../repositories/ModelVersionRepository';

// ==================== Mock Repositories ====================

class MockModelVersionRepository extends ModelVersionRepository {
  private store: Map<string, any> = new Map();
  constructor() { super({} as any); }

  async create(data: any) {
    const now = new Date();
    const entity = { ...data, registered_at: now };
    await this.store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string) {
    return this.store.get(id);
  }

  async findByNameAndVersion(name: string, version: string) {
    return Array.from(this.store.values()).find(
      (e: any) => e.name === name && e.version === version
    );
  }

  async findByName(name: string, includeAll = false) {
    let results = Array.from(this.store.values()).filter(
      (e: any) => e.name === name
    );
    if (!includeAll) {
      results = results.filter((e: any) => !['deprecated', 'archived'].includes(e.status));
    }
    return results.sort((a: any, b: any) => b.registered_at.getTime() - a.registered_at.getTime());
  }

  async findActiveByName(name: string) {
    return Array.from(this.store.values()).find(
      (e: any) => e.name === name && e.status === 'active'
    );
  }

  async findAllActive() {
    return Array.from(this.store.values())
      .filter((e: any) => e.status === 'active')
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }

  async update(id: string, data: any) {
    const entity = await this.store.get(
    if (!entity) throw new Error(`Model ${id} not found`);
    Object.assign(entity, data);
    return entity;
  }

  async updateMetrics(id: string, metrics: any) {
    const entity = await this.store.get(
    if (!entity) throw new Error(`Model ${id} not found`);
    entity.metrics = { ...entity.metrics, ...metrics };
    return entity;
  }

  async clearActiveByName(name: string) {
    for (const e of this.store.values()) {
      if (e.name === name && e.status === 'active') {
        e.status = 'registered';
        e.activated_at = null;
      }
    }
  }

  async listAll(options?: { status?: string; framework?: string; name?: string }) {
    let results = Array.from(this.store.values());
    if (options?.status) {
      results = results.filter((e: any) => e.status === options.status);
    }
    if (options?.framework) {
      results = results.filter((e: any) => e.framework === options.framework);
    }
    if (options?.name) {
      results = results.filter((e: any) => e.name.toLowerCase().includes(options.name!.toLowerCase()));
    }
    return results.sort((a: any, b: any) => b.registered_at.getTime() - a.registered_at.getTime());
  }

  clear() { this.store.clear(); }
}

class MockABTestRepository extends ABTestRepository {
  private store: Map<string, any> = new Map();
  constructor() { super({} as any); }

  async create(data: any) {
    const now = new Date();
    const entity = { ...data, start_date: now };
    await this.store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string) {
    return this.store.get(id);
  }

  async findByName(modelName: string) {
    return Array.from(this.store.values()).find(
      (e: any) => e.model_name === modelName
    );
  }

  async updateStatus(id: string, status: string) {
    const entity = await this.store.get(
    if (!entity) throw new Error(`AB test ${id} not found`);
    entity.status = status;
    return entity;
  }

  clear() { this.store.clear(); }
}

class MockABTestMetricRepository extends ABTestMetricRepository {
  private store: Map<string, any> = new Map();
  constructor() { super({} as any); }

  async create(data: any) {
    const entity = { ...data };
    await this.store.set(entity.id, entity);
    return entity;
  }

  async findByABTest(abTestId: string) {
    return Array.from(this.store.values()).filter(
      (e: any) => e.ab_test_id === abTestId
    );
  }

  async findByABTestAndModel(abTestId: string, modelId: string) {
    return Array.from(this.store.values()).find(
      (e: any) => e.ab_test_id === abTestId && e.model_id === modelId
    );
  }

  async incrementRequestCount(id: string) {
    const entity = await this.store.get(
    if (!entity) throw new Error(`AB test metric ${id} not found`);
    entity.request_count++;
    return entity;
  }

  async updateMetrics(id: string, metrics: any) {
    const entity = await this.store.get(
    if (!entity) throw new Error(`AB test metric ${id} not found`);
    entity.metrics = metrics;
    return entity;
  }

  clear() { this.store.clear(); }
}

// ==================== Tests ====================

describe('ModelVersionService', () => {
  let service: ModelVersionService;
  let modelRepo: MockModelVersionRepository;
  let abTestRepo: MockABTestRepository;
  let abTestMetricRepo: MockABTestMetricRepository;

  beforeEach(async () => {
    modelRepo = new MockModelVersionRepository();
    abTestRepo = new MockABTestRepository();
    abTestMetricRepo = new MockABTestMetricRepository();

    const mockDb = {
      query: async () => ({ rows: [], rowCount: 0 }),
    };
    service = new ModelVersionService(mockDb);

    // Replace repos with mocks
    (service as any).modelRepo = modelRepo;
    (service as any).abTestRepo = abTestRepo;
    (service as any).abTestMetricRepo = abTestMetricRepo;
  });

  afterEach(async () => {
    modelRepo.clear();
    abTestRepo.clear();
    abTestMetricRepo.clear();
  });

  // ==================== registerModel ====================

  describe('registerModel', () => {
    it('should register a new model', async () => {
      const model = await service.registerModel({
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

    it('should throw error for duplicate model version', async () => {
      await service.registerModel({
        name: 'test-model',
        version: 'v1.0.0',
        framework: 'anthropic',
      });

      await expect(
        service.registerModel({
          name: 'test-model',
          version: 'v1.0.0',
          framework: 'openai',
        })
      ).rejects.toThrow('already exists');
    });

    it('should register model with metrics', async () => {
      const model = await service.registerModel({
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

    it('should register model with tags', async () => {
      const model = await service.registerModel({
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
    it('should activate a registered model', async () => {
      const model = await service.registerModel({
        name: 'activate-test',
        version: 'v1.0.0',
        framework: 'openai',
      });

      const activated = await service.activateModel(model.id);

      expect(activated.status).toBe('active');
      expect(activated.activatedAt).toBeInstanceOf(Date);
    });

    it('should deactivate previous active model of same name', async () => {
      const v1 = await service.registerModel({
        name: 'multi-version',
        version: 'v1.0.0',
        framework: 'openai',
      });
      await service.activateModel(v1.id);

      const v2 = await service.registerModel({
        name: 'multi-version',
        version: 'v2.0.0',
        framework: 'openai',
      });
      await service.activateModel(v2.id);

      const activeModel = await service.getActiveModel('multi-version');
      expect(activeModel?.id).toBe(v2.id);

      // v1 should no longer be active
      const v1Model = await service.getModelById(v1.id);
      expect(v1Model?.status).not.toBe('active');
    });

    it('should throw error for deprecated model', async () => {
      const model = await service.registerModel({
        name: 'deprecated-test',
        version: 'v1.0.0',
        framework: 'openai',
      });
      await service.deprecateModel(model.id);

      await expect(service.activateModel(model.id)).rejects.toThrow('deprecated');
    });

    it('should throw error for non-existent model', async () => {
      await expect(service.activateModel('non-existent')).rejects.toThrow('not found');
    });
  });

  // ==================== getModelVersions ====================

  describe('getModelVersions', () => {
    beforeEach(async () => {
      await service.registerModel({ name: 'versioned-model', version: 'v1.0.0', framework: 'openai' });
      await service.registerModel({ name: 'versioned-model', version: 'v2.0.0', framework: 'openai' });
      await service.registerModel({ name: 'versioned-model', version: 'v3.0.0', framework: 'anthropic' });
    });

    it('should return all non-deprecated versions', async () => {
      const versions = await service.getModelVersions('versioned-model');

      expect(versions.length).toBe(3);
    });

    it('should exclude deprecated versions by default', async () => {
      const allVersions = await service.getModelVersions('versioned-model');
      const v1 = allVersions.find((v) => v.version === 'v1.0.0');
      if (v1) await service.deprecateModel(v1.id);

      const versions = await service.getModelVersions('versioned-model');
      expect(versions.length).toBe(2);
    });

    it('should include deprecated versions when flag is set', async () => {
      const allVersions = await service.getModelVersions('versioned-model');
      const v1 = allVersions.find((v) => v.version === 'v1.0.0');
      if (v1) await service.deprecateModel(v1.id);

      const versions = await service.getModelVersions('versioned-model', true);
      expect(versions.length).toBe(3);
    });

    it('should return sorted by registeredAt desc', async () => {
      const versions = await service.getModelVersions('versioned-model');

      for (let i = 1; i < versions.length; i++) {
        expect(versions[i].registeredAt.getTime()).toBeLessThanOrEqual(
          versions[i - 1].registeredAt.getTime()
        );
      }
    });
  });

  // ==================== getActiveModel ====================

  describe('getActiveModel', () => {
    it('should return the active model', async () => {
      const model = await service.registerModel({
        name: 'active-test',
        version: 'v1.0.0',
        framework: 'openai',
      });
      await service.activateModel(model.id);

      const active = await service.getActiveModel('active-test');
      expect(active?.id).toBe(model.id);
    });

    it('should return undefined if no active model', async () => {
      const active = await service.getActiveModel('non-existent');
      expect(active).toBeUndefined();
    });
  });

  // ==================== getAllActiveModels ====================

  describe('getAllActiveModels', () => {
    it('should return all active models', async () => {
      const m1 = await service.registerModel({ name: 'model-a', version: 'v1', framework: 'openai' });
      const m2 = await service.registerModel({ name: 'model-b', version: 'v1', framework: 'anthropic' });

      await service.activateModel(m1.id);
      await service.activateModel(m2.id);

      const allActive = await service.getAllActiveModels();
      expect(allActive.length).toBe(2);
    });
  });

  // ==================== deprecateModel ====================

  describe('deprecateModel', () => {
    it('should deprecate a model', async () => {
      const model = await service.registerModel({
        name: 'deprecate-test',
        version: 'v1.0.0',
        framework: 'openai',
      });

      const deprecated = await service.deprecateModel(model.id);

      expect(deprecated.status).toBe('deprecated');
      expect(deprecated.deprecatedAt).toBeInstanceOf(Date);
    });

    it('should clear active status if model was active', async () => {
      const model = await service.registerModel({
        name: 'active-deprecate',
        version: 'v1.0.0',
        framework: 'openai',
      });
      await service.activateModel(model.id);

      await service.deprecateModel(model.id);

      const active = await service.getActiveModel('active-deprecate');
      expect(active).toBeUndefined();
    });

    it('should throw error for archived model', async () => {
      const model = await service.registerModel({
        name: 'archived-test',
        version: 'v1.0.0',
        framework: 'openai',
      });
      await service.deprecateModel(model.id);
      await service.archiveModel(model.id);

      await expect(service.deprecateModel(model.id)).rejects.toThrow('archived');
    });
  });

  // ==================== getModelById ====================

  describe('getModelById', () => {
    it('should return model by ID', async () => {
      const model = await service.registerModel({
        name: 'get-by-id',
        version: 'v1.0.0',
        framework: 'openai',
      });

      const found = await service.getModelById(model.id);
      expect(found?.id).toBe(model.id);
    });

    it('should return undefined for non-existent ID', async () => {
      const found = await service.getModelById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  // ==================== updateModelMetrics ====================

  describe('updateModelMetrics', () => {
    it('should update model metrics', async () => {
      const model = await service.registerModel({
        name: 'metrics-test',
        version: 'v1.0.0',
        framework: 'openai',
      });

      const updated = await service.updateModelMetrics(model.id, {
        accuracy: 0.97,
        avgLatency: 150,
        errorRate: 0.02,
      });

      expect(updated.metrics.accuracy).toBe(0.97);
      expect(updated.metrics.avgLatency).toBe(150);
      expect(updated.metrics.errorRate).toBe(0.02);
    });

    it('should throw error for non-existent model', async () => {
      await expect(
        service.updateModelMetrics('non-existent', { accuracy: 0.9 })
      ).rejects.toThrow('not found');
    });
  });

  // ==================== A/B Testing ====================

  describe('AB Testing', () => {
    let modelA: Awaited<ReturnType<typeof service.registerModel>>;
    let modelB: Awaited<ReturnType<typeof service.registerModel>>;

    beforeEach(async () => {
      modelA = await service.registerModel({
        name: 'ab-test-model',
        version: 'v1.0.0',
        framework: 'openai',
      });
      modelB = await service.registerModel({
        name: 'ab-test-model',
        version: 'v2.0.0',
        framework: 'anthropic',
      });
    });

    it('should create an AB test', async () => {
      const abTest = await service.createABTest({
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

    it('should throw error for invalid traffic split', async () => {
      await expect(
        service.createABTest({
          modelName: 'ab-test-model',
          variants: [
            { modelId: modelA.id, name: 'A' },
            { modelId: modelB.id, name: 'B' },
          ],
          trafficSplit: { [modelA.id]: 30, [modelB.id]: 30 },
          targetMetrics: ['accuracy'],
        })
      ).rejects.toThrow('must sum to 100');
    });

    it('should throw error for non-existent variant model', async () => {
      await expect(
        service.createABTest({
          modelName: 'ab-test-model',
          variants: [{ modelId: 'non-existent', name: 'Ghost' }],
          trafficSplit: { 'non-existent': 100 },
          targetMetrics: ['accuracy'],
        })
      ).rejects.toThrow('not found');
    });

    it('should record AB test results', async () => {
      await service.createABTest({
        modelName: 'ab-test-model',
        variants: [
          { modelId: modelA.id, name: 'A' },
          { modelId: modelB.id, name: 'B' },
        ],
        trafficSplit: { [modelA.id]: 50, [modelB.id]: 50 },
        targetMetrics: ['errorRate'],
      });

      await service.recordABTestResult('ab-test-model', modelA.id, { success: true, latency: 100 });
      await service.recordABTestResult('ab-test-model', modelA.id, { success: false, latency: 200 });
      await service.recordABTestResult('ab-test-model', modelB.id, { success: true, latency: 150 });

      const results = await service.getABTestResults('ab-test-model');
      expect(results).toBeDefined();
      expect(results?.results.length).toBe(2);

      const resultA = results?.results.find((r) => r.modelId === modelA.id);
      expect(resultA?.requestCount).toBe(2);
      expect(resultA?.metrics.totalPredictions).toBe(2);
    });

    it('should complete AB test and determine winner', async () => {
      await service.createABTest({
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
        await service.recordABTestResult('ab-test-model', modelA.id, { success: true });
      }
      // Model B: some failures
      for (let i = 0; i < 10; i++) {
        await service.recordABTestResult('ab-test-model', modelB.id, { success: i < 7 });
      }

      const result = await service.completeABTest('ab-test-model');

      expect(result.config.status).toBe('completed');
      expect(result.winner).toBe(modelA.id);
      expect(result.conclusion).toBeDefined();
    });

    it('should pause AB test', async () => {
      await service.createABTest({
        modelName: 'ab-test-model',
        variants: [
          { modelId: modelA.id, name: 'A' },
          { modelId: modelB.id, name: 'B' },
        ],
        trafficSplit: { [modelA.id]: 50, [modelB.id]: 50 },
        targetMetrics: ['errorRate'],
      });

      const paused = await service.pauseABTest('ab-test-model');
      expect(paused.status).toBe('paused');
    });

    it('should return undefined for non-existent AB test', async () => {
      const results = await service.getABTestResults('non-existent-model');
      expect(results).toBeUndefined();
    });
  });

  // ==================== Model Performance ====================

  describe('getModelPerformanceOverview', () => {
    it('should return performance overview', async () => {
      await service.registerModel({ name: 'perf-model', version: 'v1.0.0', framework: 'openai' });
      const v2 = await service.registerModel({ name: 'perf-model', version: 'v2.0.0', framework: 'openai' });
      await service.activateModel(v2.id);

      const overview = await service.getModelPerformanceOverview('perf-model');

      expect(overview.versions).toBe(2);
      expect(overview.activeVersion).toBe('v2.0.0');
      expect(overview.allMetrics.length).toBe(2);
    });
  });

  // ==================== listModels ====================

  describe('listModels', () => {
    beforeEach(async () => {
      await service.registerModel({ name: 'model-a', version: 'v1', framework: 'openai' });
      await service.registerModel({ name: 'model-b', version: 'v1', framework: 'anthropic' });
      await service.registerModel({ name: 'model-c', version: 'v1', framework: 'openai' });
    });

    it('should return all models by default', async () => {
      const models = await service.listModels();
      expect(models.length).toBe(3);
    });

    it('should filter by status', async () => {
      const models = await service.listModels({ status: 'registered' });
      expect(models.length).toBe(3);
    });

    it('should filter by framework', async () => {
      const models = await service.listModels({ framework: 'openai' });
      expect(models.length).toBe(2);
    });

    it('should filter by name', async () => {
      const models = await service.listModels({ name: 'model-a' });
      expect(models.length).toBe(1);
      expect(models[0].name).toBe('model-a');
    });
  });

  // ==================== archiveModel ====================

  describe('archiveModel', () => {
    it('should archive a deprecated model', async () => {
      const model = await service.registerModel({
        name: 'archive-test',
        version: 'v1.0.0',
        framework: 'openai',
      });
      await service.deprecateModel(model.id);

      const archived = await service.archiveModel(model.id);
      expect(archived.status).toBe('archived');
    });

    it('should throw error for active model', async () => {
      const model = await service.registerModel({
        name: 'active-archive',
        version: 'v1.0.0',
        framework: 'openai',
      });
      await service.activateModel(model.id);

      await expect(service.archiveModel(model.id)).rejects.toThrow('active');
    });
  });
});
