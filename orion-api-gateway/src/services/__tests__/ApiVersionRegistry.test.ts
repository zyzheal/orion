/**
 * API 版本注册表测试
 */

import { ApiVersionRegistry, VersionDefinition, VersionStatus, DeprecationNotice } from '../ApiVersionRegistry';

describe('ApiVersionRegistry', () => {
  let registry: ApiVersionRegistry;

  beforeEach(() => {
    registry = new ApiVersionRegistry({
      currentVersion: 'v1',
      defaultVersion: 'v1',
      supportedVersions: ['v1', 'v2'],
    });
  });

  describe('registerVersion', () => {
    it('should register a new version with default release date', () => {
      const version = registry.registerVersion({
        version: 'v1',
        status: 'stable',
        features: ['core', 'auth'],
      });

      expect(version.version).toBe('v1');
      expect(version.status).toBe('stable');
      expect(version.features).toEqual(['core', 'auth']);
      expect(version.releaseDate).toBeInstanceOf(Date);
    });

    it('should register a version with custom release date', () => {
      const releaseDate = new Date('2025-01-01');
      const version = registry.registerVersion({
        version: 'v1',
        status: 'stable',
        releaseDate,
        features: ['core'],
      });

      expect(version.releaseDate).toBe(releaseDate);
    });

    it('should throw error for invalid version format', () => {
      expect(() => {
        registry.registerVersion({
          version: '1.0',
          status: 'stable',
          features: ['core'],
        });
      }).toThrow('Invalid version format');
    });

    it('should emit version:registered event', () => {
      const handler = jest.fn();
      registry.on('version:registered', handler);

      registry.registerVersion({
        version: 'v1',
        status: 'stable',
        features: ['core'],
      });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getVersion', () => {
    it('should return registered version', () => {
      registry.registerVersion({
        version: 'v1',
        status: 'stable',
        features: ['core'],
      });

      const version = registry.getVersion('v1');
      expect(version?.version).toBe('v1');
    });

    it('should return undefined for unregistered version', () => {
      const version = registry.getVersion('v999');
      expect(version).toBeUndefined();
    });
  });

  describe('getAllVersions', () => {
    it('should return all registered versions', () => {
      registry.registerVersion({ version: 'v1', status: 'stable', features: [] });
      registry.registerVersion({ version: 'v2', status: 'development', features: [] });

      const versions = registry.getAllVersions();
      expect(versions.length).toBe(2);
      expect(versions.map(v => v.version)).toContain('v1');
      expect(versions.map(v => v.version)).toContain('v2');
    });
  });

  describe('getVersionsByStatus', () => {
    it('should filter versions by status', () => {
      registry.registerVersion({ version: 'v1', status: 'stable', features: [] });
      registry.registerVersion({ version: 'v2', status: 'deprecated', features: [] });
      registry.registerVersion({ version: 'v3', status: 'stable', features: [] });

      const stableVersions = registry.getVersionsByStatus('stable');
      expect(stableVersions.length).toBe(2);
      expect(stableVersions.map(v => v.version)).toContain('v1');
      expect(stableVersions.map(v => v.version)).toContain('v3');
    });
  });

  describe('updateVersionStatus', () => {
    beforeEach(() => {
      registry.registerVersion({ version: 'v1', status: 'stable', features: [] });
    });

    it('should update version status from stable to deprecated', () => {
      const deprecationDate = new Date('2026-06-01');
      const sunsetDate = new Date('2026-12-01');

      const updated = registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate,
        sunsetDate,
        migrationGuide: '/docs/api/v2-migration',
      });

      expect(updated.status).toBe('deprecated');
      expect(updated.deprecationDate).toBe(deprecationDate);
      expect(updated.sunsetDate).toBe(sunsetDate);
      expect(updated.migrationGuide).toBe('/docs/api/v2-migration');
    });

    it('should throw error for invalid status transition', () => {
      // retired cannot transition to any status
      registry.registerVersion({ version: 'v0', status: 'retired', features: [] });

      expect(() => {
        registry.updateVersionStatus('v0', 'stable');
      }).toThrow('Invalid status transition');
    });

    it('should throw error when missing required dates for deprecated', () => {
      expect(() => {
        registry.updateVersionStatus('v1', 'deprecated');
      }).toThrow('Deprecation date and sunset date are required');
    });

    it('should record change history', () => {
      const deprecationDate = new Date('2026-06-01');
      const sunsetDate = new Date('2026-12-01');

      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate,
        sunsetDate,
        changedBy: 'admin',
        reason: 'Feature deprecated',
      });

      const history = registry.getVersionHistory('v1');
      expect(history.length).toBe(1);
      expect(history[0].fromStatus).toBe('stable');
      expect(history[0].toStatus).toBe('deprecated');
      expect(history[0].changedBy).toBe('admin');
      expect(history[0].reason).toBe('Feature deprecated');
    });

    it('should emit version:status:changed event', () => {
      const handler = jest.fn();
      registry.on('version:status:changed', handler);

      const deprecationDate = new Date('2026-06-01');
      const sunsetDate = new Date('2026-12-01');

      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate,
        sunsetDate,
      });

      expect(handler).toHaveBeenCalledWith({
        previousStatus: 'stable',
        newStatus: 'deprecated',
        version: expect.any(Object),
      });
    });
  });

  describe('deprecation notices', () => {
    beforeEach(() => {
      registry.registerVersion({ version: 'v1', status: 'stable', features: [] });
    });

    it('should create deprecation notice when status changes to deprecated', () => {
      const deprecationDate = new Date('2026-06-01');
      const sunsetDate = new Date('2026-12-01');

      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate,
        sunsetDate,
        migrationGuide: '/docs/api/v2-migration',
      });

      const notice = registry.getDeprecationNotice('v1');
      expect(notice).toBeDefined();
      expect(notice?.version).toBe('v1');
      expect(notice?.warning).toBe('API version v1 is deprecated');
      expect(notice?.deprecationDate).toBe(deprecationDate);
      expect(notice?.sunsetDate).toBe(sunsetDate);
      expect(notice?.migrationGuide).toBe('/docs/api/v2-migration');
    });

    it('should emit deprecation:notice event', () => {
      const handler = jest.fn();
      registry.on('deprecation:notice', handler);

      const deprecationDate = new Date('2026-06-01');
      const sunsetDate = new Date('2026-12-01');

      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate,
        sunsetDate,
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should return all deprecation notices', () => {
      registry.registerVersion({ version: 'v2', status: 'stable', features: [] });

      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });

      registry.updateVersionStatus('v2', 'deprecated', {
        deprecationDate: new Date('2026-09-01'),
        sunsetDate: new Date('2027-03-01'),
      });

      const notices = registry.getAllDeprecationNotices();
      expect(notices.length).toBe(2);
    });
  });

  describe('version utilities', () => {
    it('should parse version string correctly', () => {
      expect(registry.parseVersion('v1')).toBe('v1');
      expect(registry.parseVersion('V1')).toBe('v1');
      expect(registry.parseVersion('1')).toBe('v1');
      expect(registry.parseVersion('/v1/')).toBe('v1');
      expect(registry.parseVersion('invalid')).toBeNull();
    });

    it('should compare versions correctly', () => {
      expect(registry.compareVersions('v1', 'v2')).toBeLessThan(0);
      expect(registry.compareVersions('v2', 'v1')).toBeGreaterThan(0);
      expect(registry.compareVersions('v1', 'v1')).toBe(0);
    });
  });

  describe('isVersionSupported', () => {
    it('should return true for supported versions', () => {
      expect(registry.isVersionSupported('v1')).toBe(true);
      expect(registry.isVersionSupported('v2')).toBe(true);
    });

    it('should return false for unsupported versions', () => {
      expect(registry.isVersionSupported('v3')).toBe(false);
    });
  });

  describe('isVersionDeprecated', () => {
    beforeEach(() => {
      registry.registerVersion({ version: 'v1', status: 'stable', features: [] });
      registry.registerVersion({ version: 'v2', status: 'deprecated', features: [] });
    });

    it('should return true for deprecated versions', () => {
      expect(registry.isVersionDeprecated('v2')).toBe(true);
    });

    it('should return false for non-deprecated versions', () => {
      expect(registry.isVersionDeprecated('v1')).toBe(false);
    });
  });

  describe('status transitions', () => {
    it('should allow development -> stable', () => {
      registry.registerVersion({ version: 'v3', status: 'development', features: [] });
      const updated = registry.updateVersionStatus('v3', 'stable');
      expect(updated.status).toBe('stable');
    });

    it('should allow development -> deprecated', () => {
      registry.registerVersion({ version: 'v3', status: 'development', features: [] });
      const updated = registry.updateVersionStatus('v3', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });
      expect(updated.status).toBe('deprecated');
    });

    it('should allow stable -> deprecated', () => {
      registry.registerVersion({ version: 'v1', status: 'stable', features: [] });
      const updated = registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });
      expect(updated.status).toBe('deprecated');
    });

    it('should allow deprecated -> retired', () => {
      registry.registerVersion({ version: 'v1', status: 'stable', features: [] });
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });
      const updated = registry.updateVersionStatus('v1', 'retired');
      expect(updated.status).toBe('retired');
    });

    it('should not allow stable -> development', () => {
      registry.registerVersion({ version: 'v1', status: 'stable', features: [] });
      expect(() => {
        registry.updateVersionStatus('v1', 'development');
      }).toThrow('Invalid status transition');
    });

    it('should not allow deprecated -> stable', () => {
      registry.registerVersion({ version: 'v1', status: 'stable', features: [] });
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });
      expect(() => {
        registry.updateVersionStatus('v1', 'stable');
      }).toThrow('Invalid status transition');
    });
  });

  describe('config', () => {
    it('should return current config', () => {
      const config = registry.getConfig();
      expect(config.currentVersion).toBe('v1');
      expect(config.defaultVersion).toBe('v1');
      expect(config.supportedVersions).toEqual(['v1', 'v2']);
    });

    it('should update config', () => {
      registry.updateConfig({ currentVersion: 'v2' });
      const config = registry.getConfig();
      expect(config.currentVersion).toBe('v2');
    });

    it('should emit config:updated event', () => {
      const handler = jest.fn();
      registry.on('config:updated', handler);

      registry.updateConfig({ currentVersion: 'v2' });
      expect(handler).toHaveBeenCalled();
    });
  });
});