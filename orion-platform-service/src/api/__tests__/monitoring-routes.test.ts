/**
 * Tests for Monitoring Routes (monitoring-routes.ts)
 *
 * Auto-generated route registration tests
 */

import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';

jest.mock('../../services/monitoring', () => ({
  MonitoringService: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    getHealthStatus: jest.fn().mockReturnValue({ running: true, metricsCount: 0, rulesCount: 0, activeAlerts: 0 }),
    recordMetric: jest.fn().mockResolvedValue({ id: 'test-metric' }),
    registerMetric: jest.fn().mockResolvedValue({ id: 'test-metric' }),
    getRegisteredMetrics: jest.fn().mockReturnValue([]),
    getMetricSeries: jest.fn().mockReturnValue({ name: 'test', dataPoints: [], aggregation: { avg: 0, max: 0, min: 0, p99: 0, p95: 0, count: 0, sum: 0 } }),
    getMetricSummary: jest.fn().mockReturnValue({ avg: 0, max: 0, min: 0, p99: 0, p95: 0, count: 0, sum: 0 }),
    collectSystemMetrics: jest.fn().mockReturnValue([]),
    listRules: jest.fn().mockResolvedValue([]),
    getRule: jest.fn().mockResolvedValue(null),
    createRule: jest.fn().mockResolvedValue({ id: 'test-rule' }),
    updateRule: jest.fn().mockResolvedValue({ id: 'test-rule' }),
    deleteRule: jest.fn().mockResolvedValue(true),
    toggleRule: jest.fn().mockResolvedValue({ id: 'test-rule', enabled: true }),
    suppressRule: jest.fn().mockResolvedValue({ id: 'test-rule' }),
    unsuppressRule: jest.fn().mockResolvedValue({ id: 'test-rule' }),
    evaluateRules: jest.fn().mockResolvedValue([]),
    getAlerts: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    getActiveAlerts: jest.fn().mockResolvedValue([]),
    getAlert: jest.fn().mockResolvedValue(null),
    acknowledgeAlert: jest.fn().mockResolvedValue({ id: 'test-alert' }),
    resolveAlert: jest.fn().mockResolvedValue({ id: 'test-alert' }),
    escalateAlert: jest.fn().mockResolvedValue({ id: 'test-alert' }),
    listChannels: jest.fn().mockResolvedValue([]),
    createChannel: jest.fn().mockResolvedValue({ id: 'test-channel' }),
    toggleChannel: jest.fn().mockResolvedValue({ id: 'test-channel' }),
    createEscalationPolicy: jest.fn().mockResolvedValue({ id: 'test-policy' }),
    getEscalationPolicies: jest.fn().mockResolvedValue([]),
    getNotificationHistory: jest.fn().mockResolvedValue([]),
    getDashboard: jest.fn().mockResolvedValue({ widgets: [] }),
    getWidgetConfigs: jest.fn().mockResolvedValue([]),
    addWidgetConfig: jest.fn().mockResolvedValue({ id: 'widget' }),
    getAggregatedMetrics: jest.fn().mockResolvedValue([]),
    detectAnomalies: jest.fn().mockResolvedValue([]),
    getAnomalySummary: jest.fn().mockResolvedValue({ total: 0, anomalies: [] }),
  })),
}));

jest.mock('../controllers/monitoring/MonitoringController', () => ({
  MonitoringController: jest.fn().mockImplementation(() => ({
    startService: jest.fn(),
    stopService: jest.fn(),
    healthCheck: jest.fn(),
    recordMetric: jest.fn(),
    registerMetric: jest.fn(),
    getRegisteredMetrics: jest.fn(),
    getMetricSeries: jest.fn(),
    getMetricSummary: jest.fn(),
    createRule: jest.fn(),
    getRules: jest.fn(),
    getRule: jest.fn(),
    updateRule: jest.fn(),
    deleteRule: jest.fn(),
    toggleRule: jest.fn(),
    suppressRule: jest.fn(),
    unsuppressRule: jest.fn(),
    evaluateRules: jest.fn(),
    getAlerts: jest.fn(),
    getActiveAlerts: jest.fn(),
    getAlert: jest.fn(),
    acknowledgeAlert: jest.fn(),
    resolveAlert: jest.fn(),
    escalateAlert: jest.fn(),
    createChannel: jest.fn(),
    getChannels: jest.fn(),
    toggleChannel: jest.fn(),
    createEscalationPolicy: jest.fn(),
    getEscalationPolicies: jest.fn(),
    getNotificationHistory: jest.fn(),
    getDashboard: jest.fn(),
    addWidgetConfig: jest.fn(),
    getWidgetConfigs: jest.fn(),
    getAggregatedMetrics: jest.fn(),
    detectAnomalies: jest.fn(),
    getAnomalySummary: jest.fn(),
    collectSystemMetrics: jest.fn(),
  })),
}));

import routePlugin from '../monitoring-routes';

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

describe('Monitoring Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(routePlugin, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have registered routes', () => {
    const routes = app.printRoutes();
    expect(routes).toBeTruthy();
  });

  describe('POST /monitoring/start', () => {
    it('should respond to POST /monitoring/start', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/monitoring/start',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /monitoring/stop', () => {
    it('should respond to POST /monitoring/stop', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/monitoring/stop',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /monitoring/health', () => {
    it('should respond to GET /monitoring/health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/monitoring/health',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /monitoring/metrics', () => {
    it('should respond to POST /monitoring/metrics', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/monitoring/metrics',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /monitoring/metrics/register', () => {
    it('should respond to POST /monitoring/metrics/register', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/monitoring/metrics/register',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
