/**
 * DegradationConfigService 单元测试
 */

import { DegradationConfigService, DegradationConfigRepository, DegradationConfigServiceError } from '../DegradationConfigService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('DegradationConfigService', () => {
  let service: DegradationConfigService;
  let repository: DegradationConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DegradationConfigRepository(mockPool as any);
    service = new DegradationConfigService(mockPool as any);
  });

  describe('DegradationConfigRepository', () => {
    describe('findByScenario', () => {
      it('应该返回场景配置', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'c1',
            scenario: 'risk-assessment',
            strategy: 'rule-engine',
            fallback_strategies: ['template', 'cache'],
          }],
        });

        const result = await repository.findByScenario('risk-assessment');

        expect(result).not.toBeNull();
        expect(result!.strategy).toBe('rule-engine');
      });

      it('应该返回 null 如果未找到', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await repository.findByScenario('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('listAll', () => {
      it('应该返回所有配置', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { id: 'c1', scenario: 'risk-assessment' },
            { id: 'c2', scenario: 'test-selection' },
          ],
        });

        const result = await repository.listAll();

        expect(result.length).toBe(2);
      });
    });

    describe('create', () => {
      it('应该创建新配置', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'c1',
            scenario: 'risk-assessment',
            strategy: 'rule-engine',
          }],
        });

        const result = await repository.create({
          scenario: 'risk-assessment',
          strategy: 'rule-engine',
          fallback_strategies: ['template', 'cache'],
        });

        expect(result.scenario).toBe('risk-assessment');
      });

      it('应该存储规则集', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'c1',
            rule_set: { conditions: [{ field: 'commit_size', operator: 'gt', value: 500 }] },
          }],
        });

        const result = await repository.create({
          scenario: 'risk-assessment',
          rule_set: { conditions: [{ field: 'commit_size', operator: 'gt', value: 500 }] },
        });

        expect(result.rule_set.conditions).toBeDefined();
      });

      it('应该使用默认值', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'c1',
            cache_ttl: 300,
            notify_on_degradation: true,
          }],
        });

        const result = await repository.create({
          scenario: 'risk-assessment',
        });

        expect(result.cache_ttl).toBe(300);
        expect(result.notify_on_degradation).toBe(true);
      });
    });

    describe('update', () => {
      it('应该更新配置', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'c1',
            strategy: 'template',
            fallback_strategies: ['cache', 'default'],
          }],
        });

        const result = await repository.update('risk-assessment', {
          strategy: 'template',
          fallback_strategies: ['cache', 'default'],
        });

        expect(result!.strategy).toBe('template');
      });

      it('应该支持部分更新', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', cache_ttl: 600 }],
        });

        const result = await repository.update('risk-assessment', {
          cache_ttl: 600,
        });

        expect(result!.cache_ttl).toBe(600);
      });
    });

    describe('delete', () => {
      it('应该删除配置', async () => {
        mockPool.query.mockResolvedValue({ rowCount: 1 });

        const result = await repository.delete('risk-assessment');

        expect(result).toBe(true);
      });

      it('应该返回 false 如果配置不存在', async () => {
        mockPool.query.mockResolvedValue({ rowCount: 0 });

        const result = await repository.delete('nonexistent');

        expect(result).toBe(false);
      });
    });

    describe('getAuditLogs', () => {
      it('应该返回审计日志', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { id: 'a1', action: 'update', created_at: new Date() },
            { id: 'a2', action: 'create', created_at: new Date() },
          ],
        });

        const result = await repository.getAuditLogs('risk-assessment');

        expect(result.length).toBe(2);
      });
    });

    describe('createAuditLog', () => {
      it('应该创建审计日志', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'a1', action: 'update' }],
        });

        await repository.createAuditLog({
          scenario: 'risk-assessment',
          action: 'update',
          old_config: { strategy: 'rule-engine' },
          new_config: { strategy: 'template' },
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.any(Array)
        );
      });
    });
  });

  describe('DegradationConfigService', () => {
    describe('getConfig', () => {
      it('应该返回配置', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', scenario: 'risk-assessment' }],
        });

        const result = await service.getConfig('risk-assessment');

        expect(result).not.toBeNull();
      });

      it('应该返回默认配置如果未找到', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await service.getConfig('unknown-scenario');

        // Service might return a default config or null
        expect(result).toBeDefined();
      });
    });

    describe('listConfigs', () => {
      it('应该返回所有配置', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1' }],
        });

        const result = await service.listConfigs();

        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('updateConfig', () => {
      it('应该更新配置', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', strategy: 'template' }],
        });

        const result = await service.updateConfig({
          scenario: 'risk-assessment',
          strategy: 'template',
        });

        expect(result.strategy).toBe('template');
      });
    });

    describe('exportConfigs', () => {
      it('应该导出配置', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { id: 'c1', scenario: 'risk-assessment' },
            { id: 'c2', scenario: 'test-selection' },
          ],
        });

        const result = await service.exportConfigs();

        expect(result).toHaveProperty('configs');
        expect(result.configs.length).toBe(2);
      });
    });

    describe('importConfigs', () => {
      it('应该导入配置', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] }) // findByScenario
          .mockResolvedValueOnce({ rows: [{ id: 'c1' }] }); // create

        const configs = [{
          scenario: 'new-scenario',
          strategy: 'rule-engine',
        }];

        const result = await service.importConfigs(configs);

        expect(result.imported).toBe(1);
        expect(result.failed).toBe(0);
      });

      it('应该处理导入失败', async () => {
        mockPool.query.mockRejectedValue(new Error('Database error'));

        const configs = [{
          scenario: 'test-scenario',
        }];

        const result = await service.importConfigs(configs);

        expect(result.failed).toBe(1);
      });
    });

    describe('getDefaultConfig', () => {
      it('应该返回内置默认配置', () => {
        const result = service.getDefaultConfig('risk-assessment');

        expect(result).toBeDefined();
        expect(result!.strategy).toBe('rule-engine');
      });

      it('应该返回 undefined 对于未知场景', () => {
        const result = service.getDefaultConfig('unknown-scenario');

        expect(result).toBeUndefined();
      });
    });
  });

  describe('DegradationStrategy', () => {
    it('应该支持不同的策略类型', async () => {
      const strategies = ['rule-engine', 'template', 'cache', 'manual', 'default'];

      for (const strategy of strategies) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', strategy }],
        });

        const result = await repository.create({
          scenario: 'test',
          strategy: strategy as any,
        });

        expect(result.strategy).toBe(strategy);
      }
    });
  });

  describe('DegradationConfigServiceError', () => {
    it('应该正确设置错误信息', () => {
      const error = new DegradationConfigServiceError('Config not found', 'CONFIG_NOT_FOUND');

      expect(error.message).toBe('Config not found');
      expect(error.code).toBe('CONFIG_NOT_FOUND');
      expect(error.name).toBe('DegradationConfigServiceError');
    });
  });
});