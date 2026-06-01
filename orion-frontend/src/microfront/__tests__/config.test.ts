/**
 * microfront/config 单元测试
 * 注: config.ts 从 apps.ts 重新导出，测试验证 re-export 行为
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockApps = [
  {
    key: 'dba',
    name: '数据库管理',
    routes: ['/dba'],
    entry_dev: 'http://localhost:3002',
    entry_prod: 'https://dba.orion.io',
    css_isolation: 'shadow-dom',
    status: 'enabled',
    keep_alive: true,
    preload: false,
  },
  {
    key: 'knowledge',
    name: '知识库',
    routes: ['/knowledge'],
    entry_dev: 'http://localhost:3003',
    entry_prod: 'https://knowledge.orion.io',
    css_isolation: 'shadow-dom',
    status: 'enabled',
    keep_alive: true,
    preload: false,
  },
  {
    key: 'visor',
    name: '运维可视化',
    routes: ['/visor'],
    entry_dev: 'http://localhost:3004',
    entry_prod: 'https://visor.orion.io',
    css_isolation: 'shadow-dom',
    status: 'enabled',
    keep_alive: true,
    preload: false,
  },
];

vi.mock('@/stores/subappStore', () => ({
  useSubAppStore: {
    getState: vi.fn(() => ({
      apps: mockApps,
    })),
  },
}));

describe('microfront/config', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('re-exports from apps', () => {
    it('should re-export subAppConfigs as empty array (backward compat)', async () => {
      const configModule = await import('../config');
      expect(configModule.subAppConfigs).toBeDefined();
      expect(Array.isArray(configModule.subAppConfigs)).toBe(true);
      // subAppConfigs is a static empty array for backward compatibility
      // actual data comes from getSubAppConfigs() which reads from store
    });

    it('should re-export getSubAppConfig', async () => {
      const configModule = await import('../config');
      expect(configModule.getSubAppConfig).toBeDefined();
      expect(typeof configModule.getSubAppConfig).toBe('function');

      const dbaConfig = configModule.getSubAppConfig('dba');
      expect(dbaConfig).toBeDefined();
      expect(dbaConfig!.key).toBe('dba');
      expect(dbaConfig!.name).toBe('数据库管理');
    });

    it('should re-export getEnabledApps', async () => {
      const configModule = await import('../config');
      expect(configModule.getEnabledApps).toBeDefined();
      expect(typeof configModule.getEnabledApps).toBe('function');

      const enabledApps = configModule.getEnabledApps();
      expect(enabledApps.every((app: any) => app.enabled)).toBe(true);
    });
  });

  describe('config values from store', () => {
    it('should contain dba, knowledge, visor configs from store', async () => {
      const { getEnabledApps } = await import('../config');
      const configs = getEnabledApps();
      const keys = configs.map((c) => c.key);
      expect(keys).toContain('dba');
      expect(keys).toContain('knowledge');
      expect(keys).toContain('visor');
    });

    it('each config should have required fields', async () => {
      const { getEnabledApps } = await import('../config');
      const configs = getEnabledApps();
      configs.forEach((config) => {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('key');
        expect(config).toHaveProperty('path');
        expect(config).toHaveProperty('url');
        expect(config).toHaveProperty('container');
        expect(config).toHaveProperty('enabled');
      });
    });

    it('should have keepAlive enabled for all apps', async () => {
      const { getEnabledApps } = await import('../config');
      const configs = getEnabledApps();
      configs.forEach((config) => {
        expect(config.keepAlive).toBe(true);
      });
    });

    it('should have preload disabled for all apps', async () => {
      const { getEnabledApps } = await import('../config');
      const configs = getEnabledApps();
      configs.forEach((config) => {
        expect(config.preload).toBe(false);
      });
    });

    it('should return undefined for invalid key', async () => {
      const { getSubAppConfig } = await import('../config');
      const result = getSubAppConfig('non-existent');
      expect(result).toBeUndefined();
    });
  });
});
