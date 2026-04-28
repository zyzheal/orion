/**
 * microfront/config 单元测试
 * 注: config.ts 从 apps.ts 重新导出，测试验证 re-export 行为
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('microfront/config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('re-exports from apps', () => {
    it('should re-export subAppConfigs', async () => {
      const configModule = await import('../config');
      // config.ts exports from apps.ts, so subAppConfigs should be available
      expect(configModule.subAppConfigs).toBeDefined();
      expect(Array.isArray(configModule.subAppConfigs)).toBe(true);
      expect(configModule.subAppConfigs.length).toBe(3);
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

  describe('config values', () => {
    it('should contain dba, knowledge, visor configs', async () => {
      const { subAppConfigs } = await import('../config');
      const keys = subAppConfigs.map((c) => c.key);
      expect(keys).toContain('dba');
      expect(keys).toContain('knowledge');
      expect(keys).toContain('visor');
    });

    it('each config should have required fields', async () => {
      const { subAppConfigs } = await import('../config');
      subAppConfigs.forEach((config) => {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('key');
        expect(config).toHaveProperty('path');
        expect(config).toHaveProperty('url');
        expect(config).toHaveProperty('container');
        expect(config).toHaveProperty('enabled');
      });
    });

    it('should have keepAlive enabled for all apps', async () => {
      const { subAppConfigs } = await import('../config');
      subAppConfigs.forEach((config) => {
        expect(config.keepAlive).toBe(true);
      });
    });

    it('should have preload disabled for all apps', async () => {
      const { subAppConfigs } = await import('../config');
      subAppConfigs.forEach((config) => {
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
