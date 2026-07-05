/**
 * ModelVersionService 扩展单元测试
 *
 * 覆盖现有测试未覆盖的场景：
 * - 所有错误路径和异常分支
 * - getModelMetricsHistory / compareModels 等未测试方法
 * - Repository 边界情况（null 返回、默认值、组合过滤）
 * - Service 层状态校验（archived/active/重复等）
 */

import {
  ModelVersionService,
  ModelVersionRepository,
  ModelVersionServiceError,
  AIModelVersion,
} from '../ModelVersionService';

// ---- Helper to build a full model row ----
const makeModelRow = (overrides: Record<string, any> = {}): Record<string, any> => ({
  id: 'm-default',
  tenant_id: 't1',
  name: 'default-model',
  model_type: 'risk-assessment',
  version: 'v1.0.0',
  status: 'registered',
  features: [],
  metrics: { accuracy: 0, precision: 0, recall: 0, f1Score: 0 },
  training_info: {},
  ab_test_config: {},
  created_by: null,
  created_at: new Date('2026-01-01'),
  ...overrides,
});

describe('ModelVersionService (extended)', () => {
  let mockPool: { query: jest.Mock };
  let repository: ModelVersionRepository;
  let service: ModelVersionService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = { query: jest.fn() };
    repository = new ModelVersionRepository(mockPool as any);
    service = new ModelVersionService(mockPool as any);
  });

  // ================================================================
  // Repository: findById
  // ================================================================
  describe('Repository.findById', () => {
    it('应该返回完整映射的模型', async () => {
      const row = makeModelRow({
        id: 'm-full',
        features: ['age', 'income'],
        metrics: { accuracy: 0.95, precision: 0.9, recall: 0.88, f1Score: 0.89 },
        training_info: { samplesCount: 5000, framework: 'pytorch' },
      });
      mockPool.query.mockResolvedValue({ rows: [row] });

      const result = await repository.findById('m-full');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('m-full');
      expect(result!.features).toEqual(['age', 'income']);
      expect(result!.metrics.accuracy).toBe(0.95);
      expect(result!.training_info).toEqual({ samplesCount: 5000, framework: 'pytorch' });
    });

    it('应该用 null 占位符填充缺失字段', async () => {
      const row = {
        id: 'm-partial',
        tenant_id: null,
        name: 'partial',
        model_type: 'test',
        version: 'v1',
        status: 'registered',
        // features, metrics, training_info, ab_test_config missing
        created_by: null,
        created_at: new Date(),
      };
      mockPool.query.mockResolvedValue({ rows: [row] });

      const result = await repository.findById('m-partial');

      expect(result).not.toBeNull();
      expect(result!.features).toEqual([]);
      expect(result!.metrics).toEqual({ accuracy: 0, precision: 0, recall: 0, f1Score: 0 });
      expect(result!.training_info).toEqual({});
      expect(result!.ab_test_config).toEqual({});
      expect(result!.tenant_id).toBeNull();
      expect(result!.created_by).toBeNull();
    });
  });

  // ================================================================
  // Repository: findByTypeAndVersion
  // ================================================================
  describe('Repository.findByTypeAndVersion', () => {
    it('应该返回 null 当无匹配', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.findByTypeAndVersion('unknown', 'v999');

      expect(result).toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('model_type = $1 AND version = $2'),
        ['unknown', 'v999'],
      );
    });
  });

  // ================================================================
  // Repository: findActiveByType
  // ================================================================
  describe('Repository.findActiveByType', () => {
    it('应该返回 null 当无活跃模型', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.findActiveByType('unknown-type');

      expect(result).toBeNull();
    });
  });

  // ================================================================
  // Repository: list
  // ================================================================
  describe('Repository.list', () => {
    it('应该支持 tenant_id 过滤', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })
        .mockResolvedValueOnce({ rows: [makeModelRow(), makeModelRow({ id: 'm2' })] });

      const result = await repository.list({ tenant_id: 't-abc' });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      // tenant_id should appear in the WHERE clause
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id'),
        expect.arrayContaining(['t-abc']),
      );
    });

    it('应该支持组合过滤 (type + status + tenant_id)', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.list({
        type: 'risk',
        status: 'active',
        tenant_id: 't1',
      });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      const firstCallParams = mockPool.query.mock.calls[0][1];
      expect(firstCallParams).toEqual(['risk', 'active', 't1']);
    });

    it('应该在无过滤条件时省略 WHERE', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repository.list({});

      const countSql = mockPool.query.mock.calls[0][0] as string;
      expect(countSql).not.toContain('WHERE');
    });

    it('应该使用默认分页 page=1, limit=20', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repository.list({});

      // The LIMIT/OFFSET params should be the last two params
      const dataCallParams = mockPool.query.mock.calls[1][1];
      expect(dataCallParams).toEqual([20, 0]); // limit=20, offset=0
    });
  });

  // ================================================================
  // Repository: create
  // ================================================================
  describe('Repository.create', () => {
    it('应该使用默认值填充缺失的可选字段', async () => {
      const returnedRow = makeModelRow({ id: 'm-new', name: 'new', status: 'registered' });
      mockPool.query.mockResolvedValue({ rows: [returnedRow] });

      const result = await repository.create({
        name: 'new',
        model_type: 'risk',
        version: 'v1',
      });

      expect(result.name).toBe('new');
      expect(result.status).toBe('registered');
      // Verify INSERT params include defaults
      const insertParams = mockPool.query.mock.calls[0][1];
      expect(insertParams[0]).toBeNull(); // tenant_id defaults to null
      expect(insertParams[4]).toEqual([]); // features defaults to []
      expect(insertParams[8]).toBeNull(); // created_by defaults to null
    });

    it('应该传递所有可选字段', async () => {
      const returnedRow = makeModelRow({ id: 'm-full' });
      mockPool.query.mockResolvedValue({ rows: [returnedRow] });

      await repository.create({
        tenant_id: 't-123',
        name: 'full-model',
        model_type: 'credit',
        version: 'v2.0',
        features: ['f1', 'f2'],
        metrics: { accuracy: 0.98 },
        training_info: { samplesCount: 10000, framework: 'xgboost' },
        created_by: 'user-1',
      });

      const insertParams = mockPool.query.mock.calls[0][1];
      expect(insertParams[0]).toBe('t-123');
      expect(insertParams[4]).toEqual(['f1', 'f2']);
      expect(insertParams[8]).toBe('user-1');
    });
  });

  // ================================================================
  // Repository: updateStatus
  // ================================================================
  describe('Repository.updateStatus', () => {
    it('应该返回 null 当更新无匹配行', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateStatus('nonexistent', 'active');

      expect(result).toBeNull();
    });
  });

  // ================================================================
  // Repository: updateABTestConfig
  // ================================================================
  describe('Repository.updateABTestConfig', () => {
    it('应该返回 null 当更新无匹配行', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateABTestConfig('nonexistent', {
        trafficPercent: 10,
        compareToId: null,
        startedAt: null,
        results: null,
      });

      expect(result).toBeNull();
    });
  });

  // ================================================================
  // Repository: softDelete
  // ================================================================
  describe('Repository.softDelete', () => {
    it('应该返回 true 当成功归档', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.softDelete('m1');

      expect(result).toBe(true);
    });

    it('应该返回 false 当模型已归档或不存在', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.softDelete('m-archived');

      expect(result).toBe(false);
    });
  });

  // ================================================================
  // Service: registerModel
  // ================================================================
  describe('Service.registerModel', () => {
    it('应该在重复模型时抛出 DUPLICATE_MODEL', async () => {
      mockPool.query.mockResolvedValue({
        rows: [makeModelRow({ model_type: 'risk', version: 'v1' })],
      });

      try {
        await service.registerModel({ name: 'dup', model_type: 'risk', version: 'v1' });
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ModelVersionServiceError);
        expect((e as ModelVersionServiceError).code).toBe('DUPLICATE_MODEL');
      }
    });

    it('应该成功注册并返回 registered 状态', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // no existing
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm-new', status: 'registered' })] });

      const result = await service.registerModel({
        name: 'brand-new',
        model_type: 'fraud',
        version: 'v1.0',
        features: ['amount', 'merchant'],
      });

      expect(result.status).toBe('registered');
      expect(result.id).toBe('m-new');
    });
  });

  // ================================================================
  // Service: getModel
  // ================================================================
  describe('Service.getModel', () => {
    it('应该在模型不存在时抛出 MODEL_NOT_FOUND', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      try {
        await service.getModel('nonexistent');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ModelVersionServiceError);
        expect((e as ModelVersionServiceError).message).toBe('Model not found: nonexistent');
        expect((e as ModelVersionServiceError).code).toBe('MODEL_NOT_FOUND');
      }
    });
  });

  // ================================================================
  // Service: activateModel
  // ================================================================
  describe('Service.activateModel', () => {
    it('应该在归档模型上抛出 INVALID_STATUS', async () => {
      mockPool.query.mockResolvedValue({
        rows: [makeModelRow({ id: 'm1', status: 'archived' })],
      });

      try {
        await service.activateModel('m1', {});
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ModelVersionServiceError);
        expect((e as ModelVersionServiceError).message).toBe('Cannot activate archived model');
        expect((e as ModelVersionServiceError).code).toBe('INVALID_STATUS');
      }
    });

    it('应该在模型已经是 active 时直接返回', async () => {
      // getModel -> returns active model, findActiveByType -> same model
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm1', status: 'active' })] })
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm1', status: 'active' })] });

      const result = await service.activateModel('m1', {});

      expect(result).toEqual({ id: 'm1', status: 'active', previousActiveId: 'm1' });
    });

    it('应该停用当前活跃模型再激活新模型', async () => {
      const oldActive = makeModelRow({ id: 'm-old', status: 'active', model_type: 'risk' });
      const newModel = makeModelRow({ id: 'm-new', status: 'testing', model_type: 'risk' });

      mockPool.query
        .mockResolvedValueOnce({ rows: [newModel] }) // getModel (new)
        .mockResolvedValueOnce({ rows: [oldActive] }) // findActiveByType
        .mockResolvedValueOnce({ rows: [{ ...oldActive, status: 'testing' }] }) // updateStatus old -> testing
        .mockResolvedValueOnce({ rows: [{ ...newModel, status: 'active' }] }); // updateStatus new -> active

      const result = await service.activateModel('m-new', {});

      expect(result.status).toBe('active');
      expect(result.previousActiveId).toBe('m-old');
    });

    it('应该在无当前活跃模型时直接激活', async () => {
      const newModel = makeModelRow({ id: 'm-new', status: 'testing' });

      mockPool.query
        .mockResolvedValueOnce({ rows: [newModel] }) // getModel
        .mockResolvedValueOnce({ rows: [] }) // findActiveByType -> no active
        .mockResolvedValueOnce({ rows: [{ ...newModel, status: 'active' }] }); // updateStatus

      const result = await service.activateModel('m-new', {});

      expect(result.previousActiveId).toBeNull();
      expect(result.status).toBe('active');
    });

    it('应该在 force=true 时强制替换', async () => {
      const oldActive = makeModelRow({ id: 'm-old', status: 'active' });
      const newModel = makeModelRow({ id: 'm-new', status: 'registered' });

      mockPool.query
        .mockResolvedValueOnce({ rows: [newModel] })
        .mockResolvedValueOnce({ rows: [oldActive] })
        .mockResolvedValueOnce({ rows: [{ ...oldActive, status: 'testing' }] })
        .mockResolvedValueOnce({ rows: [{ ...newModel, status: 'active' }] });

      const result = await service.activateModel('m-new', { force: true });

      expect(result.status).toBe('active');
      expect(result.previousActiveId).toBe('m-old');
    });
  });

  // ================================================================
  // Service: configureABTest
  // ================================================================
  describe('Service.configureABTest', () => {
    it('应该在模型类型不匹配时抛出 INVALID_AB_TEST', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm1', model_type: 'risk' })] })
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm2', model_type: 'credit' })] });

      try {
        await service.configureABTest('m1', { traffic_percent: 20, compare_to_id: 'm2' });
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ModelVersionServiceError);
        expect((e as ModelVersionServiceError).message).toBe('A/B test models must be of same type');
        expect((e as ModelVersionServiceError).code).toBe('INVALID_AB_TEST');
      }
    });

    it('应该在 traffic_percent < 1 时抛出 INVALID_TRAFFIC_PERCENT', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm1', model_type: 'risk' })] })
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm2', model_type: 'risk' })] });

      try {
        await service.configureABTest('m1', { traffic_percent: 0, compare_to_id: 'm2' });
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ModelVersionServiceError);
        expect((e as ModelVersionServiceError).message).toBe('Traffic percent must be between 1 and 100');
        expect((e as ModelVersionServiceError).code).toBe('INVALID_TRAFFIC_PERCENT');
      }
    });

    it('应该在 traffic_percent > 100 时抛出 INVALID_TRAFFIC_PERCENT', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm1', model_type: 'risk' })] })
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm2', model_type: 'risk' })] });

      try {
        await service.configureABTest('m1', { traffic_percent: 101, compare_to_id: 'm2' });
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ModelVersionServiceError);
        expect((e as ModelVersionServiceError).code).toBe('INVALID_TRAFFIC_PERCENT');
      }
    });
  });

  // ================================================================
  // Service: rollback
  // ================================================================
  describe('Service.rollback', () => {
    it('应该在模型已经是 active 时抛出 ALREADY_ACTIVE', async () => {
      mockPool.query.mockResolvedValue({
        rows: [makeModelRow({ id: 'm1', status: 'active' })],
      });

      try {
        await service.rollback('m1');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ModelVersionServiceError);
        expect((e as ModelVersionServiceError).message).toBe('Cannot rollback active model');
        expect((e as ModelVersionServiceError).code).toBe('ALREADY_ACTIVE');
      }
    });

    it('应该在 archived 模型上抛出 INVALID_STATUS（activateModel内部校验）', async () => {
      // getModel returns archived, then activateModel's getModel returns archived -> INVALID_STATUS
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm1', status: 'archived' })] })
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm1', status: 'archived' })] });

      try {
        await service.rollback('m1');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ModelVersionServiceError);
        expect((e as ModelVersionServiceError).message).toBe('Cannot activate archived model');
        expect((e as ModelVersionServiceError).code).toBe('INVALID_STATUS');
      }
    });
  });

  // ================================================================
  // Service: archiveModel
  // ================================================================
  describe('Service.archiveModel', () => {
    it('应该在 active 模型上抛出 MODEL_ACTIVE', async () => {
      mockPool.query.mockResolvedValue({
        rows: [makeModelRow({ id: 'm1', status: 'active' })],
      });

      try {
        await service.archiveModel('m1');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ModelVersionServiceError);
        expect((e as ModelVersionServiceError).message).toBe('Cannot archive active model');
        expect((e as ModelVersionServiceError).code).toBe('MODEL_ACTIVE');
      }
    });

    it('应该返回 success=false 当 softDelete 未影响任何行', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm1', status: 'registered' })] })
        .mockResolvedValueOnce({ rowCount: 0 }); // softDelete returns 0

      const result = await service.archiveModel('m1');

      expect(result).toEqual({ success: false });
    });

    it('应该成功归档 testing 状态的模型', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm1', status: 'testing' })] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.archiveModel('m1');

      expect(result).toEqual({ success: true });
    });
  });

  // ================================================================
  // Service: listModels
  // ================================================================
  describe('Service.listModels', () => {
    it('应该返回分页元数据', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '50' }] })
        .mockResolvedValueOnce({ rows: [makeModelRow()] });

      const result = await service.listModels({ page: 3, limit: 10 });

      expect(result.total).toBe(50);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.data).toHaveLength(1);
    });

    it('应该使用默认分页值', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.listModels({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  // ================================================================
  // Service: getModelMetricsHistory
  // ================================================================
  describe('Service.getModelMetricsHistory', () => {
    it('应该返回指标历史', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { version: 'v2', metrics: { accuracy: 0.95 }, status: 'active', created_at: new Date('2026-01-02') },
          { version: 'v1', metrics: { accuracy: 0.88 }, status: 'archived', created_at: new Date('2026-01-01') },
        ],
      });

      const result = await service.getModelMetricsHistory('risk-assessment');

      expect(result.versions).toHaveLength(2);
      expect(result.versions[0].version).toBe('v2');
      expect(result.versions[0].metrics.accuracy).toBe(0.95);
      expect(result.versions[1].version).toBe('v1');
    });

    it('应该返回空列表当无匹配', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getModelMetricsHistory('nonexistent-type');

      expect(result.versions).toHaveLength(0);
    });

    it('应该为缺失 metrics 使用默认值', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { version: 'v1', metrics: null, status: 'registered', created_at: new Date() },
        ],
      });

      const result = await service.getModelMetricsHistory('test');

      expect(result.versions[0].metrics).toEqual({ accuracy: 0, precision: 0, recall: 0, f1Score: 0 });
    });

    it('应该按 created_at DESC 排序', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.getModelMetricsHistory('risk');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        ['risk'],
      );
    });
  });

  // ================================================================
  // Service: compareModels
  // ================================================================
  describe('Service.compareModels', () => {
    it('应该正确计算指标差异', async () => {
      const model1 = makeModelRow({
        id: 'm1',
        metrics: { accuracy: 0.80, precision: 0.75, recall: 0.70, f1Score: 0.72 },
        features: ['age', 'income'],
      });
      const model2 = makeModelRow({
        id: 'm2',
        metrics: { accuracy: 0.95, precision: 0.90, recall: 0.85, f1Score: 0.87 },
        features: ['income', 'credit_score'],
      });

      mockPool.query
        .mockResolvedValueOnce({ rows: [model1] })
        .mockResolvedValueOnce({ rows: [model2] });

      const result = await service.compareModels('m1', 'm2');

      expect(result.metricsDiff.accuracy).toBeCloseTo(0.15);
      expect(result.metricsDiff.precision).toBeCloseTo(0.15);
      expect(result.metricsDiff.recall).toBeCloseTo(0.15);
      expect(result.metricsDiff.f1Score).toBeCloseTo(0.15);
    });

    it('应该正确识别添加和移除的特征', async () => {
      const model1 = makeModelRow({
        id: 'm1',
        features: ['age', 'income', 'old_feature'],
      });
      const model2 = makeModelRow({
        id: 'm2',
        features: ['income', 'credit_score'],
      });

      mockPool.query
        .mockResolvedValueOnce({ rows: [model1] })
        .mockResolvedValueOnce({ rows: [model2] });

      const result = await service.compareModels('m1', 'm2');

      expect(result.featuresDiff.added).toContain('credit_score');
      expect(result.featuresDiff.removed).toContain('age');
      expect(result.featuresDiff.removed).toContain('old_feature');
      expect(result.featuresDiff.added).not.toContain('income');
      expect(result.featuresDiff.removed).not.toContain('income');
    });

    it('应该处理完全相同的特征列表', async () => {
      const model1 = makeModelRow({ id: 'm1', features: ['a', 'b'] });
      const model2 = makeModelRow({ id: 'm2', features: ['a', 'b'] });

      mockPool.query
        .mockResolvedValueOnce({ rows: [model1] })
        .mockResolvedValueOnce({ rows: [model2] });

      const result = await service.compareModels('m1', 'm2');

      expect(result.featuresDiff.added).toHaveLength(0);
      expect(result.featuresDiff.removed).toHaveLength(0);
    });

    it('应该在第一个模型不存在时抛出 MODEL_NOT_FOUND', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      try {
        await service.compareModels('nonexistent', 'm2');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ModelVersionServiceError);
        expect((e as ModelVersionServiceError).code).toBe('MODEL_NOT_FOUND');
      }
    });

    it('应该在第二个模型不存在时抛出 MODEL_NOT_FOUND', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeModelRow({ id: 'm1' })] })
        .mockResolvedValueOnce({ rows: [] });

      try {
        await service.compareModels('m1', 'nonexistent');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ModelVersionServiceError);
        expect((e as ModelVersionServiceError).code).toBe('MODEL_NOT_FOUND');
      }
    });

    it('应该处理空特征列表', async () => {
      const model1 = makeModelRow({ id: 'm1', features: [] });
      const model2 = makeModelRow({ id: 'm2', features: [] });

      mockPool.query
        .mockResolvedValueOnce({ rows: [model1] })
        .mockResolvedValueOnce({ rows: [model2] });

      const result = await service.compareModels('m1', 'm2');

      expect(result.featuresDiff.added).toHaveLength(0);
      expect(result.featuresDiff.removed).toHaveLength(0);
    });
  });

  // ================================================================
  // ModelVersionServiceError
  // ================================================================
  describe('ModelVersionServiceError', () => {
    it('应该继承 Error', () => {
      const error = new ModelVersionServiceError('test msg', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ModelVersionServiceError);
    });

    it('应该可被 catch 并通过 code 区分', () => {
      try {
        throw new ModelVersionServiceError('duplicate', 'DUPLICATE_MODEL');
      } catch (e) {
        if (e instanceof ModelVersionServiceError) {
          expect(e.code).toBe('DUPLICATE_MODEL');
          expect(e.message).toBe('duplicate');
        }
      }
    });
  });
});
