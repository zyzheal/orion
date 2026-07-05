/**
 * Integration tests for Service Registry Routes (service-registry-routes.ts)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import serviceRegistryRoutes, { mapEntityToServiceInfo } from '../service-registry-routes';
import { ServiceRegistryRepository } from '../../repositories/ServiceRegistryRepository';

// ─── Auth mocks ───────────────────────────────────────────────────────────────

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: async (req: any, _reply: any) => {
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'], tenantId: 1 };
  },
}));

jest.mock('../../middleware/requirePermission', () => ({
  requirePermission: () => async (_req: any, _reply: any) => {},
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildApp(database?: any): FastifyInstance {
  const app = Fastify({ logger: false });
  // Bypass auth hook for tests
  (app as any).register = async (plugin: any, opts?: any) => {
    if (typeof plugin === 'function') {
      await plugin(app, opts);
    } else {
      await app.register(plugin, opts);
    }
  };
  return app;
}

function mockRepository(
  overrides: Partial<ServiceRegistryRepository> = {},
): jest.Mocked<ServiceRegistryRepository> {
  return {
    getTenantId: jest.fn().mockReturnValue('1'),
    findByTenantId: jest.fn().mockResolvedValue([]),
    findByServiceId: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(undefined),
    register: jest.fn(),
    deregister: jest.fn(),
    updateHealth: jest.fn(),
    recordHeartbeat: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<ServiceRegistryRepository>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Service Registry Routes', () => {
  it('should export a default Fastify plugin function', () => {
    expect(typeof serviceRegistryRoutes).toBe('function');
  });

  it('should export the mapper helper', () => {
    expect(typeof mapEntityToServiceInfo).toBe('function');
  });
});

describe('Service Registry Routes — mapper', () => {
  it('maps a full entity to frontend ServiceInfo shape', () => {
    const entity = {
      id: 'internal-123',
      serviceId: 'user-svc',
      serviceName: 'User Service',
      serviceUrl: 'http://10.0.0.5:8080',
      protocol: 'http',
      version: '2.1.0',
      healthStatus: 'healthy',
      lastHeartbeatAt: new Date('2026-07-04T10:00:00Z'),
      metadata: { region: 'us-east-1' },
      registeredAt: new Date('2026-01-01T00:00:00Z'),
    };

    const result = mapEntityToServiceInfo(entity);

    expect(result).toEqual({
      id: 'internal-123',
      serviceId: 'user-svc',
      name: 'User Service',
      address: '10.0.0.5',
      port: 8080,
      protocol: 'http',
      version: '2.1.0',
      health: 'healthy',
      registeredAt: '2026-01-01T00:00:00.000Z',
      lastHeartbeat: '2026-07-04T10:00:00.000Z',
      metadata: { region: 'us-east-1' },
    });
  });

  it('parses host and port from URL with scheme', () => {
    const entity = {
      id: '1',
      serviceId: 'grpc-svc',
      serviceName: 'gRPC Service',
      serviceUrl: 'grpc://10.0.1.10:50051',
      protocol: 'grpc',
      version: '1.0.0',
      healthStatus: 'degraded',
      lastHeartbeatAt: null,
      metadata: {},
      registeredAt: new Date('2026-02-01T00:00:00Z'),
    };

    const result = mapEntityToServiceInfo(entity);

    expect(result.address).toBe('10.0.1.10');
    expect(result.port).toBe(50051);
    expect(result.protocol).toBe('grpc');
    expect(result.health).toBe('degraded');
    expect(result.lastHeartbeat).toBeUndefined();
  });

  it('returns port 443 for https without explicit port', () => {
    const entity = {
      id: '2',
      serviceId: 'secure-svc',
      serviceName: 'Secure Service',
      serviceUrl: 'https://secure.example.com',
      protocol: 'http',
      version: '3.0.0',
      healthStatus: 'unknown',
      lastHeartbeatAt: null,
      metadata: {},
      registeredAt: new Date('2026-03-01T00:00:00Z'),
    };

    const result = mapEntityToServiceInfo(entity);

    expect(result.address).toBe('secure.example.com');
    expect(result.port).toBe(443);
  });

  it('falls back to full URL when parsing fails', () => {
    const entity = {
      id: '3',
      serviceId: 'bad-svc',
      serviceName: 'Bad Service',
      serviceUrl: 'not-a-valid-url://:abc',
      protocol: 'custom',
      version: '0.1.0',
      healthStatus: 'unhealthy',
      lastHeartbeatAt: null,
      metadata: {},
      registeredAt: new Date('2026-04-01T00:00:00Z'),
    };

    const result = mapEntityToServiceInfo(entity);

    expect(result.address).toBe('not-a-valid-url://:abc');
    expect(result.port).toBe(0);
  });
});

describe('Service Registry Routes — handler wiring (no DB)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(async (instance: FastifyInstance) => {
      await serviceRegistryRoutes(instance, { database: undefined });
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /services returns 503 when repository is unavailable', async () => {
    const response = await app.inject({ method: 'GET', url: '/services' });
    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('POST /register returns 503 when repository is unavailable', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/register',
      headers: { 'content-type': 'application/json' },
      payload: { serviceId: 'x', serviceName: 'X', serviceUrl: 'http://x' },
    });
    expect(response.statusCode).toBe(503);
  });

  it('DELETE /services/:id returns 503 when repository is unavailable', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/services/some-id' });
    expect(response.statusCode).toBe(503);
  });

  it('GET /services/:id/health returns 503 when repository is unavailable', async () => {
    const response = await app.inject({ method: 'GET', url: '/services/some-id/health' });
    expect(response.statusCode).toBe(503);
  });

  it('POST /services/:id/heartbeat returns 503 when repository is unavailable', async () => {
    const response = await app.inject({ method: 'POST', url: '/services/some-id/heartbeat' });
    expect(response.statusCode).toBe(503);
  });
});

describe('Service Registry Routes — handler wiring (with mock DB)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    const mockRepo = mockRepository();

    await app.register(async (instance: FastifyInstance) => {
      // Override the repository constructor by pre-loading a mock module
      const original = await import('../../repositories/ServiceRegistryRepository');
      (original as any).ServiceRegistryRepository = jest.fn(() => mockRepo);

      await serviceRegistryRoutes(instance, { database: {} as any });
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /services returns list with success shape', async () => {
    const repo = (ServiceRegistryRepository as jest.MockedClass<typeof ServiceRegistryRepository>).mock.results[0].value;
    (repo.findByTenantId as jest.Mock).mockResolvedValue([
      {
        id: 'svc-1',
        serviceId: 'svc-a',
        serviceName: 'Service A',
        serviceUrl: 'http://10.0.0.1:3000',
        protocol: 'http',
        version: '1.0.0',
        healthStatus: 'healthy',
        lastHeartbeatAt: new Date(),
        metadata: {},
        registeredAt: new Date(),
      },
    ]);

    const response = await app.inject({ method: 'GET', url: '/services' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Service A');
    expect(body.data[0].address).toBe('10.0.0.1');
    expect(body.data[0].port).toBe(3000);
    expect(body.data[0].health).toBe('healthy');
  });

  it('GET /services/:id/health returns health payload', async () => {
    const repo = (ServiceRegistryRepository as jest.MockedClass<typeof ServiceRegistryRepository>).mock.results[0].value;
    (repo.findById as jest.Mock).mockResolvedValue({
      id: 'svc-1',
      serviceId: 'svc-a',
      serviceName: 'Service A',
      serviceUrl: 'http://10.0.0.1:3000',
      protocol: 'http',
      version: '1.0.0',
      healthStatus: 'healthy',
      lastHeartbeatAt: new Date('2026-07-04T08:00:00Z'),
      metadata: {},
      registeredAt: new Date(),
    });

    const response = await app.inject({ method: 'GET', url: '/services/svc-1/health' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.serviceId).toBe('svc-a');
    expect(body.data.status).toBe('healthy');
    expect(body.data.latencyMs).toBe(0);
    expect(body.data.errorRate).toBe(0);
    expect(body.data.lastHeartbeat).toBeDefined();
  });

  it('POST /register creates and returns 201 with entity', async () => {
    const repo = (ServiceRegistryRepository as jest.MockedClass<typeof ServiceRegistryRepository>).mock.results[0].value;
    (repo.findByServiceId as jest.Mock).mockResolvedValue(undefined);
    (repo.register as jest.Mock).mockResolvedValue({
      id: 'new-id',
      serviceId: 'new-svc',
      serviceName: 'New Service',
      serviceUrl: 'http://10.0.0.9:4000',
      protocol: 'http',
      version: '1.0.0',
      healthStatus: 'unknown',
      lastHeartbeatAt: null,
      metadata: {},
      registeredAt: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/register',
      headers: { 'content-type': 'application/json' },
      payload: {
        serviceId: 'new-svc',
        serviceName: 'New Service',
        serviceUrl: 'http://10.0.0.9:4000',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.serviceId).toBe('new-svc');
    expect(body.data.name).toBe('New Service');
    expect(body.data.port).toBe(4000);
  });

  it('POST /register rejects duplicate serviceId with 409', async () => {
    const repo = (ServiceRegistryRepository as jest.MockedClass<typeof ServiceRegistryRepository>).mock.results[0].value;
    (repo.findByServiceId as jest.Mock).mockResolvedValue({ serviceId: 'dup-svc' } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/register',
      headers: { 'content-type': 'application/json' },
      payload: {
        serviceId: 'dup-svc',
        serviceName: 'Dup Service',
        serviceUrl: 'http://10.0.0.2:3000',
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('ALREADY_EXISTS');
  });

  it('POST /register returns 400 when required fields are missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/register',
      headers: { 'content-type': 'application/json' },
      payload: { serviceName: 'No Id' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE /services/:id returns 404 when service not found', async () => {
    const repo = (ServiceRegistryRepository as jest.MockedClass<typeof ServiceRegistryRepository>).mock.results[0].value;
    (repo.findById as jest.Mock).mockResolvedValue(undefined);

    const response = await app.inject({ method: 'DELETE', url: '/services/nonexistent' });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('DELETE /services/:id deregisters successfully', async () => {
    const repo = (ServiceRegistryRepository as jest.MockedClass<typeof ServiceRegistryRepository>).mock.results[0].value;
    (repo.findById as jest.Mock).mockResolvedValue({
      id: 'svc-1',
      serviceId: 'svc-a',
    } as any);
    (repo.deregister as jest.Mock).mockResolvedValue(undefined);

    const response = await app.inject({ method: 'DELETE', url: '/services/svc-1' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.message).toContain('deregistered');
    expect(repo.deregister).toHaveBeenCalledWith('svc-a');
  });

  it('POST /services/:id/heartbeat returns 200 on success', async () => {
    const repo = (ServiceRegistryRepository as jest.MockedClass<typeof ServiceRegistryRepository>).mock.results[0].value;
    (repo.findById as jest.Mock).mockResolvedValue({
      id: 'svc-1',
      serviceId: 'svc-a',
    } as any);
    (repo.recordHeartbeat as jest.Mock).mockResolvedValue(undefined);

    const response = await app.inject({ method: 'POST', url: '/services/svc-1/heartbeat' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Heartbeat recorded');
    expect(repo.recordHeartbeat).toHaveBeenCalledWith('svc-a');
  });

  it('GET /services/:id/health returns 404 when service not found', async () => {
    const repo = (ServiceRegistryRepository as jest.MockedClass<typeof ServiceRegistryRepository>).mock.results[0].value;
    (repo.findById as jest.Mock).mockResolvedValue(undefined);

    const response = await app.inject({ method: 'GET', url: '/services/nonexistent/health' });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('NOT_FOUND');
  });
});
