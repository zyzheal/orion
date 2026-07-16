/**
 * DegradationConfigService 综合单元测试
 *
 * 覆盖范围:
 * - DegradationConfigRepository: findByScenario, listAll, create, update, delete, createAuditLog
 * - DegradationConfigService: initializeDefaults, getConfig, listConfigs, updateConfig,
 *   deleteConfig, importConfigs, exportConfigs, getAuditHistory, validateConfig, getActiveStrategy
 * - DegradationConfigServiceError
 * - 边界条件和错误处理
 */

import {
  DegradationConfigService,
  DegradationConfigRepository,
  DegradationConfigServiceError,
  DegradationConfig,
  UpdateConfigInput,
  ConfigAuditLog,
} from '../DegradationConfigService';

// ==================== Mock Helpers ====================

function createMockPool() {
  return {
    query: jest.fn(),
  };
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

// ==================== Tests ====================

describe('DegradationConfigServiceError', () => {
  it('应该正确继承 Error', () => {
    const error = new DegradationConfigServiceError('test message', 'TEST_CODE');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DegradationConfigServiceError);
  });

  it('应该设置 message 和 code', () => {
    const error = new DegradationConfigServiceError('Config not found', 'CONFIG_NOT_FOUND');
    expect(error.message).toBe('Config not found');
    expect(error.code).toBe('CONFIG_NOT_FOUND');
  });

  it('应该设置 name 为 DegradationConfigServiceError', () => {
    const error = new DegradationConfigServiceError('msg', 'code');
    expect(error.name).toBe('DegradationConfigServiceError');
  });

  it('应该支持不同的错误码', () => {
    const codes = ['CONFIG_NOT_FOUND', 'UPDATE_FAILED', 'VALIDATION_ERROR'];
    for (const code of codes) {
      const error = new DegradationConfigServiceError('msg', code);
      expect(error.code).toBe(code);
    }
  });
});

