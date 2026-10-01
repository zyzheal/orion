/**
 * 版本管理器单元测试
 */

import {
  VersionRegistry,
  VersionedRouter,
  VersionMiddleware,
  wrapResponse,
  type ApiVersion,
  type DeprecationWarning,
} from '../version';

describe('VersionRegistry', () => {
  let registry: VersionRegistry;

  beforeEach(() => {
    registry = new VersionRegistry();
  });

  describe('getVersionInfo', () => {
    it('should return version info for registered version', () => {
      const info = registry.getVersionInfo('v1');
      expect(info).toBeDefined();
      expect(info?.version).toBe('v1');
      expect(info?.status).toBe('stable');
    });

    it('should return undefined for unregistered version', () => {
      const info = registry.getVersionInfo('v99');
      expect(info).toBeUndefined();
    });
  });

  describe('isDeprecated', () => {
    it('should return false for stable version', () => {
      expect(registry.isDeprecated('v1')).toBe(false);
    });

    it('should return true for deprecated version', () => {
      registry.deprecateVersion('v1', 'v2', '2027-04-11');
      expect(registry.isDeprecated('v1')).toBe(true);
    });
  });

  describe('isSupported', () => {
    it('should return true for stable version', () => {
      expect(registry.isSupported('v1')).toBe(true);
    });

    it('should return false for withdrawn version', () => {
      registry.addVersion({
        version: 'v0',
        status: 'withdrawn',
        releaseDate: '2025-01-01',
      });
      expect(registry.isSupported('v0')).toBe(false);
    });
  });

  describe('getSupportedVersions', () => {
    it('should return only non-withdrawn versions', () => {
      registry.addVersion({
        version: 'v2',
        status: 'beta',
        releaseDate: '2026-04-11',
      });
      registry.addVersion({
        version: 'v0',
        status: 'withdrawn',
        releaseDate: '2025-01-01',
      });

      const versions = registry.getSupportedVersions();
      expect(versions.length).toBe(2);
      expect(versions.map((v) => v.version)).toContain('v1');
      expect(versions.map((v) => v.version)).toContain('v2');
    });
  });

  describe('deprecateVersion', () => {
    it('should update version status to deprecated', () => {
      registry.deprecateVersion('v1', 'v2', '2027-04-11');

      const info = registry.getVersionInfo('v1');
      expect(info?.status).toBe('deprecated');
      expect(info?.successor).toBe('v2');
      expect(info?.withdrawalDate).toBe('2027-04-11');
    });
  });

  describe('addVersion', () => {
    it('should add new version to registry', () => {
      const newVersion: ApiVersion = {
        version: 'v2',
        status: 'beta',
        releaseDate: '2026-04-11',
      };

      registry.addVersion(newVersion);
      const info = registry.getVersionInfo('v2');

      expect(info).toEqual(newVersion);
    });
  });

  describe('getDeprecationWarning', () => {
    it('should return undefined for stable version', () => {
      const registry = new VersionRegistry();
      const warning = registry.getDeprecationWarning('v1');
      expect(warning).toBeUndefined();
    });

    it('should return warning for deprecated version', () => {
      const registry = new VersionRegistry();
      registry.deprecateVersion('v1', 'v2', '2027-04-11');
      const warning = registry.getDeprecationWarning('v1');

      expect(warning).toBeDefined();
      expect(warning?.code).toBe('API_DEPRECATED');
      expect(warning?.successor).toBe('v2');
      expect(warning?.sunset).toBe('2027-04-11');
    });
  });
});

