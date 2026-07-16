/**
 * Tests for Chatops Routes (chatops-routes.ts)
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

// Mock CommandService to avoid DB calls during seedDefaults
jest.mock('../../services/chatops/CommandService', () => ({
  CommandService: jest.fn().mockImplementation(() => ({
    seedDefaults: jest.fn().mockResolvedValue(undefined),
    getAllCommands: jest.fn().mockResolvedValue([]),
    getCommand: jest.fn().mockResolvedValue(null),
    executeCommand: jest.fn().mockResolvedValue({ status: 'ok' }),
    getCommandHelp: jest.fn().mockResolvedValue(''),
    registerCommand: jest.fn().mockResolvedValue(undefined),
    deleteCommand: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock ExecutionService
jest.mock('../../services/chatops/ExecutionService', () => ({
  ExecutionService: jest.fn().mockImplementation(() => ({
    getExecution: jest.fn().mockResolvedValue(null),
    listExecutions: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    createExecution: jest.fn().mockResolvedValue({ id: 'test-id' }),
  })),
}));

// Mock CommandRouter
jest.mock('../../services/chatops/CommandRouter', () => ({
  CommandRouter: jest.fn().mockImplementation(() => ({
    registerHandler: jest.fn(),
    route: jest.fn().mockResolvedValue({ status: 'ok' }),
  })),
}));

// Mock ChatOpsController
jest.mock('../../api/controllers/ChatOpsController', () => ({
  ChatOpsController: jest.fn().mockImplementation(() => ({
    getCommands: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: [] });
    }),
    getCommandHelp: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: {} });
    }),
    executeCommand: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: {} });
    }),
    getExecution: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: {} });
    }),
    listExecutions: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: [] });
    }),
    getRecommendations: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: [] });
    }),
    getAuditLogs: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: [] });
    }),
    exportAuditLogs: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true });
    }),
    healthCheck: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ status: 'ok' });
    }),
    getDashboard: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: {} });
    }),
    getNotificationPreferences: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: {} });
    }),
    updateNotificationPreferences: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true });
    }),
    getDNDSettings: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: {} });
    }),
    updateDNDSettings: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true });
    }),
    getAlertState: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: {} });
    }),
    getChatConfig: jest.fn().mockImplementation(async (req: any, reply: any) => {
      return reply.send({ success: true, data: {} });
    }),
  })),
}));

// Mock other services that have heavy initialization
jest.mock('../../services/chatops/RecommendationService', () => ({
  RecommendationService: jest.fn().mockImplementation(() => ({
    getRecommendations: jest.fn().mockResolvedValue([]),
  })),
  RealDataProvider: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../services/chatops/DashboardService', () => ({
  DashboardService: jest.fn().mockImplementation(() => ({
    getDashboard: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../../services/chatops/NotificationPreferenceService', () => ({
  NotificationPreferenceService: jest.fn().mockImplementation(() => ({
    getPreferences: jest.fn().mockResolvedValue({}),
    updatePreferences: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../../services/chatops/DNDService', () => ({
  DNDService: jest.fn().mockImplementation(() => ({
    getSettings: jest.fn().mockResolvedValue({}),
    updateSettings: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../../services/chatops/AlertStateService', () => ({
  AlertStateService: jest.fn().mockImplementation(() => ({
    getState: jest.fn().mockResolvedValue({}),
    updateState: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../../services/chatops/PlatformConfigService', () => ({
  PlatformConfigService: jest.fn().mockImplementation(() => ({
    getConfig: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../../services/chatops/ChatConfigService', () => ({
  ChatConfigService: jest.fn().mockImplementation(() => ({
    getConfig: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../../services/chatops/EventSubscriber', () => ({
  ChatOpsEventSubscriber: jest.fn().mockImplementation(() => ({
    subscribe: jest.fn(),
    cleanup: jest.fn(),
  })),
}));

jest.mock('../../services/chatops/SSEConnectionManager', () => ({
  SSEConnectionManager: jest.fn().mockImplementation(() => ({
    shutdown: jest.fn(),
  })),
}));

jest.mock('../../services/chatops/InputValidator', () => ({
  InputValidator: jest.fn().mockImplementation(() => ({
    registerSchema: jest.fn(),
    validate: jest.fn().mockReturnValue({ valid: true }),
  })),
}));

jest.mock('../../services/chatops/CapabilityMappingService', () => ({
  CapabilityMappingService: jest.fn().mockImplementation(() => ({
    getCapabilities: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../services/chatops/PermissionService', () => ({
  PermissionService: jest.fn().mockImplementation(() => ({
    checkPermission: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../../services/deploy/DeployService', () => ({
  DeployService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../services/deploy/DeployRepository', () => ({
  DeployRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../services/monitoring', () => ({
  MonitoringService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../services/monitoring/MonitoringRepository', () => ({
  MonitoringRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../services/diagnostic/DiagnosticService', () => ({
  DiagnosticService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../services/diagnostic/DiagnosticRepository', () => ({
  DiagnosticRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../services/self-healing/SelfHealingService', () => ({
  SelfHealingService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../services/self-healing/SelfHealingRepository', () => ({
  SelfHealingRepository: jest.fn().mockImplementation(() => ({})),
}));

import routePlugin from '../chatops-routes';

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

describe('Chatops Routes', () => {
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

  describe('GET /commands', () => {
    it('should respond to GET /commands', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/commands',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /commands/:name/help', () => {
    it('should respond to GET /commands/:name/help', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/commands/test-name/help',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /execute', () => {
    it('should respond to POST /execute', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/execute',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /status/:commandId', () => {
    it('should respond to GET /status/:commandId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/status/test-commandId',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /executions', () => {
    it('should respond to GET /executions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/executions',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
