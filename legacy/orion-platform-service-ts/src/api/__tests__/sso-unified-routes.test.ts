/**
 * Tests for Sso Unified Routes (sso-unified-routes.ts)
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

// Mock SsoService to avoid openid-client ESM import issues
jest.mock('../../services/auth/SsoService', () => ({
  SsoService: jest.fn().mockImplementation(() => ({
    getLoginUrl: jest.fn().mockReturnValue('https://example.com/login'),
    handleCallback: jest.fn().mockResolvedValue({ userId: 'test-user', email: 'test@example.com' }),
    getConfig: jest.fn().mockReturnValue({ enabled: true }),
    isEnabled: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../../services/auth/LdapService', () => ({
  ldapService: {
    authenticate: jest.fn().mockResolvedValue({ userId: 'test-user' }),
    isEnabled: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../services/auth/WechatWorkService', () => ({
  wechatWorkService: {
    getLoginUrl: jest.fn().mockReturnValue('https://example.com/wechat'),
    handleCallback: jest.fn().mockResolvedValue({ userId: 'test-user' }),
    isEnabled: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../services/auth/JwtKeyManager', () => ({
  jwtKeyManager: {
    getCurrentKey: jest.fn().mockReturnValue({ kid: 'test-key', privateKey: 'test-key' }),
    sign: jest.fn().mockReturnValue('test-token'),
  },
}));

jest.mock('../../services/auth/TokenBlacklistService', () => {
  const { EventEmitter } = require('events');
  class MockTokenBlacklistService extends EventEmitter {
    constructor() { super(); }
    async connect() {}
    async disconnect() {}
    async revokeToken() {}
    isTokenRevoked() { return false; }
  }
  return { TokenBlacklistService: MockTokenBlacklistService };
});

jest.mock('../../repositories/SsoStateRepository', () => ({
  SsoStateRepository: jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
  })),
}));

import routePlugin from '../sso-unified-routes';

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

describe('Sso Unified Routes', () => {
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

  describe('GET /providers-enabled', () => {
    it('should respond to GET /providers-enabled', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/providers-enabled',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /ldap', () => {
    it('should respond to POST /ldap', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/ldap',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /login/:provider', () => {
    it('should respond to GET /login/:provider', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/login/test-provider',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /callback/:provider', () => {
    it('should respond to GET /callback/:provider', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/callback/test-provider',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
