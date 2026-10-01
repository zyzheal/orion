/**
 * API 版本管理器测试
 */

import { ApiVersionManager, VersionNegotiationResult } from '../ApiVersionManager';
import { ApiVersionRegistry } from '../ApiVersionRegistry';
import { FastifyRequest, FastifyReply } from 'fastify';

// Mock FastifyRequest
const createMockRequest = (options: {
  headers?: Record<string, string>;
  url?: string;
  ip?: string;
  authContext?: any;
}): FastifyRequest => {
  return {
    headers: options.headers || {},
    url: options.url || '/api/v1/users',
    originalUrl: options.url || '/api/v1/users',
    ip: options.ip || '127.0.0.1',
    socket: { remoteAddress: options.ip || '127.0.0.1' },
    authContext: options.authContext,
  } as unknown as FastifyRequest;
};

describe('ApiVersionManager', () => {
  let registry: ApiVersionRegistry;
  let manager: ApiVersionManager;

  beforeEach(() => {
    registry = new ApiVersionRegistry({
      currentVersion: 'v2',
      defaultVersion: 'v1',
      supportedVersions: ['v1', 'v2'],
    });

    // 注册版本
    registry.registerVersion({
      version: 'v1',
      status: 'stable',
      features: ['core', 'auth'],
    });

    registry.registerVersion({
      version: 'v2',
      status: 'stable',
      features: ['core', 'auth', 'advanced'],
    });

    manager = new ApiVersionManager(registry);
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();
      expect(manager.getCurrentVersion()).toBeDefined();
    });
  });

  describe('negotiateVersion', () => {
    it('should extract version from header (header priority)', () => {
      const request = createMockRequest({
        headers: { 'x-api-version': 'v2' },
        url: '/api/v1/users',
      });

      const result = manager.negotiateVersion(request);

      expect(result.resolvedVersion).toBe('v2');
      expect(result.source).toBe('header');
      expect(result.requestedVersion).toBe('v2');
    });

    it('should extract version from URL when header is absent', () => {
      const request = createMockRequest({
        headers: {},
        url: '/api/v2/users',
      });

      const result = manager.negotiateVersion(request);

      expect(result.resolvedVersion).toBe('v2');
      expect(result.source).toBe('url');
    });

    it('should fallback to default version when no version specified', () => {
      const request = createMockRequest({
        headers: {},
        url: '/users',  // No version in URL
      });

      const result = manager.negotiateVersion(request);

      expect(result.resolvedVersion).toBe('v1');  // defaultVersion
      expect(result.source).toBe('default');
    });

    it('should parse various header formats', () => {
      const formats = ['v1', 'V1', '1', 'v1.0'];

      for (const format of formats) {
        const request = createMockRequest({
          headers: { 'x-api-version': format },
          url: '/api/users',
        });

        const result = manager.negotiateVersion(request);
        // Only valid format 'v1', 'V1', '1' should parse to v1
        if (format.startsWith('v') || format.startsWith('V') || format === '1') {
          expect(result.resolvedVersion).toBe('v1');
        }
      }
    });

    it('should handle deprecated version', () => {
      // Set v1 as deprecated
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
        migrationGuide: '/docs/api/v2-migration',
      });

      const request = createMockRequest({
        headers: { 'x-api-version': 'v1' },
        url: '/api/v1/users',
      });

      const result = manager.negotiateVersion(request);

      expect(result.resolvedVersion).toBe('v1');
      expect(result.isDeprecated).toBe(true);
      expect(result.deprecationNotice).toBeDefined();
      expect(result.deprecationNotice?.warning).toBe('API version v1 is deprecated');
    });

    it('should throw error for retired version when rejectRetired is true', () => {
      // Set v1 as retired
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });
      registry.updateVersionStatus('v1', 'retired');

      const request = createMockRequest({
        headers: { 'x-api-version': 'v1' },
        url: '/api/v1/users',
      });

      expect(() => {
        manager.negotiateVersion(request);
      }).toThrow('retired');
    });

    it('should use custom header name', () => {
      const customManager = new ApiVersionManager(registry, {
        headerName: 'api-version',
      });

      const request = createMockRequest({
        headers: { 'api-version': 'v2' },
        url: '/api/v1/users',
      });

      const result = customManager.negotiateVersion(request);

      expect(result.resolvedVersion).toBe('v2');
      expect(result.source).toBe('header');
    });

    it('should use custom URL prefix', () => {
      const customManager = new ApiVersionManager(registry, {
        urlPrefix: '/rest/',
      });

      const request = createMockRequest({
        headers: {},
        url: '/rest/v2/users',
      });

      const result = customManager.negotiateVersion(request);

      expect(result.resolvedVersion).toBe('v2');
      expect(result.source).toBe('url');
    });
  });

  describe('getVersionWarningHeaders', () => {
    it('should return basic headers for non-deprecated version', () => {
      const result: VersionNegotiationResult = {
        requestedVersion: 'v2',
        resolvedVersion: 'v2',
        source: 'header',
        isDeprecated: false,
      };

      const headers = manager.getVersionWarningHeaders(result);

      expect(headers['X-API-Version']).toBe('v2');
      expect(headers['X-API-Deprecated']).toBeUndefined();
      expect(headers['Warning']).toBeUndefined();
    });

    it('should return deprecation headers for deprecated version', () => {
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
        migrationGuide: '/docs/api/v2-migration',
      });

      const request = createMockRequest({
        headers: { 'x-api-version': 'v1' },
        url: '/api/v1/users',
      });

      const result = manager.negotiateVersion(request);
      const headers = manager.getVersionWarningHeaders(result);

      expect(headers['X-API-Version']).toBe('v1');
      expect(headers['X-API-Deprecated']).toBe('true');
      expect(headers['X-API-Deprecation-Date']).toBe('2026-06-01');
      expect(headers['X-API-Sunset-Date']).toBe('2026-12-01');
      expect(headers['X-API-Migration-Guide']).toBe('/docs/api/v2-migration');
      expect(headers['Warning']).toContain('deprecated');
      expect(headers['Warning']).toContain('2026-12-01');
    });
  });

  describe('registerVersion', () => {
    it('should register a new version through manager', () => {
      const version = manager.registerVersion('v3', 'development', {
        features: ['beta'],
        changelog: 'Initial release',
      });

      expect(version.version).toBe('v3');
      expect(version.status).toBe('development');
      expect(version.features).toEqual(['beta']);
      expect(version.changelog).toBe('Initial release');
    });
  });

  describe('deprecateVersion', () => {
    it('should deprecate a version', () => {
      const deprecated = manager.deprecateVersion('v1', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
        migrationGuide: '/docs/api/v2-migration',
        changedBy: 'admin',
        reason: 'End of life',
      });

      expect(deprecated.status).toBe('deprecated');
      expect(deprecated.deprecationDate).toBeInstanceOf(Date);
      expect(deprecated.sunsetDate).toBeInstanceOf(Date);
    });
  });

  describe('retireVersion', () => {
    beforeEach(() => {
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });
    });

    it('should retire a deprecated version', () => {
      const retired = manager.retireVersion('v1', {
        changedBy: 'admin',
        reason: 'Scheduled removal',
      });

      expect(retired.status).toBe('retired');
    });
  });

  describe('checkCompatibility', () => {
    it('should return compatible for higher version', () => {
      const result = manager.checkCompatibility('v2', 'v1');
      expect(result.compatible).toBe(true);
    });

    it('should return incompatible for lower version', () => {
      const result = manager.checkCompatibility('v1', 'v2');
      expect(result.compatible).toBe(false);
      expect(result.message).toContain('not compatible');
    });

    it('should return compatible for same version', () => {
      const result = manager.checkCompatibility('v1', 'v1');
      expect(result.compatible).toBe(true);
    });
  });

  describe('getters', () => {
    it('should get current version', () => {
      const current = manager.getCurrentVersion();
      expect(current?.version).toBe('v2');
    });

    it('should get supported versions', () => {
      const supported = manager.getSupportedVersions();
      expect(supported.length).toBe(2);
      expect(supported.map(v => v.version)).toContain('v1');
      expect(supported.map(v => v.version)).toContain('v2');
    });

    it('should get all versions', () => {
      manager.registerVersion('v3', 'development');
      const all = manager.getAllVersions();
      expect(all.length).toBe(3);
    });

    it('should get deprecation notices', () => {
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });

      const notices = manager.getAllDeprecationNotices();
      expect(notices.length).toBe(1);
      expect(notices[0].version).toBe('v1');
    });

    it('should get version history', () => {
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });

      const history = manager.getVersionHistory('v1');
      expect(history.length).toBe(1);
    });
  });

  describe('deprecation warning stats', () => {
    it('should track deprecation warnings', () => {
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });

      // Multiple requests from different clients
      const request1 = createMockRequest({
        headers: { 'x-api-version': 'v1' },
        ip: '127.0.0.1',
      });

      const request2 = createMockRequest({
        headers: { 'x-api-version': 'v1' },
        ip: '127.0.0.2',
      });

      manager.negotiateVersion(request1);
      manager.negotiateVersion(request2);

      const stats = manager.getDeprecationWarningStats();
      expect(stats.get('v1')).toBe(2);
    });

    it('should deduplicate same client warnings', () => {
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });

      // Same client multiple requests
      const request = createMockRequest({
        headers: { 'x-api-version': 'v1' },
        ip: '127.0.0.1',
      });

      manager.negotiateVersion(request);
      manager.negotiateVersion(request);
      manager.negotiateVersion(request);

      const stats = manager.getDeprecationWarningStats();
      expect(stats.get('v1')).toBe(1);
    });

    it('should use user ID for authenticated users', () => {
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });

      const request = createMockRequest({
        headers: { 'x-api-version': 'v1' },
        authContext: {
          authenticated: true,
          user: { sub: 'user-123' },
        },
      });

      manager.negotiateVersion(request);

      const stats = manager.getDeprecationWarningStats();
      expect(stats.get('v1')).toBe(1);
    });
  });

  describe('getRegistry', () => {
    it('should return the underlying registry', () => {
      const reg = manager.getRegistry();
      expect(reg).toBe(registry);
    });
  });
});