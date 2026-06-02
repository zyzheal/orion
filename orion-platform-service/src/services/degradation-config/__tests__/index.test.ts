/**
 * Degradation Config Index - Re-export + Behavior Tests
 *
 * 覆盖范围:
 * - Re-export 验证 (DegradationConfigService, DegradationConfigRepository, 类型, Error)
 * - DegradationConfigService 行为:
 *   - initializeDefaults: 默认配置初始化、幂等性、部分失败容错
 *   - getConfig: 正常查询、不存在时抛 CONFIG_NOT_FOUND
 *   - listConfigs: 返回 data 包装、空列表
 *   - updateConfig: 创建新配置、更新已有、审计日志、UPDATE_FAILED 错误
 *   - deleteConfig: 成功删除、不存在时返回 false、审计日志
 *   - importConfigs: 批量导入、混合成功失败、缺少 scenario
 *   - exportConfigs: 导出列表、审计日志
 *   - getAuditHistory: 按场景过滤、自定义 limit、默认 limit 50
 *   - validateConfig: 有效配置、无效 strategy/fallback/cache_ttl/scenario
 *   - getActiveStrategy: 主策略+回退策略、配置不存在时抛错
 * - DegradationConfigRepository 行为:
 *   - findByScenario: 查找、未找到返回 null
 *   - listAll: 返回所有配置按 scenario 排序
 *   - create: 创建配置、默认值、可选参数
 *   - update: 更新各字段、多字段同时更新、空更新回退
 *   - delete: 成功删除、不存在返回 false
 *   - createAuditLog: 各种 action 类型、null 参数处理
 * - 错误处理与边界条件
 */

import {
  DegradationConfigService,
  DegradationConfigRepository,
  DegradationConfig,
  DegradationStrategy,
  UpdateConfigInput,
  ConfigAuditLog,
  DegradationConfigServiceError,
} from '../index';

// ==================== Mock Helpers ====================

function createMockPool() {
  return { query: jest.fn() };
}

