/**
 * Progressive Routes Tests
 *
 * Tests for stage-based progressive deployment routes.
 * Service layer is mocked; tests verify Fastify routing + auth + error handling.
 */

import Fastify, { FastifyInstance } from 'fastify';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import progressiveRoutes from '../progressive-routes';

// Mock auth middleware
jest.mock('../../middleware/authMiddleware');
jest.mock('../../middleware/requirePermission');

// Mock tenant context
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: jest.fn(() => 'tenant-1'),
  getCurrentTraceId: jest.fn(() => 'trace-1'),
}));

// Shared mock state
const mockDeploy = {
  findByDeployment: jest.fn(),
  delete: jest.fn(),
  advanceStage: jest.fn(),
  rollbackStage: jest.fn(),
  rollback: jest.fn(),
  getProgress: jest.fn(),
};

// Mock the barrel that progressive-routes imports from
jest.mock('../../services/deploy', () => ({
  ProgressiveDeployRepository: jest.fn(() => ({
    findByDeployment: mockDeploy.findByDeployment,
    delete: mockDeploy.delete,
  })),
  ProgressiveDeployService: jest.fn(() => ({
    advanceStage: mockDeploy.advanceStage,
    rollbackStage: mockDeploy.rollbackStage,
    rollback: mockDeploy.rollback,
    getProgress: mockDeploy.getProgress,
  })),
  DeployRepository: jest.fn(),
}));

describe('Progressive Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(progressiveRoutes, { database: {} as any });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockDeploy).forEach(m => m.mockReset());
  });

  describe('POST /features/:id/advance', () => {
    it('should advance traffic for existing deployment', async () => {
      mockDeploy.findByDeployment.mockResolvedValue([{ id: 'stage-1', status: 'running', name: 'canary-10%' }]);
      mockDeploy.advanceStage.mockResolvedValue({
        message: 'Advanced to next stage',
        previousStage: { name: 'canary-10%', status: 'completed' },
        nextStage: { name: 'canary-50%', status: 'running' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/features/test-feature/advance',
        headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain('Advanced');
    });

    it('should return 404 for non-existent deployment', async () => {
      mockDeploy.findByDeployment.mockResolvedValue([]);

      const response = await app.inject({
        method: 'POST',
        url: '/features/non-existent/advance',
        headers: { authorization: 'Bearer test-token' },
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /features/:id/rollback', () => {
    it('should rollback a deployment', async () => {
      mockDeploy.findByDeployment.mockResolvedValue([{ id: 'stage-1', status: 'running' }]);
      mockDeploy.rollback.mockResolvedValue({
        message: 'Rolled back to previous stage',
        rolledBackStage: { name: 'canary-50%', status: 'rolled-back' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/features/test-feature/rollback',
        headers: { authorization: 'Bearer test-token' },
        payload: { reason: 'Testing rollback' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain('Rolled back');
    });
  });

  describe('GET /features/:id/status', () => {
    it('should return status for existing deployment', async () => {
      mockDeploy.findByDeployment.mockResolvedValue([{ id: 'stage-1', status: 'running', name: 'canary-10%', current_traffic_percent: 30 }]);
      mockDeploy.getProgress.mockResolvedValue({
        status: 'running',
        overallPercent: 25,
        totalStages: 4,
        completedStages: 1,
        failedStages: 0,
        currentStage: { id: 'stage-2', name: 'canary-50%', status: 'pending' },
        stages: [{ id: 'stage-1', name: 'canary-10%', status: 'completed' }],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/features/test-feature/status',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent deployment', async () => {
      mockDeploy.findByDeployment.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/features/non-existent/status',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /features/:id', () => {
    it('should delete a feature', async () => {
      mockDeploy.findByDeployment.mockResolvedValue([{ id: 'stage-1' }]);
      mockDeploy.delete.mockResolvedValue({ id: 'test-feature' });

      const response = await app.inject({
        method: 'DELETE',
        url: '/features/test-feature',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});