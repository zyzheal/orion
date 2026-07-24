/**
 * microfront/apps 单元测试
 *
 * 注意: apps.ts 的 subAppConfigs 现在是空数组 []，
 * 配置从 subAppStore 动态读取。此文件保留用于验证模块导出。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('microfront/apps', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('subAppConfigs', () => {
    it('should export subAppConfigs as empty array (dynamic from store)', async () => {
      const { subAppConfigs } = await import('../apps');
      expect(Array.isArray(subAppConfigs)).toBe(true);
      expect(subAppConfigs.length).toBe(0); // Dynamic, read from store
    });

    it('should export getSubAppConfig function', async () => {
      const { getSubAppConfig } = await import('../apps');
      expect(typeof getSubAppConfig).toBe('function');
      // Returns undefined when store has no apps
      expect(getSubAppConfig('unknown')).toBeUndefined();
    });

    it('should export getEnabledApps function', async () => {
      const { getEnabledApps } = await import('../apps');
      expect(typeof getEnabledApps).toBe('function');
    });
  });
});
