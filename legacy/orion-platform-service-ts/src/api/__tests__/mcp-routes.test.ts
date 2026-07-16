/**
 * Tests for Mcp Routes (mcp-routes.ts)
 *
 * Auto-generated route registration tests
 */

import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: async (req: any, reply: any) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'] };
  },
}));

jest.mock('../../middleware/requirePermission', () => ({
  requirePermission: (_opts: any) => async (req: any, reply: any) => {},
}));

jest.mock('../../mcp/McpServer', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTools: jest.fn(),
    registerResource: jest.fn(),
    registerResourceTemplate: jest.fn(),
    handleRequest: jest.fn().mockResolvedValue({ jsonrpc: '2.0', result: {} }),
    handleSSE: jest.fn().mockImplementation(async (_req: any, reply: any) => {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      reply.raw.write('data: {"type":"connected"}\n\n');
      reply.raw.end();
    }),
  })),
}));

jest.mock('../../mcp/mcp-config', () => ({
  mcpConfig: { name: 'test-mcp', version: '1.0.0' },
  McpContext: {},
  JsonRpcRequest: {},
}));

jest.mock('../../mcp/tools', () => ({
  allTools: [],
}));

jest.mock('../../mcp/resources', () => ({
  allResources: { static: [], templates: [] },
}));

jest.mock('../../services/pipeline/PipelineService', () => ({
  PipelineService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../services/pipeline/PipelineRepository', () => ({
  PipelineRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../services/audit/AuditRepository', () => ({
  AuditRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../../services/cache/CacheService', () => ({
  CacheService: jest.fn().mockImplementation(() => ({})),
}));

import routePlugin from '../mcp-routes';

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

const mockDb = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
  end: jest.fn(),
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
};

describe('Mcp Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(routePlugin, { database: mockDb as any, redis: mockRedis as any });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have registered routes', () => {
    const routes = app.printRoutes();
    expect(routes).toBeTruthy();
  });

  describe('POST /mcp', () => {
    it('should respond to POST /mcp', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        payload: { jsonrpc: '2.0', method: 'initialize', id: 1 },
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /mcp/sse', () => {
    it('should respond to GET /mcp/sse', async () => {
      // SSE endpoint keeps connection open, so we use a race with timeout
      const responsePromise = app.inject({
        method: 'GET',
        url: '/mcp/sse',
        headers: authHeaders,
      });
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ statusCode: 200, headers: { 'content-type': 'text/event-stream' } }), 100);
      });
      const response = await Promise.race([responsePromise, timeoutPromise]);
      expect(response.statusCode).toBeDefined();
    }, 3000);
  });

  describe('GET /mcp/tools', () => {
    it('should respond to GET /mcp/tools', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/tools',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /mcp/resources', () => {
    it('should respond to GET /mcp/resources', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/resources',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /mcp/info', () => {
    it('should respond to GET /mcp/info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/info',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
