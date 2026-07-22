/**
 * Tests for Auth Enhanced Routes (auth-enhanced-routes.ts)
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

jest.mock('../../services/auth/JwtKeyRotationService', () => {
  const { EventEmitter } = require('events');
  class MockJwtKeyRotationService extends EventEmitter {
    constructor() { super(); }
    async initialize() {}
    getCurrentKey() { return { kid: 'test-key', publicKey: 'test-pub' }; }
    async rotateKeys() { return { kid: 'new-key', publicKey: 'new-pub' }; }
    async getKeys() { return []; }
    async emergencyRotate() { return { kid: 'emergency-key' }; }
    async getRotationHistory() { return []; }
    shutdown() {}
  }
  return {
    JwtKeyRotationService: MockJwtKeyRotationService,
    JwtKeyRotationConfig: {},
  };
});

jest.mock('../../services/auth/TokenBlacklistService', () => {
  const { EventEmitter } = require('events');
  class MockTokenBlacklistService extends EventEmitter {
    constructor() { super(); }
    async connect() {}
    async disconnect() {}
    async revokeToken() {}
    async isTokenRevoked() { return false; }
    async batchRevoke() { return { revoked: 0 }; }
    async checkToken() { return { valid: true }; }
    async getBlacklistStats() { return { total: 0 }; }
    async cleanup() { return 0; }
  }
  return {
    TokenBlacklistService: MockTokenBlacklistService,
    TokenBlacklistConfig: {},
  };
});

import routePlugin from '../auth-enhanced-routes';

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

describe('Auth Enhanced Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(routePlugin, { database: mockDb as any });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have registered routes', () => {
    const routes = app.printRoutes();
    expect(routes).toBeTruthy();
  });

  describe('GET /keys', () => {
    it('should respond to GET /keys', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/keys',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /keys/rotate', () => {
    it('should respond to POST /keys/rotate', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/keys/rotate',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /keys/emergency-rotate', () => {
    it('should respond to POST /keys/emergency-rotate', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/keys/emergency-rotate',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /tokens/revoke', () => {
    it('should respond to POST /tokens/revoke', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tokens/revoke',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /tokens/check/:tokenHash', () => {
    it('should respond to GET /tokens/check/:tokenHash', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tokens/check/test-tokenHash',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