function makeConfig(overrides: Partial<DegradationConfig> = {}): DegradationConfig {
  return {
    id: 'config-1',
    tenant_id: null,
    scenario: 'risk-assessment',
    strategy: 'rule-engine',
    fallback_strategies: ['template', 'cache', 'default'],
    rule_set: { conditions: [] },
    template_name: 'risk-assessment-default',
    cache_ttl: 300,
    notify_on_degradation: true,
    default_response: { risk_level: 'medium' },
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeAuditLog(overrides: Partial<ConfigAuditLog> = {}): ConfigAuditLog {
  return {
    id: 'audit-1',
    scenario: 'risk-assessment',
    action: 'update',
    old_config: null,
    new_config: null,
    created_by: null,
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

// ==================== Re-export Tests ====================

describe('Degradation Config Index (Re-exports)', () => {
  describe('DegradationConfigService', () => {
    it('should export DegradationConfigService class', () => {
      expect(DegradationConfigService).toBeDefined();
      expect(typeof DegradationConfigService).toBe('function');
    });

    it('should be instantiable', () => {
      const mockPool = createMockPool();
      const instance = new DegradationConfigService(mockPool as any);
      expect(instance).toBeInstanceOf(DegradationConfigService);
    });

    it('should have expected methods', () => {
      const mockPool = createMockPool();
      const instance = new DegradationConfigService(mockPool as any);
      expect(typeof instance.initializeDefaults).toBe('function');
      expect(typeof instance.getConfig).toBe('function');
      expect(typeof instance.listConfigs).toBe('function');
      expect(typeof instance.updateConfig).toBe('function');
      expect(typeof instance.deleteConfig).toBe('function');
      expect(typeof instance.importConfigs).toBe('function');
      expect(typeof instance.exportConfigs).toBe('function');
      expect(typeof instance.getAuditHistory).toBe('function');
      expect(typeof instance.validateConfig).toBe('function');
      expect(typeof instance.getActiveStrategy).toBe('function');
    });
  });

  describe('DegradationConfigRepository', () => {
    it('should export DegradationConfigRepository class', () => {
      expect(DegradationConfigRepository).toBeDefined();
      expect(typeof DegradationConfigRepository).toBe('function');
    });

    it('should be instantiable', () => {
      const mockPool = createMockPool();
      const instance = new DegradationConfigRepository(mockPool as any);
      expect(instance).toBeInstanceOf(DegradationConfigRepository);
    });

    it('should have expected methods', () => {
      const mockPool = createMockPool();
      const instance = new DegradationConfigRepository(mockPool as any);
      expect(typeof instance.findByScenario).toBe('function');
      expect(typeof instance.listAll).toBe('function');
      expect(typeof instance.create).toBe('function');
      expect(typeof instance.update).toBe('function');
      expect(typeof instance.delete).toBe('function');
      expect(typeof instance.createAuditLog).toBe('function');
    });
  });

  describe('DegradationConfigServiceError', () => {
    it('should export DegradationConfigServiceError class', () => {
      expect(DegradationConfigServiceError).toBeDefined();
      expect(typeof DegradationConfigServiceError).toBe('function');
    });

    it('should be an Error subclass', () => {
      const error = new DegradationConfigServiceError('test', 'TEST');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DegradationConfigServiceError);
    });

    it('should have message and code properties', () => {
      const error = new DegradationConfigServiceError('msg', 'code');
      expect(error.message).toBe('msg');
      expect(error.code).toBe('code');
      expect(error.name).toBe('DegradationConfigServiceError');
    });
  });
});

// ==================== Behavior Tests ====================

describe('DegradationConfigService behavior via index', () => {
  let pool: ReturnType<typeof createMockPool>;
  let service: DegradationConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = createMockPool();
    service = new DegradationConfigService(pool as any);
  });

  // ==================== initializeDefaults ====================

  describe('initializeDefaults', () => {
    it('should create default configs if they do not exist', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // findByScenario risk-assessment
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'risk-assessment' })] }) // create
        .mockResolvedValueOnce({ rows: [] }) // findByScenario test-selection
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'test-selection' })] }) // create
        .mockResolvedValueOnce({ rows: [] }) // findByScenario code-review
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'code-review' })] }); // create

      await service.initializeDefaults();

      expect(pool.query).toHaveBeenCalledTimes(6);
    });

    it('should skip existing configs (idempotent)', async () => {
      pool.query.mockResolvedValue({ rows: [makeConfig()] });

      await service.initializeDefaults();

      // 3 findByScenario calls, 0 creates
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    it('should continue if one config creation fails', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'test-selection' })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'code-review' })] });

      await expect(service.initializeDefaults()).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledTimes(6);
    });
  });

  // ==================== getConfig ====================

  describe('getConfig', () => {
    it('should return config by scenario', async () => {
      const config = makeConfig({ scenario: 'risk-assessment' });
      pool.query.mockResolvedValue({ rows: [config] });

      const result = await service.getConfig('risk-assessment');

      expect(result.scenario).toBe('risk-assessment');
      expect(result.strategy).toBe('rule-engine');
    });

    it('should throw CONFIG_NOT_FOUND when config does not exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await expect(service.getConfig('unknown-scenario')).rejects.toThrow(DegradationConfigServiceError);
      await expect(service.getConfig('unknown-scenario')).rejects.toThrow('Configuration not found for scenario: unknown-scenario');
    });

    it('should use CONFIG_NOT_FOUND error code', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      try {
        await service.getConfig('nonexistent');
        fail('Expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(DegradationConfigServiceError);
        expect((err as DegradationConfigServiceError).code).toBe('CONFIG_NOT_FOUND');
      }
    });
  });

  // ==================== listConfigs ====================

  describe('listConfigs', () => {
    it('should return data-wrapped config list', async () => {
      const configs = [makeConfig({ id: '1', scenario: 'a' }), makeConfig({ id: '2', scenario: 'b' })];
      pool.query.mockResolvedValue({ rows: configs });

      const result = await service.listConfigs();

      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(2);
    });

    it('should return empty data array when no configs exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await service.listConfigs();

      expect(result.data).toEqual([]);
    });
  });

  // ==================== updateConfig ====================

  describe('updateConfig', () => {
    it('should create new config if it does not exist', async () => {
      const newConfig = makeConfig({ scenario: 'new-s', strategy: 'template' });
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // findByScenario
        .mockResolvedValueOnce({ rows: [newConfig] }) // create
        .mockResolvedValueOnce({ rows: [] }); // audit log

      const result = await service.updateConfig('new-s', { scenario: 'new-s', strategy: 'template' });

      expect(result.strategy).toBe('template');
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    it('should update existing config', async () => {
      const oldConfig = makeConfig({ strategy: 'rule-engine' });
      const newConfig = makeConfig({ strategy: 'template' });
      pool.query
        .mockResolvedValueOnce({ rows: [oldConfig] })
        .mockResolvedValueOnce({ rows: [newConfig] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.updateConfig('risk-assessment', { scenario: 'risk-assessment', strategy: 'template' });

      expect(result.strategy).toBe('template');
    });

    it('should throw UPDATE_FAILED when update returns null', async () => {
      const oldConfig = makeConfig();
      pool.query
        .mockResolvedValueOnce({ rows: [oldConfig] })
        .mockResolvedValueOnce({ rows: [] });

      try {
        await service.updateConfig('risk-assessment', { scenario: 'risk-assessment' });
        fail('Expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(DegradationConfigServiceError);
        expect((err as DegradationConfigServiceError).code).toBe('UPDATE_FAILED');
      }
    });

    it('should create audit log for create action', async () => {
      const newConfig = makeConfig({ scenario: 'new-s' });
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [newConfig] })
        .mockResolvedValueOnce({ rows: [] });

      await service.updateConfig('new-s', { scenario: 'new-s' }, 'user-1');

      const auditCall = pool.query.mock.calls[2];
      expect(auditCall[0]).toContain('INSERT INTO degradation_config_audit');
      expect(auditCall[1][1]).toBe('create');
      expect(auditCall[1][4]).toBe('user-1');
    });

    it('should create audit log for update action', async () => {
      const oldConfig = makeConfig({ strategy: 'rule-engine' });
      const newConfig = makeConfig({ strategy: 'template' });
      pool.query
        .mockResolvedValueOnce({ rows: [oldConfig] })
        .mockResolvedValueOnce({ rows: [newConfig] })
        .mockResolvedValueOnce({ rows: [] });

      await service.updateConfig('risk-assessment', { strategy: 'template' }, 'user-2');

      const auditCall = pool.query.mock.calls[2];
      expect(auditCall[1][1]).toBe('update');
      expect(auditCall[1][4]).toBe('user-2');
    });
  });

  // ==================== deleteConfig ====================

  describe('deleteConfig', () => {
    it('should delete config successfully', async () => {
      const config = makeConfig();
      pool.query
        .mockResolvedValueOnce({ rows: [config] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.deleteConfig('risk-assessment', 'user-1');

      expect(result.success).toBe(true);
    });

    it('should return success: false when config does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.deleteConfig('nonexistent');

      expect(result.success).toBe(false);
    });

    it('should return success: false when delete rowCount is 0', async () => {
      const config = makeConfig();
      pool.query
        .mockResolvedValueOnce({ rows: [config] })
        .mockResolvedValueOnce({ rowCount: 0 });

      const result = await service.deleteConfig('risk-assessment');

      expect(result.success).toBe(false);
    });

    it('should create audit log on successful delete', async () => {
      const config = makeConfig();
      pool.query
        .mockResolvedValueOnce({ rows: [config] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });

      await service.deleteConfig('risk-assessment', 'user-1');

      const auditCall = pool.query.mock.calls[2];
      expect(auditCall[1][1]).toBe('delete');
      expect(auditCall[1][4]).toBe('user-1');
    });
  });

  // ==================== importConfigs ====================

  describe('importConfigs', () => {
    it('should import multiple configs successfully', async () => {
      const configs: UpdateConfigInput[] = [
        { scenario: 'scenario-1', strategy: 'template' },
        { scenario: 'scenario-2', strategy: 'cache' },
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'scenario-1' })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'scenario-2' })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }); // import audit

      const result = await service.importConfigs(configs, 'user-1');

      expect(result.imported).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle missing scenario field', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // import audit

      const result = await service.importConfigs([{ strategy: 'template' } as UpdateConfigInput]);

      expect(result.imported).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Missing scenario field');
    });

    it('should handle errors during import', async () => {
      pool.query
        .mockRejectedValueOnce(new Error('DB connection failed'))
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.importConfigs([{ scenario: 'fail-scenario', strategy: 'template' }]);

      expect(result.imported).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('fail-scenario');
    });

    it('should handle mixed success and failure', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'good' })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.importConfigs([
        { scenario: 'good', strategy: 'template' },
        { scenario: 'bad', strategy: 'manual' },
      ]);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should handle empty config array', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.importConfigs([]);

      expect(result.imported).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  // ==================== exportConfigs ====================

  describe('exportConfigs', () => {
    it('should return config list', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [makeConfig({ id: '1' }), makeConfig({ id: '2' })] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.exportConfigs();

      expect(result.configs).toHaveLength(2);
    });

    it('should create export audit log', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [makeConfig()] })
        .mockResolvedValueOnce({ rows: [] });

      await service.exportConfigs();

      const auditCall = pool.query.mock.calls[1];
      expect(auditCall[0]).toContain("'export'");
    });

    it('should return empty list when no configs exist', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.exportConfigs();

      expect(result.configs).toHaveLength(0);
    });
  });

  // ==================== getAuditHistory ====================

  describe('getAuditHistory', () => {
    it('should return audit logs for a scenario', async () => {
      const logs = [makeAuditLog({ id: 'a1' }), makeAuditLog({ id: 'a2' })];
      pool.query.mockResolvedValue({ rows: logs });

      const result = await service.getAuditHistory('risk-assessment');

      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE scenario = $1'), ['risk-assessment']);
    });

    it('should return all audit logs when no scenario specified', async () => {
      pool.query.mockResolvedValue({ rows: [makeAuditLog()] });

      await service.getAuditHistory();

      const queryStr = pool.query.mock.calls[0][0] as string;
      expect(queryStr).not.toContain('WHERE');
    });

    it('should support custom limit', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await service.getAuditHistory('risk-assessment', 100);

      expect(pool.query.mock.calls[0][0]).toContain('LIMIT 100');
    });

    it('should use default limit 50', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await service.getAuditHistory('risk-assessment');

      expect(pool.query.mock.calls[0][0]).toContain('LIMIT 50');
    });
  });

  // ==================== validateConfig ====================

  describe('validateConfig', () => {
    it('should validate a valid config', async () => {
      const result = await service.validateConfig({
        scenario: 'risk-assessment',
        strategy: 'rule-engine',
        fallback_strategies: ['template', 'cache'],
        cache_ttl: 300,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid strategy', async () => {
      const result = await service.validateConfig({
        scenario: 'test',
        strategy: 'invalid-strategy' as any,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid strategy: invalid-strategy');
    });

    it('should detect invalid fallback_strategies', async () => {
      const result = await service.validateConfig({
        scenario: 'test',
        fallback_strategies: ['template', 'bad-strategy'],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid fallback strategy: bad-strategy');
    });

    it('should detect cache_ttl out of range (negative)', async () => {
      const result = await service.validateConfig({ scenario: 'test', cache_ttl: -1 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cache_ttl must be between 0 and 86400 seconds');
    });

    it('should detect cache_ttl out of range (over 86400)', async () => {
      const result = await service.validateConfig({ scenario: 'test', cache_ttl: 90000 });

      expect(result.valid).toBe(false);
    });

    it('should detect invalid scenario name format', async () => {
      const result = await service.validateConfig({ scenario: 'Risk-Assessment' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('scenario must be lowercase alphanumeric with hyphens');
    });

    it('should accept valid scenario names', async () => {
      for (const scenario of ['risk-assessment', 'test', 'code-review-2', 'a1b2']) {
        const result = await service.validateConfig({ scenario });
        expect(result.valid).toBe(true);
      }
    });

    it('should return multiple validation errors at once', async () => {
      const result = await service.validateConfig({
        scenario: 'Invalid!',
        strategy: 'bad' as any,
        cache_ttl: -100,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should support all 5 strategy types', async () => {
      for (const strategy of ['rule-engine', 'template', 'cache', 'manual', 'default'] as const) {
        const result = await service.validateConfig({ scenario: 'test', strategy });
        expect(result.valid).toBe(true);
      }
    });
  });

  // ==================== getActiveStrategy ====================

  describe('getActiveStrategy', () => {
    it('should return primary strategy and fallbacks', async () => {
      const config = makeConfig({ strategy: 'rule-engine', fallback_strategies: ['template', 'cache', 'default'] });
      pool.query.mockResolvedValue({ rows: [config] });

      const result = await service.getActiveStrategy('risk-assessment');

      expect(result.primary).toBe('rule-engine');
      expect(result.fallbacks).toEqual(['template', 'cache', 'default']);
      expect(result.config).toEqual(config);
    });

    it('should throw when config does not exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await expect(service.getActiveStrategy('unknown')).rejects.toThrow(DegradationConfigServiceError);
    });

    it('should handle empty fallback_strategies', async () => {
      const config = makeConfig({ fallback_strategies: [] });
      pool.query.mockResolvedValue({ rows: [config] });

      const result = await service.getActiveStrategy('risk-assessment');

      expect(result.fallbacks).toEqual([]);
    });
  });
});

// ==================== Repository Behavior Tests ====================

describe('DegradationConfigRepository behavior via index', () => {
  let pool: ReturnType<typeof createMockPool>;
  let repo: DegradationConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = createMockPool();
    repo = new DegradationConfigRepository(pool as any);
  });

  describe('findByScenario', () => {
    it('should return matching config', async () => {
      const config = makeConfig();
      pool.query.mockResolvedValue({ rows: [config] });

      const result = await repo.findByScenario('risk-assessment');

      expect(result).toEqual(config);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM degradation_configs WHERE scenario = $1',
        ['risk-assessment']
      );
    });

    it('should return null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByScenario('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listAll', () => {
    it('should return all configs ordered by scenario', async () => {
      const configs = [makeConfig({ id: '1', scenario: 'alpha' }), makeConfig({ id: '2', scenario: 'beta' })];
      pool.query.mockResolvedValue({ rows: configs });

      const result = await repo.listAll();

      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM degradation_configs ORDER BY scenario');
    });

    it('should return empty array when no configs exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.listAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('should create a new config', async () => {
      const created = makeConfig({ id: 'new-1', scenario: 'new-scenario' });
      pool.query.mockResolvedValue({ rows: [created] });

      const result = await repo.create({ scenario: 'new-scenario', strategy: 'rule-engine', fallback_strategies: ['template'] });

      expect(result.id).toBe('new-1');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO degradation_configs'), expect.any(Array));
    });

    it('should use default values when not specified', async () => {
      pool.query.mockResolvedValue({ rows: [makeConfig({ scenario: 'minimal' })] });

      await repo.create({ scenario: 'minimal' });

      const args = pool.query.mock.calls[0][1];
      expect(args[0]).toBeNull(); // tenant_id
      expect(args[2]).toBe('rule-engine'); // strategy default
      expect(args[3]).toEqual([]); // fallback_strategies default
    });

    it('should pass tenant_id when provided', async () => {
      pool.query.mockResolvedValue({ rows: [makeConfig({ tenant_id: 'tenant-1' })] });

      await repo.create({ scenario: 'test', tenant_id: 'tenant-1' });

      expect(pool.query.mock.calls[0][1][0]).toBe('tenant-1');
    });
  });

  describe('update', () => {
    it('should update strategy field', async () => {
      const updated = makeConfig({ strategy: 'template' });
      pool.query.mockResolvedValue({ rows: [updated] });

      const result = await repo.update('risk-assessment', { strategy: 'template' });

      expect(result!.strategy).toBe('template');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE degradation_configs'), expect.any(Array));
    });

    it('should fall back to findByScenario when no update fields', async () => {
      const config = makeConfig();
      pool.query.mockResolvedValue({ rows: [config] });

      const result = await repo.update('risk-assessment', {});

      expect(result).toEqual(config);
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM degradation_configs WHERE scenario = $1', ['risk-assessment']);
    });

    it('should return null when config does not exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.update('nonexistent', { strategy: 'template' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete config and return true', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.delete('risk-assessment');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM degradation_configs WHERE scenario = $1', ['risk-assessment']);
    });

    it('should return false when config does not exist', async () => {
      pool.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('createAuditLog', () => {
    it('should create audit log', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'a1' }] });

      await repo.createAuditLog('risk-assessment', 'update', { strategy: 'old' }, { strategy: 'new' }, 'user-1');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO degradation_config_audit'),
        ['risk-assessment', 'update', '{"strategy":"old"}', '{"strategy":"new"}', 'user-1']
      );
    });

    it('should support null old_config and new_config', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'a1' }] });

      await repo.createAuditLog('risk-assessment', 'create', null, null);

      const args = pool.query.mock.calls[0][1];
      expect(args[2]).toBe('null');
      expect(args[3]).toBe('null');
      expect(args[4]).toBeNull();
    });

    it('should support all action types', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      for (const action of ['create', 'update', 'delete', 'import', 'export'] as const) {
        await repo.createAuditLog('scenario', action, null, null);
      }

      expect(pool.query).toHaveBeenCalledTimes(5);
    });
  });
});
