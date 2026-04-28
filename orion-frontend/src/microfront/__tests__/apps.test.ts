/**
 * microfront/apps 单元测试
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
    it('should export subAppConfigs from apps.ts', async () => {
      const { subAppConfigs } = await import('../apps');
      expect(Array.isArray(subAppConfigs)).toBe(true);
      expect(subAppConfigs.length).toBe(3);
    });

    it('should have correct container selectors', async () => {
      const { subAppConfigs } = await import('../apps');
      const containers = subAppConfigs.map((c) => c.container);
      expect(containers).toContain('#wujie-dba');
      expect(containers).toContain('#wujie-knowledge');
      expect(containers).toContain('#wujie-visor');
    });

    it('should have correct path patterns', async () => {
      const { subAppConfigs } = await import('../apps');
      const paths = subAppConfigs.map((c) => c.path);
      expect(paths).toContain('/dba/*');
      expect(paths).toContain('/knowledge/*');
      expect(paths).toContain('/visor/*');
    });
  });

  describe('getSubAppConfig', () => {
    it('should return config by key', async () => {
      const { getSubAppConfig } = await import('../apps');
      const visorConfig = getSubAppConfig('visor');
      expect(visorConfig).toBeDefined();
      expect(visorConfig!.key).toBe('visor');
      expect(visorConfig!.name).toBe('监控中心');
    });

    it('should return undefined for unknown key', async () => {
      const { getSubAppConfig } = await import('../apps');
      expect(getSubAppConfig('unknown')).toBeUndefined();
    });
  });

  describe('getEnabledApps', () => {
    it('should return all enabled apps', async () => {
      const { getEnabledApps } = await import('../apps');
      const enabledApps = getEnabledApps();
      expect(enabledApps.length).toBe(3);
      expect(enabledApps.every((app) => app.enabled)).toBe(true);
    });
  });
});
