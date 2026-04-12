/**
 * 版本协商中间件测试
 */

import { VersionMiddleware, createVersionMiddleware, initVersionMiddleware } from '../version';
import { ApiVersionManager } from '../../services/ApiVersionManager';
import { ApiVersionRegistry } from '../../services/ApiVersionRegistry';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';

describe('VersionMiddleware', () => {
  let registry: ApiVersionRegistry;
  let manager: ApiVersionManager;
  let middleware: VersionMiddleware;
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    registry = new ApiVersionRegistry({
      currentVersion: 'v2',
      defaultVersion: 'v1',
      supportedVersions: ['v1', 'v2'],
    });

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
    await manager.initialize();

    middleware = new VersionMiddleware(manager);

    app = Fastify({ logger: false });

    // Register middleware
    app.addHook('onRequest', middleware.handler.bind(middleware));

    // Register routes for testing
    app.get('/api/v1/test', async (request: FastifyRequest, reply: FastifyReply) => {
      return { version: request.versionContext?.version };
    });

    app.get('/api/v2/test', async (request: FastifyRequest, reply: FastifyReply) => {
      return { version: request.versionContext?.version };
    });

    app.get('/healthz', async (request: FastifyRequest, reply: FastifyReply) => {
      return { status: 'ok' };
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('handler', () => {
    it('should set version context from header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test',
        headers: {
          'x-api-version': 'v2',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.version).toBe('v2');
    });

    it('should set version context from URL', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/test',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.version).toBe('v2');
    });

    it('should set default version when not specified', async () => {
      // Register route without version prefix
      app.get('/test-default', async (request: FastifyRequest, reply: FastifyReply) => {
        return { version: request.versionContext?.version };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test-default',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.version).toBe('v1');  // defaultVersion
    });

    it('should skip version check for public paths', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/healthz',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBeUndefined();
    });

    it('should set deprecation headers for deprecated version', async () => {
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
        migrationGuide: '/docs/api/v2-migration',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');
      expect(response.headers['x-api-deprecated']).toBe('true');
      expect(response.headers['x-api-deprecation-date']).toBe('2026-06-01');
      expect(response.headers['x-api-sunset-date']).toBe('2026-12-01');
      expect(response.headers['x-api-migration-guide']).toBe('/docs/api/v2-migration');
      expect(response.headers['warning']).toContain('deprecated');
    });

    it('should return 410 for retired version', async () => {
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });
      registry.updateVersionStatus('v1', 'retired');

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test',
      });

      expect(response.statusCode).toBe(410);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VERSION_RETIRED');
      expect(body.details.supportedVersions).toContain('v2');
    });
  });

  describe('addPublicPath', () => {
    it('should add and use public path', async () => {
      middleware.addPublicPath('/custom-public');

      app.get('/custom-public', async (request: FastifyRequest, reply: FastifyReply) => {
        return { status: 'public' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/custom-public',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('registerRoutes', () => {
    beforeEach(async () => {
      middleware.registerRoutes(app);
    });

    it('should return version info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/version/info',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.currentVersion).toBe('v2');
      expect(body.supportedVersions.length).toBe(2);
    });

    it('should return deprecation notices', async () => {
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/version/deprecation',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.notices.length).toBe(1);
      expect(body.notices[0].version).toBe('v1');
    });

    it('should return version history', async () => {
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/version/history',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.history.length).toBe(1);
    });

    it('should filter version history by version', async () => {
      registry.registerVersion({ version: 'v3', status: 'development', features: [] });
      registry.updateVersionStatus('v1', 'deprecated', {
        deprecationDate: new Date('2026-06-01'),
        sunsetDate: new Date('2026-12-01'),
      });
      registry.updateVersionStatus('v3', 'stable');

      const response = await app.inject({
        method: 'GET',
        url: '/api/version/history?version=v1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.history.length).toBe(1);
      expect(body.history[0].version).toBe('v1');
    });
  });

  describe('options', () => {
    it('should use custom header name', async () => {
      // Create manager with custom header name
      const customManager = new ApiVersionManager(registry, {
        headerName: 'api-version',
      });
      await customManager.initialize();

      const customMiddleware = new VersionMiddleware(customManager, {
        headerName: 'api-version',
      });

      const customApp = Fastify({ logger: false });
      customApp.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply) => {
        return customMiddleware.handler(request, reply);
      });
      customApp.get('/api/test', async (request: FastifyRequest) => {
        return { version: request.versionContext?.version };
      });

      const response = await customApp.inject({
        method: 'GET',
        url: '/api/test',
        headers: {
          'api-version': 'v2',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.version).toBe('v2');

      await customApp.close();
    });

    it('should use custom public paths', async () => {
      const customMiddleware = new VersionMiddleware(manager, {
        publicPaths: ['/health', '/metrics'],
      });

      const customApp = Fastify({ logger: false });
      customApp.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply) => {
        return customMiddleware.handler(request, reply);
      });
      customApp.get('/health', async () => ({ status: 'ok' }));
      customApp.get('/healthz', async () => ({ status: 'ok' }));

      // Custom path should be public
      const response1 = await customApp.inject({
        method: 'GET',
        url: '/health',
      });
      expect(response1.statusCode).toBe(200);

      // Default public path should require version now
      const response2 = await customApp.inject({
        method: 'GET',
        url: '/healthz',
      });
      expect(response2.statusCode).toBe(200);  // fallback to default version

      await customApp.close();
    });
  });

  describe('createVersionMiddleware factory', () => {
    it('should create middleware instance', () => {
      const mw = createVersionMiddleware(manager);
      expect(mw).toBeInstanceOf(VersionMiddleware);
    });
  });

  describe('initVersionMiddleware', () => {
    it('should initialize and return middleware', () => {
      const mw = initVersionMiddleware(manager);
      expect(mw).toBeInstanceOf(VersionMiddleware);

      // Check global instance
      const globalMw = require('../version').versionMiddleware;
      expect(globalMw).toBe(mw);
    });
  });
});