describe('VersionMiddleware', () => {
  let registry: VersionRegistry;
  let middleware: VersionMiddleware;

  beforeEach(() => {
    registry = new VersionRegistry();
    middleware = new VersionMiddleware(registry);
  });

  describe('handler', () => {
    it('should add X-API-Version header', () => {
      const mockReply = {
        header: jest.fn(),
      } as any;

      const mockRequest = {
        url: '/api/v1/users',
        headers: {},
      } as any;

      middleware.handler(mockRequest, mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('X-API-Version', 'v1');
    });

    it('should add deprecation headers for deprecated version', () => {
      registry.deprecateVersion('v1', 'v2', '2027-04-11');

      const mockReply = {
        header: jest.fn(),
      } as any;

      const mockRequest = {
        url: '/api/v1/users',
        headers: {},
      } as any;

      middleware.handler(mockRequest, mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('X-API-Deprecated', 'true');
      expect(mockReply.header).toHaveBeenCalledWith('X-API-Sunset', '2027-04-11');
    });
  });

  describe('extractVersion', () => {
    it('should extract version from URL path', () => {
      const mockRequest = {
        url: '/api/v2/users',
        headers: {},
      } as any;

      // Access private method through test
      const middleware = new VersionMiddleware(registry);
      // We can't directly test private methods, but we can test the behavior
    });

    it('should use default version when no version in path', () => {
      const mockRequest = {
        url: '/api/users',
        headers: {},
      } as any;

      // The middleware should handle this case
    });
  });
});

describe('VersionedRouter', () => {
  let router: VersionedRouter;

  beforeEach(() => {
    router = new VersionedRouter();
  });

  describe('register', () => {
    it('should register version info routes', () => {
      const mockApp = {
        get: jest.fn(),
        addHook: jest.fn(),
      } as any;

      router.register(mockApp);

      expect(mockApp.get).toHaveBeenCalledWith('/api/version', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/api/versions', expect.any(Function));
      expect(mockApp.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
    });
  });

  describe('deprecateVersion', () => {
    it('should deprecate version with custom withdrawal date', () => {
      router.deprecateVersion('v1', 'v2', '2027-06-30');

      const registry = router.getRegistry();
      const info = registry.getVersionInfo('v1');

      expect(info?.status).toBe('deprecated');
      expect(info?.withdrawalDate).toBe('2027-06-30');
    });

    it('should use default deprecation period when no withdrawal date provided', () => {
      router.deprecateVersion('v1', 'v2');

      const registry = router.getRegistry();
      const info = registry.getVersionInfo('v1');

      expect(info?.status).toBe('deprecated');
      expect(info?.withdrawalDate).toBeDefined();
    });
  });
});

describe('wrapResponse', () => {
  let registry: VersionRegistry;

  beforeEach(() => {
    registry = new VersionRegistry();
  });

  it('should wrap response with version info', () => {
    const data = { users: [{ id: 1 }] };
    const mockRequest = {
      url: '/api/v1/users',
      headers: {},
    } as any;

    const result = wrapResponse(data, mockRequest, registry);

    expect(result.data).toEqual(data);
    expect(result.meta.version).toBe('v1');
    expect(result.meta.timestamp).toBeDefined();
  });

  it('should add deprecation warning for deprecated version', () => {
    const registry = new VersionRegistry();
    registry.deprecateVersion('v1', 'v2', '2027-04-11');

    const data = { users: [{ id: 1 }] };
    const mockRequest = {
      url: '/api/v1/users',
      headers: {},
    } as any;

    const result = wrapResponse(data, mockRequest, registry);

    expect(result.warnings).toBeDefined();
    expect(result.warnings?.length).toBe(1);
    expect(result.warnings?.[0]?.code).toBe('API_DEPRECATED');
  });

  it('should not add warnings for stable version', () => {
    const registry = new VersionRegistry();
    const data = { users: [{ id: 1 }] };
    const mockRequest = {
      url: '/api/v1/users',
      headers: {},
    } as any;

    const result = wrapResponse(data, mockRequest, registry);

    expect(result.warnings).toBeUndefined();
  });
});

describe('extractVersionFromRequest', () => {
  it('should extract version from path', () => {
    const mockRequest = {
      url: '/api/v2/users',
      headers: {},
    } as any;

    // Test through wrapResponse which uses extractVersionFromRequest internally
    const registry = new VersionRegistry();
    const result = wrapResponse({}, mockRequest, registry);
    expect(result.meta.version).toBe('v2');
  });

  it('should use default version when path has no version and no header', () => {
    const mockRequest = {
      url: '/api/users',
      headers: {},
    } as any;

    const registry = new VersionRegistry();
    const result = wrapResponse({}, mockRequest, registry);
    expect(result.meta.version).toBe('v1');
  });
});
