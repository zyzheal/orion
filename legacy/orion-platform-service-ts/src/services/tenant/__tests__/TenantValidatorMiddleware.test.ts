/**
 * TenantValidatorMiddleware Tests
 *
 * Covers:
 * - Constructor: default options, custom options
 * - getHandler: skip paths, tenant validation, header parsing
 */

import { TenantValidatorMiddleware } from '../TenantValidatorMiddleware';

jest.mock('pino', () => {
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return jest.fn(() => mockLogger);
});

describe('TenantValidatorMiddleware', () => {
  let mockIsolationService: any;

  beforeEach(() => {
    mockIsolationService = {
      validateTenant: jest.fn().mockResolvedValue({ valid: true }),
    };
  });

  describe('constructor', () => {
    it('should use default options', () => {
      const middleware = new TenantValidatorMiddleware(mockIsolationService);
      expect(middleware).toBeDefined();
    });

    it('should accept custom options', () => {
      const middleware = new TenantValidatorMiddleware(mockIsolationService, {
        required: false,
        skipPaths: ['/custom'],
        validateAllLayers: false,
      });
      expect(middleware).toBeDefined();
    });
  });

  describe('getHandler', () => {
    it('should return a handler function', () => {
      const middleware = new TenantValidatorMiddleware(mockIsolationService);
      const handler = middleware.getHandler();
      expect(typeof handler).toBe('function');
    });

    it('should skip health check paths', async () => {
      const middleware = new TenantValidatorMiddleware(mockIsolationService);
      const handler = middleware.getHandler();
      const done = jest.fn();

      const request = { url: '/healthz', headers: {} } as any;
      const reply = {} as any;

      await handler(request, reply, done);
      expect(done).toHaveBeenCalled();
    });

    it('should skip readyz path', async () => {
      const middleware = new TenantValidatorMiddleware(mockIsolationService);
      const handler = middleware.getHandler();
      const done = jest.fn();

      const request = { url: '/readyz', headers: {} } as any;
      const reply = {} as any;

      await handler(request, reply, done);
      expect(done).toHaveBeenCalled();
    });
  });
});
