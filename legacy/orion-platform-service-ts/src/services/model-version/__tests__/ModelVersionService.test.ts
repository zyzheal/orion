/**
 * ModelVersionService 单元测试
 */

import { ModelVersionService, ModelVersionRepository, ModelVersionServiceError } from '../ModelVersionService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('ModelVersionService', () => {
  let service: ModelVersionService;
  let repository: ModelVersionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ModelVersionRepository(mockPool as any);
    service = new ModelVersionService(mockPool as any);
  });

  describe('ModelVersionRepository', () => {
    describe('findById', () => {
      it('应该返回模型版本', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'm1',
            name: 'risk-model',
            model_type: 'risk-assessment',
            version: 'v2.1.0',
            status: 'active',
            metrics: { accuracy: 0.92 },
          }],
        });

        const result = await repository.findById('m1');

        expect(result).not.toBeNull();
        expect(result!.name).toBe('risk-model');
      });

      it('应该返回 null 如果未找到', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await repository.findById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('findByTypeAndVersion', () => {
      it('应该根据类型和版本查找', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'm1', model_type: 'risk', version: 'v2.1' }],
        });

        const result = await repository.findByTypeAndVersion('risk', 'v2.1');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('model_type = $1 AND version = $2'),
          ['risk', 'v2.1']
        );
      });
    });

    describe('findActiveByType', () => {
      it('应该返回活跃模型', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'm1', status: 'active' }],
        });

        const result = await repository.findActiveByType('risk-assessment');

        expect(result!.status).toBe('active');
      });

      it('应该返回最新活跃模型', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'm2', created_at: new Date('2024-01-02') }],
        });

        await repository.findActiveByType('risk');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY created_at DESC'),
          ['risk']
        );
      });
    });

    describe('list', () => {
      it('应该返回模型列表', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 'm1' }] });

        const result = await repository.list({});

        expect(result.data.length).toBe(1);
        expect(result.total).toBe(10);
      });

      it('应该支持按类型过滤', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 5 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repository.list({ type: 'risk-assessment' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('model_type'),
          expect.arrayContaining(['risk-assessment'])
        );
      });

      it('应该支持按状态过滤', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 3 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repository.list({ status: 'active' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('status'),
          expect.arrayContaining(['active'])
        );
      });

      it('应该支持分页', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 100 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repository.list({ page: 2, limit: 20 });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.arrayContaining([20, 20])
        );
      });
    });

    describe('create', () => {
      it('应该创建新模型版本', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'm1',
            name: 'new-model',
            status: 'registered',
          }],
        });

        const result = await repository.create({
          name: 'new-model',
          model_type: 'risk',
          version: 'v1.0',
        });

        expect(result.name).toBe('new-model');
        expect(result.status).toBe('registered');
      });

      it('应该存储模型指标', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'm1',
            metrics: { accuracy: 0.95, precision: 0.90 },
          }],
        });

        const result = await repository.create({
          name: 'model',
          model_type: 'risk',
          version: 'v1',
          metrics: { accuracy: 0.95, precision: 0.90 },
        });

        expect(result.metrics.accuracy).toBe(0.95);
      });

      it('应该存储训练信息', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'm1',
            training_info: { samplesCount: 10000 },
          }],
        });

        const result = await repository.create({
          name: 'model',
          model_type: 'risk',
          version: 'v1',
          training_info: { samplesCount: 10000, framework: 'tensorflow' },
        });

        expect(result.training_info.samplesCount).toBe(10000);
      });
    });

    describe('updateStatus', () => {
      it('应该更新模型状态', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'm1', status: 'active' }],
        });

        const result = await repository.updateStatus('m1', 'active');

        expect(result!.status).toBe('active');
      });
    });

    describe('updateABTestConfig', () => {
      it('应该配置 A/B 测试', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'm1',
            ab_test_config: { trafficPercent: 10, compareToId: 'm2' },
          }],
        });

        const result = await repository.updateABTestConfig('m1', {
          trafficPercent: 10,
          compareToId: 'm2',
          startedAt: null,
          results: null,
        });

        expect(result!.ab_test_config.trafficPercent).toBe(10);
      });
    });

    describe('mapRow', () => {
      it('应该正确映射数据库行', () => {
        const row = {
          id: 'm1',
          name: 'model',
          model_type: 'risk',
          version: 'v1',
          status: 'active',
          features: ['feature1'],
          metrics: { accuracy: 0.9 },
          training_info: { samplesCount: 1000 },
          ab_test_config: {},
          created_at: new Date(),
        };

        const result = (repository as any).mapRow(row);

        expect(result.id).toBe('m1');
        expect(result.features).toContain('feature1');
        expect(result.metrics.accuracy).toBe(0.9);
      });
    });
  });

  describe('ModelVersionService', () => {
    describe('registerModel', () => {
      it('应该注册新模型', async () => {
        // First query: findByTypeAndVersion (no existing model)
        // Second query: create
        mockPool.query
          .mockResolvedValueOnce({ rows: [] }) // No existing model
          .mockResolvedValueOnce({ rows: [{ id: 'm1', status: 'registered' }] });

        const result = await service.registerModel({
          name: 'risk-model',
          model_type: 'risk-assessment',
          version: 'v2.0',
        });

        expect(result.status).toBe('registered');
      });
    });

    describe('getModel', () => {
      it('应该返回模型', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'm1' }],
        });

        const result = await service.getModel('m1');

        expect(result).not.toBeNull();
      });
    });

    describe('getActiveModel', () => {
      it('应该返回活跃模型', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'm1', status: 'active' }],
        });

        const result = await service.getActiveModel('risk-assessment');

        expect(result!.status).toBe('active');
      });
    });

    describe('activateModel', () => {
      it('应该激活模型', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 'm1', status: 'testing' }] }) // findById
          .mockResolvedValueOnce({ rows: [{ id: 'm1', status: 'active' }] }); // updateStatus

        const result = await service.activateModel('m1');

        expect(result.status).toBe('active');
      });
    });

    describe('archiveModel', () => {
      it('应该归档模型', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 'm1', status: 'testing' }] }) // getModel
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // softDelete (rowCount > 0)

        const result = await service.archiveModel('m1');

        expect(result.success).toBe(true);
      });
    });

    describe('configureABTest', () => {
      it('应该配置 A/B 测试', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'm1', ab_test_config: { trafficPercent: 20 } }],
        });

        const result = await service.configureABTest('m1', {
          traffic_percent: 20,
          compare_to_id: 'm2',
        });

        expect(result.ab_test_config.trafficPercent).toBe(20);
      });
    });

    describe('rollback', () => {
      it('应该回滚到指定版本', async () => {
        // rollback calls: getModel -> activateModel(getModel, findActiveByType, updateStatus) -> getModel
        // Model must be in non-active, non-archived state (e.g. 'testing') to pass activation check
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 'm1', status: 'testing' }] }) // rollback's getModel
          .mockResolvedValueOnce({ rows: [{ id: 'm1', status: 'testing' }] }) // activateModel's getModel
          .mockResolvedValueOnce({ rows: [] }) // findActiveByType (no active)
          .mockResolvedValueOnce({ rows: [{ id: 'm1', status: 'active' }] }) // updateStatus to active
          .mockResolvedValueOnce({ rows: [{ id: 'm1', status: 'active' }] }); // rollback's final getModel

        const result = await service.rollback('m1');

        expect(result).toBeDefined();
        expect(result.status).toBe('active');
      });
    });

    describe('listModels', () => {
      it('应该返回模型列表', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // count query
          .mockResolvedValueOnce({ rows: [{ id: 'm1', status: 'active', features: '[]', metrics: '{}', training_info: '{}', ab_test_config: '{}', created_at: new Date() }] }); // data query

        const result = await service.listModels({});

        expect(result.data.length).toBe(1);
        expect(result.total).toBe(5);
      });
    });
  });

  describe('ModelVersionServiceError', () => {
    it('应该正确设置错误信息', () => {
      const error = new ModelVersionServiceError('Model not found', 'MODEL_NOT_FOUND');

      expect(error.message).toBe('Model not found');
      expect(error.code).toBe('MODEL_NOT_FOUND');
      expect(error.name).toBe('ModelVersionServiceError');
    });
  });
});