describe('DegradationConfigRepository', () => {
  let pool: ReturnType<typeof createMockPool>;
  let repo: DegradationConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = createMockPool();
    repo = new DegradationConfigRepository(pool as any);
  });

  // ========== findByScenario ==========

  describe('findByScenario', () => {
    it('应该返回匹配的配置', async () => {
      const config = makeConfig();
      pool.query.mockResolvedValue({ rows: [config] });

      const result = await repo.findByScenario('risk-assessment');

      expect(result).toEqual(config);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM degradation_configs WHERE scenario = $1',
        ['risk-assessment']
      );
    });

    it('应该返回 null 如果未找到', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByScenario('nonexistent');

      expect(result).toBeNull();
    });

    it('应该传递正确的参数到查询', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await repo.findByScenario('test-selection');

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query.mock.calls[0][1]).toEqual(['test-selection']);
    });
  });

  // ========== listAll ==========

  describe('listAll', () => {
    it('应该返回所有配置并按 scenario 排序', async () => {
      const configs = [
        makeConfig({ id: '1', scenario: 'alpha' }),
        makeConfig({ id: '2', scenario: 'beta' }),
        makeConfig({ id: '3', scenario: 'gamma' }),
      ];
      pool.query.mockResolvedValue({ rows: configs });

      const result = await repo.listAll();

      expect(result).toHaveLength(3);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM degradation_configs ORDER BY scenario'
      );
    });

    it('应该返回空数组如果没有配置', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.listAll();

      expect(result).toHaveLength(0);
    });
  });

  // ========== create ==========

  describe('create', () => {
    it('应该创建新配置并返回结果', async () => {
      const created = makeConfig({ id: 'new-1', scenario: 'new-scenario' });
      pool.query.mockResolvedValue({ rows: [created] });

      const result = await repo.create({
        scenario: 'new-scenario',
        strategy: 'rule-engine',
        fallback_strategies: ['template'],
      });

      expect(result.id).toBe('new-1');
      expect(result.scenario).toBe('new-scenario');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO degradation_configs'),
        expect.any(Array)
      );
    });

    it('应该使用默认值当未指定时', async () => {
      const created = makeConfig({
        scenario: 'minimal',
        strategy: 'rule-engine',
        fallback_strategies: [],
        cache_ttl: 300,
        notify_on_degradation: true,
      });
      pool.query.mockResolvedValue({ rows: [created] });

      await repo.create({ scenario: 'minimal' });

      const args = pool.query.mock.calls[0][1];
      expect(args[0]).toBeNull(); // tenant_id
      expect(args[2]).toBe('rule-engine'); // strategy default
      expect(args[3]).toEqual([]); // fallback_strategies default
      expect(args[6]).toBe(300); // cache_ttl default
      expect(args[7]).toBe(true); // notify_on_degradation default
    });

    it('应该传递 tenant_id 如果提供', async () => {
      const created = makeConfig({ tenant_id: 'tenant-1' });
      pool.query.mockResolvedValue({ rows: [created] });

      await repo.create({ scenario: 'test', tenant_id: 'tenant-1' });

      const args = pool.query.mock.calls[0][1];
      expect(args[0]).toBe('tenant-1');
    });

    it('应该传递 rule_set 如果提供', async () => {
      const ruleSet = { conditions: [{ field: 'size', operator: 'gt', value: 100 }] };
      const created = makeConfig({ rule_set: ruleSet });
      pool.query.mockResolvedValue({ rows: [created] });

      await repo.create({ scenario: 'test', rule_set: ruleSet });

      const args = pool.query.mock.calls[0][1];
      expect(args[4]).toBe(JSON.stringify(ruleSet));
    });

    it('应该传递 template_name 如果提供', async () => {
      const created = makeConfig({ template_name: 'my-template' });
      pool.query.mockResolvedValue({ rows: [created] });

      await repo.create({ scenario: 'test', template_name: 'my-template' });

      const args = pool.query.mock.calls[0][1];
      expect(args[5]).toBe('my-template');
    });

    it('应该传递 default_response 如果提供', async () => {
      const defaultResponse = { risk_level: 'high' };
      const created = makeConfig({ default_response: defaultResponse });
      pool.query.mockResolvedValue({ rows: [created] });

      await repo.create({ scenario: 'test', default_response: defaultResponse });

      const args = pool.query.mock.calls[0][1];
      expect(args[8]).toBe(JSON.stringify(defaultResponse));
    });

    it('应该处理 notify_on_degradation 为 false', async () => {
      const created = makeConfig({ notify_on_degradation: false });
      pool.query.mockResolvedValue({ rows: [created] });

      await repo.create({ scenario: 'test', notify_on_degradation: false });

      const args = pool.query.mock.calls[0][1];
      expect(args[7]).toBe(false);
    });
  });

  // ========== update ==========

  describe('update', () => {
    it('应该更新 strategy 字段', async () => {
      const updated = makeConfig({ strategy: 'template' });
      pool.query.mockResolvedValue({ rows: [updated] });

      const result = await repo.update('risk-assessment', { strategy: 'template' });

      expect(result!.strategy).toBe('template');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE degradation_configs'),
        expect.any(Array)
      );
    });

    it('应该更新 fallback_strategies 字段', async () => {
      const updated = makeConfig({ fallback_strategies: ['cache', 'default'] });
      pool.query.mockResolvedValue({ rows: [updated] });

      const result = await repo.update('risk-assessment', {
        fallback_strategies: ['cache', 'default'],
      });

      expect(result!.fallback_strategies).toEqual(['cache', 'default']);
    });

    it('应该更新 rule_set 字段', async () => {
      const newRuleSet = { conditions: [{ field: 'lang', operator: 'eq', value: 'ts' }] };
      const updated = makeConfig({ rule_set: newRuleSet });
      pool.query.mockResolvedValue({ rows: [updated] });

      await repo.update('risk-assessment', { rule_set: newRuleSet });

      const args = pool.query.mock.calls[0][1];
      expect(args[0]).toBe(JSON.stringify(newRuleSet));
    });

    it('应该更新 template_name 字段', async () => {
      const updated = makeConfig({ template_name: 'new-template' });
      pool.query.mockResolvedValue({ rows: [updated] });

      const result = await repo.update('risk-assessment', {
        template_name: 'new-template',
      });

      expect(result!.template_name).toBe('new-template');
    });

    it('应该更新 cache_ttl 字段', async () => {
      const updated = makeConfig({ cache_ttl: 600 });
      pool.query.mockResolvedValue({ rows: [updated] });

      const result = await repo.update('risk-assessment', { cache_ttl: 600 });

      expect(result!.cache_ttl).toBe(600);
    });

    it('应该更新 notify_on_degradation 字段', async () => {
      const updated = makeConfig({ notify_on_degradation: false });
      pool.query.mockResolvedValue({ rows: [updated] });

      const result = await repo.update('risk-assessment', {
        notify_on_degradation: false,
      });

      expect(result!.notify_on_degradation).toBe(false);
    });

    it('应该更新 default_response 字段', async () => {
      const newDefaultResponse = { verdict: 'approve' };
      const updated = makeConfig({ default_response: newDefaultResponse });
      pool.query.mockResolvedValue({ rows: [updated] });

      await repo.update('risk-assessment', { default_response: newDefaultResponse });

      const args = pool.query.mock.calls[0][1];
      expect(args[0]).toBe(JSON.stringify(newDefaultResponse));
    });

    it('应该同时更新多个字段', async () => {
      const updated = makeConfig({ strategy: 'cache', cache_ttl: 900 });
      pool.query.mockResolvedValue({ rows: [updated] });

      await repo.update('risk-assessment', {
        strategy: 'cache',
        cache_ttl: 900,
      });

      const queryStr = pool.query.mock.calls[0][0] as string;
      expect(queryStr).toContain('strategy = $1');
      expect(queryStr).toContain('cache_ttl = $2');
      expect(queryStr).toContain('updated_at = now()');
    });

    it('应该在没有更新字段时回退到 findByScenario', async () => {
      const config = makeConfig();
      pool.query.mockResolvedValue({ rows: [config] });

      const result = await repo.update('risk-assessment', {});

      expect(result).toEqual(config);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM degradation_configs WHERE scenario = $1',
        ['risk-assessment']
      );
    });

    it('应该返回 null 如果更新时配置不存在', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.update('nonexistent', { strategy: 'template' });

      expect(result).toBeNull();
    });
  });

  // ========== delete ==========

  describe('delete', () => {
    it('应该删除配置并返回 true', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.delete('risk-assessment');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM degradation_configs WHERE scenario = $1',
        ['risk-assessment']
      );
    });

    it('应该在配置不存在时返回 false', async () => {
      pool.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  // ========== createAuditLog ==========

  describe('createAuditLog', () => {
    it('应该创建审计日志', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'a1' }] });

      await repo.createAuditLog(
        'risk-assessment',
        'update',
        { strategy: 'old' },
        { strategy: 'new' },
        'user-1'
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO degradation_config_audit'),
        ['risk-assessment', 'update', '{"strategy":"old"}', '{"strategy":"new"}', 'user-1']
      );
    });

    it('应该支持 null 的 old_config 和 new_config', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'a1' }] });

      await repo.createAuditLog('risk-assessment', 'create', null, null);

      const args = pool.query.mock.calls[0][1];
      expect(args[2]).toBe('null');
      expect(args[3]).toBe('null');
      expect(args[4]).toBeNull(); // createdBy defaults to null
    });

    it('应该将 createdBy 默认为 null', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await repo.createAuditLog('scenario', 'export', null, { count: 5 });

      const args = pool.query.mock.calls[0][1];
      expect(args[4]).toBeNull();
    });

    it('应该支持不同的 action 类型', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const actions: Array<'create' | 'update' | 'delete' | 'import' | 'export'> = [
        'create', 'update', 'delete', 'import', 'export',
      ];

      for (const action of actions) {
        await repo.createAuditLog('scenario', action, null, null);
      }

      expect(pool.query).toHaveBeenCalledTimes(5);
    });
  });
});

describe('DegradationConfigService', () => {
  let pool: ReturnType<typeof createMockPool>;
  let service: DegradationConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = createMockPool();
    service = new DegradationConfigService(pool as any);
  });

  // ========== initializeDefaults ==========

  describe('initializeDefaults', () => {
    it('应该创建默认配置如果不存在', async () => {
      // 3 default configs, each: findByScenario (empty) + create
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // findByScenario risk-assessment
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'risk-assessment' })] }) // create
        .mockResolvedValueOnce({ rows: [] }) // findByScenario test-selection
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'test-selection' })] }) // create
        .mockResolvedValueOnce({ rows: [] }) // findByScenario code-review
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'code-review' })] }); // create

      await service.initializeDefaults();

      // 3 finds + 3 creates = 6 queries
      expect(pool.query).toHaveBeenCalledTimes(6);
    });

    it('应该跳过已存在的配置', async () => {
      // All 3 scenarios already exist
      pool.query
        .mockResolvedValue({ rows: [makeConfig()] });

      await service.initializeDefaults();

      // 3 findByScenario calls, 0 creates
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    it('应该只初始化一次（幂等）', async () => {
      pool.query.mockResolvedValue({ rows: [makeConfig()] });

      await service.initializeDefaults();
      await service.initializeDefaults();

      // Only 3 queries for first call, second call is no-op
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    it('应该在某个配置创建失败时继续初始化其他的', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // findByScenario risk-assessment
        .mockRejectedValueOnce(new Error('DB error')) // create risk-assessment fails
        .mockResolvedValueOnce({ rows: [] }) // findByScenario test-selection
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'test-selection' })] }) // create
        .mockResolvedValueOnce({ rows: [] }) // findByScenario code-review
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'code-review' })] }); // create

      // Should not throw
      await expect(service.initializeDefaults()).resolves.toBeUndefined();

      // Still initialized the other configs
      expect(pool.query).toHaveBeenCalledTimes(6);
    });
  });

  // ========== getConfig ==========

  describe('getConfig', () => {
    it('应该返回配置', async () => {
      const config = makeConfig({ scenario: 'risk-assessment' });
      pool.query.mockResolvedValue({ rows: [config] });

      const result = await service.getConfig('risk-assessment');

      expect(result.scenario).toBe('risk-assessment');
      expect(result.strategy).toBe('rule-engine');
    });

    it('应该在配置不存在时抛出 CONFIG_NOT_FOUND 错误', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await expect(service.getConfig('unknown-scenario')).rejects.toThrow(
        DegradationConfigServiceError
      );
      await expect(service.getConfig('unknown-scenario')).rejects.toThrow(
        'Configuration not found for scenario: unknown-scenario'
      );
    });

    it('应该在配置不存在时使用 CONFIG_NOT_FOUND 错误码', async () => {
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

  // ========== listConfigs ==========

  describe('listConfigs', () => {
    it('应该返回 data 包装的配置列表', async () => {
      const configs = [
        makeConfig({ id: '1', scenario: 'a' }),
        makeConfig({ id: '2', scenario: 'b' }),
      ];
      pool.query.mockResolvedValue({ rows: configs });

      const result = await service.listConfigs();

      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(2);
    });

    it('应该返回空 data 数组如果没有配置', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await service.listConfigs();

      expect(result.data).toEqual([]);
    });
  });

  // ========== updateConfig ==========

  describe('updateConfig', () => {
    it('应该创建新配置如果不存在', async () => {
      const newConfig = makeConfig({ scenario: 'new-s', strategy: 'template' });
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // findByScenario - not found
        .mockResolvedValueOnce({ rows: [newConfig] }) // create
        .mockResolvedValueOnce({ rows: [] }); // audit log

      const result = await service.updateConfig('new-s', {
        scenario: 'new-s',
        strategy: 'template',
      });

      expect(result.strategy).toBe('template');
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    it('应该更新已有配置', async () => {
      const oldConfig = makeConfig({ strategy: 'rule-engine' });
      const newConfig = makeConfig({ strategy: 'template' });
      pool.query
        .mockResolvedValueOnce({ rows: [oldConfig] }) // findByScenario - found
        .mockResolvedValueOnce({ rows: [newConfig] }) // update
        .mockResolvedValueOnce({ rows: [] }); // audit log

      const result = await service.updateConfig('risk-assessment', {
        scenario: 'risk-assessment',
        strategy: 'template',
      });

      expect(result.strategy).toBe('template');
    });

    it('应该在更新失败时抛出 UPDATE_FAILED 错误', async () => {
      const oldConfig = makeConfig();
      pool.query
        .mockResolvedValueOnce({ rows: [oldConfig] }) // findByScenario
        .mockResolvedValueOnce({ rows: [] }); // update returns null

      try {
        await service.updateConfig('risk-assessment', { scenario: 'risk-assessment' });
        fail('Expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(DegradationConfigServiceError);
        expect((err as DegradationConfigServiceError).code).toBe('UPDATE_FAILED');
        expect((err as DegradationConfigServiceError).message).toBe(
          'Failed to update configuration'
        );
      }
    });

    it('应该创建审计日志记录创建操作', async () => {
      const newConfig = makeConfig({ scenario: 'new-s' });
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // findByScenario
        .mockResolvedValueOnce({ rows: [newConfig] }) // create
        .mockResolvedValueOnce({ rows: [] }); // audit log

      await service.updateConfig('new-s', { scenario: 'new-s' }, 'user-1');

      // Check audit log call
      const auditCall = pool.query.mock.calls[2];
      expect(auditCall[0]).toContain('INSERT INTO degradation_config_audit');
      expect(auditCall[1][1]).toBe('create');
      expect(auditCall[1][4]).toBe('user-1');
    });

    it('应该创建审计日志记录更新操作', async () => {
      const oldConfig = makeConfig({ strategy: 'rule-engine' });
      const newConfig = makeConfig({ strategy: 'template' });
      pool.query
        .mockResolvedValueOnce({ rows: [oldConfig] }) // findByScenario
        .mockResolvedValueOnce({ rows: [newConfig] }) // update
        .mockResolvedValueOnce({ rows: [] }); // audit log

      await service.updateConfig('risk-assessment', { strategy: 'template' }, 'user-2');

      const auditCall = pool.query.mock.calls[2];
      expect(auditCall[1][1]).toBe('update');
      expect(auditCall[1][4]).toBe('user-2');
    });

    it('应该在没有 userId 时将 createdBy 设为 null', async () => {
      const newConfig = makeConfig();
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [newConfig] })
        .mockResolvedValueOnce({ rows: [] });

      await service.updateConfig('new-s', { scenario: 'new-s' });

      const auditCall = pool.query.mock.calls[2];
      expect(auditCall[1][4]).toBeNull();
    });
  });

  // ========== deleteConfig ==========

  describe('deleteConfig', () => {
    it('应该成功删除配置', async () => {
      const config = makeConfig();
      pool.query
        .mockResolvedValueOnce({ rows: [config] }) // findByScenario
        .mockResolvedValueOnce({ rowCount: 1 }) // delete
        .mockResolvedValueOnce({ rows: [] }); // audit log

      const result = await service.deleteConfig('risk-assessment', 'user-1');

      expect(result.success).toBe(true);
    });

    it('应该在配置不存在时返回 success: false', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.deleteConfig('nonexistent');

      expect(result.success).toBe(false);
    });

    it('应该在删除失败（rowCount=0）时返回 success: false', async () => {
      const config = makeConfig();
      pool.query
        .mockResolvedValueOnce({ rows: [config] })
        .mockResolvedValueOnce({ rowCount: 0 });

      const result = await service.deleteConfig('risk-assessment');

      expect(result.success).toBe(false);
    });

    it('应该创建审计日志当删除成功时', async () => {
      const config = makeConfig();
      pool.query
        .mockResolvedValueOnce({ rows: [config] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });

      await service.deleteConfig('risk-assessment', 'user-1');

      const auditCall = pool.query.mock.calls[2];
      expect(auditCall[0]).toContain('INSERT INTO degradation_config_audit');
      expect(auditCall[1][1]).toBe('delete');
      expect(auditCall[1][4]).toBe('user-1');
    });

    it('应该不创建审计日志当配置不存在时', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.deleteConfig('nonexistent');

      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('应该在没有 userId 时将 createdBy 设为 null', async () => {
      const config = makeConfig();
      pool.query
        .mockResolvedValueOnce({ rows: [config] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });

      await service.deleteConfig('risk-assessment');

      const auditCall = pool.query.mock.calls[2];
      expect(auditCall[1][4]).toBeNull();
    });
  });

  // ========== importConfigs ==========

  describe('importConfigs', () => {
    it('应该成功导入多个配置', async () => {
      const configs: UpdateConfigInput[] = [
        { scenario: 'scenario-1', strategy: 'template' },
        { scenario: 'scenario-2', strategy: 'cache' },
      ];

      // Each config: findByScenario + create/update + audit = 3 calls, plus 1 for import audit
      pool.query
        // scenario-1
        .mockResolvedValueOnce({ rows: [] }) // findByScenario
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'scenario-1' })] }) // create
        .mockResolvedValueOnce({ rows: [] }) // audit log
        // scenario-2
        .mockResolvedValueOnce({ rows: [] }) // findByScenario
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'scenario-2' })] }) // create
        .mockResolvedValueOnce({ rows: [] }) // audit log
        // import audit
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.importConfigs(configs, 'user-1');

      expect(result.imported).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('应该处理缺少 scenario 的配置', async () => {
      const configs = [
        { strategy: 'template' } as UpdateConfigInput, // missing scenario
      ];

      // import audit
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.importConfigs(configs);

      expect(result.imported).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Missing scenario field');
    });

    it('应该处理导入过程中的错误', async () => {
      const configs: UpdateConfigInput[] = [
        { scenario: 'fail-scenario', strategy: 'template' },
      ];

      pool.query
        .mockRejectedValueOnce(new Error('DB connection failed')) // findByScenario fails
        .mockResolvedValueOnce({ rows: [] }); // import audit

      const result = await service.importConfigs(configs);

      expect(result.imported).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('fail-scenario');
      expect(result.errors[0]).toContain('DB connection failed');
    });

    it('应该混合成功和失败的导入', async () => {
      const configs: UpdateConfigInput[] = [
        { scenario: 'good-scenario', strategy: 'template' },
        { strategy: 'cache' } as UpdateConfigInput, // missing scenario
        { scenario: 'bad-scenario', strategy: 'manual' },
      ];

      pool.query
        // good-scenario: success
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [makeConfig({ scenario: 'good-scenario' })] })
        .mockResolvedValueOnce({ rows: [] })
        // bad-scenario: fails
        .mockRejectedValueOnce(new Error('Timeout'))
        // import audit
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.importConfigs(configs);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it('应该创建导入审计日志', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await service.importConfigs([{ scenario: 'test' }], 'user-1');

      // Last call is the import audit log
      const lastCall = pool.query.mock.calls[pool.query.mock.calls.length - 1];
      expect(lastCall[0]).toContain('INSERT INTO degradation_config_audit');
      expect(lastCall[1][1]).toBe('user-1');
    });

    it('应该处理空配置数组', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.importConfigs([]);

      expect(result.imported).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ========== exportConfigs ==========

  describe('exportConfigs', () => {
    it('应该返回配置列表', async () => {
      const configs = [
        makeConfig({ id: '1', scenario: 'a' }),
        makeConfig({ id: '2', scenario: 'b' }),
      ];
      pool.query
        .mockResolvedValueOnce({ rows: configs }) // listAll
        .mockResolvedValueOnce({ rows: [] }); // audit log

      const result = await service.exportConfigs();

      expect(result.configs).toHaveLength(2);
    });

    it('应该创建导出审计日志', async () => {
      const configs = [makeConfig()];
      pool.query
        .mockResolvedValueOnce({ rows: configs })
        .mockResolvedValueOnce({ rows: [] });

      await service.exportConfigs();

      const auditCall = pool.query.mock.calls[1];
      expect(auditCall[0]).toContain("'export'");
      expect(auditCall[1][0]).toContain('"count":1');
    });

    it('应该返回空列表如果没有配置', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.exportConfigs();

      expect(result.configs).toHaveLength(0);
    });
  });

  // ========== getAuditHistory ==========

  describe('getAuditHistory', () => {
    it('应该返回指定场景的审计日志', async () => {
      const logs = [
        makeAuditLog({ id: 'a1', action: 'update' }),
        makeAuditLog({ id: 'a2', action: 'create' }),
      ];
      pool.query.mockResolvedValue({ rows: logs });

      const result = await service.getAuditHistory('risk-assessment');

      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE scenario = $1'),
        ['risk-assessment']
      );
    });

    it('应该返回所有审计日志当未指定场景', async () => {
      const logs = [makeAuditLog({ id: 'a1' }), makeAuditLog({ id: 'a2' })];
      pool.query.mockResolvedValue({ rows: logs });

      const result = await service.getAuditHistory();

      expect(result).toHaveLength(2);
      const queryStr = pool.query.mock.calls[0][0] as string;
      expect(queryStr).not.toContain('WHERE');
    });

    it('应该支持自定义 limit', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await service.getAuditHistory('risk-assessment', 100);

      const queryStr = pool.query.mock.calls[0][0] as string;
      expect(queryStr).toContain('LIMIT 100');
    });

    it('应该使用默认 limit 50', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await service.getAuditHistory('risk-assessment');

      const queryStr = pool.query.mock.calls[0][0] as string;
      expect(queryStr).toContain('LIMIT 50');
    });

    it('应该返回空数组如果没有日志', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await service.getAuditHistory('risk-assessment');

      expect(result).toHaveLength(0);
    });
  });

  // ========== validateConfig ==========

  describe('validateConfig', () => {
    it('应该验证有效的配置', async () => {
      const result = await service.validateConfig({
        scenario: 'risk-assessment',
        strategy: 'rule-engine',
        fallback_strategies: ['template', 'cache'],
        cache_ttl: 300,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测无效的 strategy', async () => {
      const result = await service.validateConfig({
        scenario: 'test',
        strategy: 'invalid-strategy' as any,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid strategy: invalid-strategy');
    });

    it('应该检测无效的 fallback_strategies', async () => {
      const result = await service.validateConfig({
        scenario: 'test',
        fallback_strategies: ['template', 'bad-strategy'],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid fallback strategy: bad-strategy');
    });

    it('应该检测多个无效的 fallback_strategies', async () => {
      const result = await service.validateConfig({
        scenario: 'test',
        fallback_strategies: ['bad1', 'bad2'],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('应该检测 cache_ttl 超出范围（负数）', async () => {
      const result = await service.validateConfig({
        scenario: 'test',
        cache_ttl: -1,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cache_ttl must be between 0 and 86400 seconds');
    });

    it('应该检测 cache_ttl 超出范围（超过 86400）', async () => {
      const result = await service.validateConfig({
        scenario: 'test',
        cache_ttl: 90000,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cache_ttl must be between 0 and 86400 seconds');
    });

    it('应该接受 cache_ttl 为 0', async () => {
      const result = await service.validateConfig({
        scenario: 'test',
        cache_ttl: 0,
      });

      // 0 is falsy, so the condition `input.cache_ttl &&` is false - no error
      expect(result.valid).toBe(true);
    });

    it('应该接受 cache_ttl 为 86400', async () => {
      const result = await service.validateConfig({
        scenario: 'test',
        cache_ttl: 86400,
      });

      expect(result.valid).toBe(true);
    });

    it('应该检测无效的 scenario 名称格式（大写字母）', async () => {
      const result = await service.validateConfig({
        scenario: 'Risk-Assessment',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('scenario must be lowercase alphanumeric with hyphens');
    });

    it('应该检测无效的 scenario 名称格式（特殊字符）', async () => {
      const result = await service.validateConfig({
        scenario: 'risk_assessment!',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('scenario must be lowercase alphanumeric with hyphens');
    });

    it('应该接受有效的 scenario 名称', async () => {
      const validScenarios = ['risk-assessment', 'test', 'code-review-2', 'a1b2'];

      for (const scenario of validScenarios) {
        const result = await service.validateConfig({ scenario });
        expect(result.valid).toBe(true);
      }
    });

    it('应该同时返回多个验证错误', async () => {
      const result = await service.validateConfig({
        scenario: 'Invalid!',
        strategy: 'bad' as any,
        cache_ttl: -100,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('应该接受空输入（无必填字段）', async () => {
      const result = await service.validateConfig({ scenario: 'test' });

      expect(result.valid).toBe(true);
    });
  });

  // ========== getActiveStrategy ==========

  describe('getActiveStrategy', () => {
    it('应该返回主要策略和回退策略', async () => {
      const config = makeConfig({
        strategy: 'rule-engine',
        fallback_strategies: ['template', 'cache', 'default'],
      });
      pool.query.mockResolvedValue({ rows: [config] });

      const result = await service.getActiveStrategy('risk-assessment');

      expect(result.primary).toBe('rule-engine');
      expect(result.fallbacks).toEqual(['template', 'cache', 'default']);
      expect(result.config).toEqual(config);
    });

    it('应该在配置不存在时抛出错误', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await expect(service.getActiveStrategy('unknown')).rejects.toThrow(
        DegradationConfigServiceError
      );
    });

    it('应该包含完整的配置对象', async () => {
      const config = makeConfig({
        cache_ttl: 600,
        notify_on_degradation: false,
        default_response: { verdict: 'approve' },
      });
      pool.query.mockResolvedValue({ rows: [config] });

      const result = await service.getActiveStrategy('risk-assessment');

      expect(result.config.cache_ttl).toBe(600);
      expect(result.config.notify_on_degradation).toBe(false);
      expect(result.config.default_response).toEqual({ verdict: 'approve' });
    });

    it('应该处理空的 fallback_strategies', async () => {
      const config = makeConfig({ fallback_strategies: [] });
      pool.query.mockResolvedValue({ rows: [config] });

      const result = await service.getActiveStrategy('risk-assessment');

      expect(result.fallbacks).toEqual([]);
    });
  });

  // ========== 策略类型测试 ==========

  describe('DegradationStrategy 类型支持', () => {
    it('应该支持所有 5 种策略类型', async () => {
      const strategies = ['rule-engine', 'template', 'cache', 'manual', 'default'] as const;

      for (const strategy of strategies) {
        const result = await service.validateConfig({
          scenario: 'test',
          strategy,
        });
        expect(result.valid).toBe(true);
      }
    });
  });

  // ========== 集成测试 ==========

  describe('完整操作流程', () => {
    it('应该支持 创建 -> 查询 -> 更新 -> 删除 流程', async () => {
      const config = makeConfig({ scenario: 'flow-test', strategy: 'template' });
      const updatedConfig = makeConfig({ scenario: 'flow-test', strategy: 'cache' });

      // Create
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // findByScenario - not found
        .mockResolvedValueOnce({ rows: [config] }) // create
        .mockResolvedValueOnce({ rows: [] }); // audit

      const created = await service.updateConfig('flow-test', {
        scenario: 'flow-test',
        strategy: 'template',
      });
      expect(created.strategy).toBe('template');

      // Read
      pool.query.mockResolvedValueOnce({ rows: [config] });
      const fetched = await service.getConfig('flow-test');
      expect(fetched.scenario).toBe('flow-test');

      // Update
      pool.query
        .mockResolvedValueOnce({ rows: [config] }) // findByScenario
        .mockResolvedValueOnce({ rows: [updatedConfig] }) // update
        .mockResolvedValueOnce({ rows: [] }); // audit

      const updated = await service.updateConfig('flow-test', {
        scenario: 'flow-test',
        strategy: 'cache',
      });
      expect(updated.strategy).toBe('cache');

      // Delete
      pool.query
        .mockResolvedValueOnce({ rows: [updatedConfig] }) // findByScenario
        .mockResolvedValueOnce({ rowCount: 1 }) // delete
        .mockResolvedValueOnce({ rows: [] }); // audit

      const deleted = await service.deleteConfig('flow-test');
      expect(deleted.success).toBe(true);
    });
  });
});
