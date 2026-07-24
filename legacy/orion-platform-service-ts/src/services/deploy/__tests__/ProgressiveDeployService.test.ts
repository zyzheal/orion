/**
 * Tests for ProgressiveDeployService
 */

import {
  ProgressiveDeployService,
  ProgressiveDeployServiceError,
} from '../ProgressiveDeployService';
import { ProgressiveDeployRepository, ProgressiveStage } from '../ProgressiveDeployRepository';
import { DeployRepository, Deployment } from '../DeployRepository';

// Mock repositories
const mockProgressiveRepo = {
  findById: jest.fn(),
  findByDeployment: jest.fn(),
  findCurrentStage: jest.fn(),
  findNextPendingStage: jest.fn(),
  findPreviousCompletedStage: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  countByDeployment: jest.fn(),
};

const mockDeployRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const TENANT_ID = 'tenant-001';
const DEPLOY_ID = 'deploy-001';

function makeStage(overrides: Partial<ProgressiveStage> = {}): ProgressiveStage {
  return {
    id: 'stage-001',
    tenant_id: TENANT_ID,
    deployment_id: DEPLOY_ID,
    stage_name: 'canary',
    stage_order: 0,
    traffic_percent: 5,
    instance_count: 1,
    status: 'pending',
    started_at: null,
    completed_at: null,
    validation_result: {},
    auto_promote: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeDeployment(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: DEPLOY_ID,
    tenant_id: TENANT_ID,
    project_id: 'proj-001',
    pipeline_run_id: null,
    build_id: null,
    environment: 'staging',
    status: 'pending',
    strategy: 'progressive',
    config: {},
    deployed_by: 'admin',
    started_at: null,
    completed_at: null,
    duration_ms: null,
    error_message: null,
    rollback_to: null,
    commit_sha: 'abc123',
    commit_committed_at: null,
    created_at: new Date(),
    ...overrides,
  };
}

describe('ProgressiveDeployService', () => {
  let service: ProgressiveDeployService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProgressiveDeployService(
      mockProgressiveRepo as unknown as ProgressiveDeployRepository,
      mockDeployRepo as unknown as DeployRepository
    );
  });

  // ==================== createProgressiveDeploy ====================

  describe('createProgressiveDeploy', () => {
    it('should create a progressive deploy with multiple stages', async () => {
      mockDeployRepo.findById.mockResolvedValue(makeDeployment());
      const createdStages = [
        makeStage({ id: 'stage-001', stage_name: 'canary', stage_order: 0, traffic_percent: 5, status: 'pending' }),
        makeStage({ id: 'stage-002', stage_name: '25%', stage_order: 1, traffic_percent: 25, status: 'pending' }),
        makeStage({ id: 'stage-003', stage_name: '50%', stage_order: 2, traffic_percent: 50, status: 'pending' }),
      ];
      mockProgressiveRepo.createMany.mockResolvedValue(createdStages);
      mockProgressiveRepo.update.mockResolvedValue(makeStage({ status: 'running' }));

      const result = await service.createProgressiveDeploy({
        tenant_id: TENANT_ID,
        deployment_id: DEPLOY_ID,
        stages: [
          { stage_name: 'canary', stage_order: 0, traffic_percent: 5 },
          { stage_name: '25%', stage_order: 1, traffic_percent: 25 },
          { stage_name: '50%', stage_order: 2, traffic_percent: 50 },
        ],
      });

      expect(result.deploymentId).toBe(DEPLOY_ID);
      expect(result.stages).toHaveLength(3);
    });

    it('should throw error when no stages provided', async () => {
      await expect(service.createProgressiveDeploy({
        tenant_id: TENANT_ID,
        deployment_id: DEPLOY_ID,
        stages: [],
      })).rejects.toThrow(ProgressiveDeployServiceError);
      await expect(service.createProgressiveDeploy({
        tenant_id: TENANT_ID,
        deployment_id: DEPLOY_ID,
        stages: [],
      })).rejects.toThrow('At least one stage is required');
    });

    it('should throw error when deployment not found', async () => {
      mockDeployRepo.findById.mockResolvedValue(null);

      await expect(service.createProgressiveDeploy({
        tenant_id: TENANT_ID,
        deployment_id: 'non-existent',
        stages: [{ stage_name: 'canary', stage_order: 0, traffic_percent: 5 }],
      })).rejects.toThrow('Deployment not found: non-existent');
    });

    it('should throw error when tenant mismatch', async () => {
      mockDeployRepo.findById.mockResolvedValue(makeDeployment({ tenant_id: 'other-tenant' }));

      await expect(service.createProgressiveDeploy({
        tenant_id: TENANT_ID,
        deployment_id: DEPLOY_ID,
        stages: [{ stage_name: 'canary', stage_order: 0, traffic_percent: 5 }],
      })).rejects.toThrow('Deployment does not belong to this tenant');
    });

    it('should throw error when traffic is not increasing', async () => {
      mockDeployRepo.findById.mockResolvedValue(makeDeployment());

      await expect(service.createProgressiveDeploy({
        tenant_id: TENANT_ID,
        deployment_id: DEPLOY_ID,
        stages: [
          { stage_name: 'stage-a', stage_order: 0, traffic_percent: 50 },
          { stage_name: 'stage-b', stage_order: 1, traffic_percent: 25 },
        ],
      })).rejects.toThrow(ProgressiveDeployServiceError);
    });

    it('should auto-correct stage order', async () => {
      mockDeployRepo.findById.mockResolvedValue(makeDeployment());
      mockProgressiveRepo.createMany.mockResolvedValue([
        makeStage({ stage_order: 0 }),
        makeStage({ stage_order: 1 }),
      ]);

      await service.createProgressiveDeploy({
        tenant_id: TENANT_ID,
        deployment_id: DEPLOY_ID,
        stages: [
          { stage_name: 'second', stage_order: 5, traffic_percent: 50 },
          { stage_name: 'first', stage_order: 3, traffic_percent: 25 },
        ],
      });

      expect(mockProgressiveRepo.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ stage_order: 0, traffic_percent: 25 }),
          expect.objectContaining({ stage_order: 1, traffic_percent: 50 }),
        ])
      );
    });

    it('should auto-start the first stage', async () => {
      mockDeployRepo.findById.mockResolvedValue(makeDeployment());
      mockProgressiveRepo.createMany.mockResolvedValue([
        makeStage({ id: 'first-stage', status: 'pending' }),
      ]);

      await service.createProgressiveDeploy({
        tenant_id: TENANT_ID,
        deployment_id: DEPLOY_ID,
        stages: [{ stage_name: 'canary', stage_order: 0, traffic_percent: 5 }],
      });

      expect(mockProgressiveRepo.update).toHaveBeenCalledWith('first-stage', expect.objectContaining({
        status: 'running',
      }));
    });
  });

  // ==================== advanceStage ====================

  describe('advanceStage', () => {
    it('should advance to the next stage', async () => {
      const currentStage = makeStage({ status: 'running' });
      const nextStage = makeStage({ id: 'stage-002', stage_name: '25%', traffic_percent: 25, status: 'pending' });

      mockProgressiveRepo.findById.mockResolvedValueOnce(currentStage);
      mockProgressiveRepo.update.mockResolvedValue(makeStage({ status: 'completed' }));
      mockProgressiveRepo.findNextPendingStage.mockResolvedValue(nextStage);
      mockProgressiveRepo.findById.mockResolvedValueOnce({ ...currentStage, status: 'completed' });
      mockProgressiveRepo.findById.mockResolvedValueOnce({ ...nextStage, status: 'running' });

      const result = await service.advanceStage(TENANT_ID, DEPLOY_ID, 'stage-001');

      expect(result.previousStage.status).toBe('completed');
      expect(result.nextStage).not.toBeNull();
      expect(result.message).toContain('Advanced from');
    });

    it('should throw error when stage not found', async () => {
      mockProgressiveRepo.findById.mockResolvedValue(null);

      await expect(service.advanceStage(TENANT_ID, DEPLOY_ID, 'non-existent'))
        .rejects.toThrow('Stage not found: non-existent');
    });

    it('should throw error for stage mismatch', async () => {
      mockProgressiveRepo.findById.mockResolvedValue(makeStage({ deployment_id: 'other-deploy' }));

      await expect(service.advanceStage(TENANT_ID, DEPLOY_ID, 'stage-001'))
        .rejects.toThrow('Stage does not belong to this deployment');
    });

    it('should throw error for tenant mismatch', async () => {
      mockProgressiveRepo.findById.mockResolvedValue(makeStage({ tenant_id: 'other-tenant' }));

      await expect(service.advanceStage(TENANT_ID, DEPLOY_ID, 'stage-001'))
        .rejects.toThrow('Stage does not belong to this tenant');
    });

    it('should throw error when stage is not running', async () => {
      mockProgressiveRepo.findById.mockResolvedValue(makeStage({ status: 'pending' }));

      await expect(service.advanceStage(TENANT_ID, DEPLOY_ID, 'stage-001'))
        .rejects.toThrow('Stage is not running');
    });

    it('should return null next stage when all stages completed', async () => {
      const currentStage = makeStage({ status: 'running' });

      mockProgressiveRepo.findById.mockResolvedValueOnce(currentStage);
      mockProgressiveRepo.update.mockResolvedValue(makeStage({ status: 'completed' }));
      mockProgressiveRepo.findNextPendingStage.mockResolvedValue(null);
      mockProgressiveRepo.findById.mockResolvedValueOnce({ ...currentStage, status: 'completed' });

      const result = await service.advanceStage(TENANT_ID, DEPLOY_ID, 'stage-001');

      expect(result.nextStage).toBeNull();
      expect(result.message).toContain('No more stages remaining');
    });

    it('should pass validation result to completed stage', async () => {
      const currentStage = makeStage({ status: 'running' });
      mockProgressiveRepo.findById.mockResolvedValueOnce(currentStage);
      mockProgressiveRepo.update.mockResolvedValue(makeStage({ status: 'completed' }));
      mockProgressiveRepo.findNextPendingStage.mockResolvedValue(null);
      mockProgressiveRepo.findById.mockResolvedValueOnce({ ...currentStage, status: 'completed' });

      await service.advanceStage(TENANT_ID, DEPLOY_ID, 'stage-001', { metrics: { latency: 45 } });

      expect(mockProgressiveRepo.update).toHaveBeenCalledWith(
        'stage-001',
        expect.objectContaining({
          validation_result: { metrics: { latency: 45 } },
        })
      );
    });
  });

  // ==================== rollback ====================

  describe('rollback', () => {
    it('should rollback to previous completed stage', async () => {
      const currentStage = makeStage({ stage_order: 2, status: 'running' });
      const previousStage = makeStage({ id: 'stage-001', stage_name: 'canary', stage_order: 0, status: 'completed' });

      mockProgressiveRepo.findById.mockResolvedValueOnce(currentStage);
      mockProgressiveRepo.update.mockResolvedValue(makeStage({ status: 'failed' }));
      mockProgressiveRepo.findPreviousCompletedStage.mockResolvedValue(previousStage);
      mockProgressiveRepo.findByDeployment.mockResolvedValue([
        makeStage({ stage_order: 0 }),
        makeStage({ stage_order: 1, status: 'pending' }),
        makeStage({ stage_order: 2, status: 'running' }),
      ]);
      mockProgressiveRepo.findById.mockResolvedValueOnce({ ...currentStage, status: 'failed' });
      mockProgressiveRepo.findById.mockResolvedValueOnce({ ...previousStage, status: 'running' });

      const result = await service.rollback(TENANT_ID, DEPLOY_ID, 'stage-003', 'High error rate');

      expect(result.rolledBackStage.status).toBe('failed');
      expect(result.targetStage).not.toBeNull();
      expect(result.message).toContain('Rolled back from');
      expect(result.message).toContain('High error rate');
    });

    it('should skip stages after rollback target', async () => {
      const currentStage = makeStage({ stage_order: 2, status: 'running' });
      const previousStage = makeStage({ id: 'stage-001', stage_name: 'canary', stage_order: 0, status: 'completed' });

      mockProgressiveRepo.findById.mockResolvedValueOnce(currentStage);
      mockProgressiveRepo.update.mockResolvedValue(makeStage({ status: 'failed' }));
      mockProgressiveRepo.findPreviousCompletedStage.mockResolvedValue(previousStage);
      mockProgressiveRepo.findByDeployment.mockResolvedValue([
        makeStage({ stage_order: 0 }),
        makeStage({ stage_order: 1, status: 'pending' }),
        makeStage({ stage_order: 2, status: 'running' }),
      ]);
      mockProgressiveRepo.findById.mockResolvedValueOnce({ ...currentStage, status: 'failed' });
      mockProgressiveRepo.findById.mockResolvedValueOnce({ ...previousStage, status: 'running' });

      await service.rollback(TENANT_ID, DEPLOY_ID, 'stage-003', 'Errors');

      // Should update stages with order > previous stage order
      const updateCalls = mockProgressiveRepo.update.mock.calls;
      const skippedCalls = updateCalls.filter((call: any) => call[1]?.status === 'skipped');
      expect(skippedCalls.length).toBeGreaterThan(0);
    });

    it('should return null target when no previous stage exists', async () => {
      const currentStage = makeStage({ stage_order: 0, status: 'running' });

      mockProgressiveRepo.findById.mockResolvedValueOnce(currentStage);
      mockProgressiveRepo.update.mockResolvedValue(makeStage({ status: 'failed' }));
      mockProgressiveRepo.findPreviousCompletedStage.mockResolvedValue(null);
      mockProgressiveRepo.findByDeployment.mockResolvedValue([
        makeStage({ stage_order: 0, status: 'running' }),
        makeStage({ stage_order: 1, status: 'pending' }),
      ]);
      mockProgressiveRepo.findById.mockResolvedValueOnce({ ...currentStage, status: 'failed' });

      const result = await service.rollback(TENANT_ID, DEPLOY_ID, 'stage-001', 'Critical failure');

      expect(result.targetStage).toBeNull();
      expect(result.message).toContain('No previous stage to rollback to');
    });

    it('should skip pending stages when rolling back to nothing', async () => {
      const currentStage = makeStage({ stage_order: 0, status: 'running' });

      mockProgressiveRepo.findById.mockResolvedValueOnce(currentStage);
      mockProgressiveRepo.update.mockResolvedValue(makeStage({ status: 'failed' }));
      mockProgressiveRepo.findPreviousCompletedStage.mockResolvedValue(null);
      mockProgressiveRepo.findByDeployment.mockResolvedValue([
        makeStage({ stage_order: 0, status: 'running' }),
        makeStage({ stage_order: 1, status: 'pending' }),
      ]);
      mockProgressiveRepo.findById.mockResolvedValueOnce({ ...currentStage, status: 'failed' });

      await service.rollback(TENANT_ID, DEPLOY_ID, 'stage-001', 'Failure');

      const updateCalls = mockProgressiveRepo.update.mock.calls;
      const skippedCalls = updateCalls.filter((call: any) => call[1]?.status === 'skipped');
      expect(skippedCalls.length).toBeGreaterThan(0);
    });

    it('should throw error for stage not found', async () => {
      mockProgressiveRepo.findById.mockResolvedValue(null);

      await expect(service.rollback(TENANT_ID, DEPLOY_ID, 'non-existent', 'reason'))
        .rejects.toThrow('Stage not found: non-existent');
    });
  });

  // ==================== getProgress ====================

  describe('getProgress', () => {
    it('should return deployment progress', async () => {
      const stages = [
        makeStage({ stage_order: 0, status: 'completed', traffic_percent: 5 }),
        makeStage({ stage_order: 1, status: 'running', traffic_percent: 25 }),
        makeStage({ stage_order: 2, status: 'pending', traffic_percent: 50 }),
      ];
      mockProgressiveRepo.findByDeployment.mockResolvedValue(stages);
      mockProgressiveRepo.countByDeployment.mockResolvedValue({
        total: 3, pending: 1, running: 1, completed: 1, failed: 0, skipped: 0,
      });
      mockProgressiveRepo.findCurrentStage.mockResolvedValue(stages[1]);

      const result = await service.getProgress(TENANT_ID, DEPLOY_ID);

      expect(result.deploymentId).toBe(DEPLOY_ID);
      expect(result.totalStages).toBe(3);
      expect(result.completedStages).toBe(1);
      expect(result.failedStages).toBe(0);
      expect(result.status).toBe('in_progress');
      expect(result.overallPercent).toBe(25);
    });

    it('should return completed status when all stages done', async () => {
      const stages = [
        makeStage({ stage_order: 0, status: 'completed', traffic_percent: 25 }),
        makeStage({ stage_order: 1, status: 'completed', traffic_percent: 50 }),
        makeStage({ stage_order: 2, status: 'completed', traffic_percent: 100 }),
      ];
      mockProgressiveRepo.findByDeployment.mockResolvedValue(stages);
      mockProgressiveRepo.countByDeployment.mockResolvedValue({
        total: 3, pending: 0, running: 0, completed: 3, failed: 0, skipped: 0,
      });
      mockProgressiveRepo.findCurrentStage.mockResolvedValue(null);

      const result = await service.getProgress(TENANT_ID, DEPLOY_ID);

      expect(result.status).toBe('completed');
      expect(result.overallPercent).toBe(100);
    });

    it('should return failed status when any stage failed', async () => {
      const stages = [
        makeStage({ stage_order: 0, status: 'completed' }),
        makeStage({ stage_order: 1, status: 'failed' }),
      ];
      mockProgressiveRepo.findByDeployment.mockResolvedValue(stages);
      mockProgressiveRepo.countByDeployment.mockResolvedValue({
        total: 2, pending: 0, running: 0, completed: 1, failed: 1, skipped: 0,
      });
      mockProgressiveRepo.findCurrentStage.mockResolvedValue(null);

      const result = await service.getProgress(TENANT_ID, DEPLOY_ID);

      expect(result.status).toBe('failed');
    });

    it('should throw error when no stages found', async () => {
      mockProgressiveRepo.findByDeployment.mockResolvedValue([]);

      await expect(service.getProgress(TENANT_ID, DEPLOY_ID))
        .rejects.toThrow('No progressive stages found');
    });
  });

  // ==================== Without DeployRepository ====================

  describe('without DeployRepository', () => {
    it('should skip deployment verification when deployRepo is not provided', async () => {
      const noDeployService = new ProgressiveDeployService(
        mockProgressiveRepo as unknown as ProgressiveDeployRepository
      );

      mockProgressiveRepo.createMany.mockResolvedValue([
        makeStage({ status: 'pending' }),
      ]);

      const result = await noDeployService.createProgressiveDeploy({
        tenant_id: TENANT_ID,
        deployment_id: DEPLOY_ID,
        stages: [{ stage_name: 'canary', stage_order: 0, traffic_percent: 5 }],
      });

      expect(result.deploymentId).toBe(DEPLOY_ID);
      expect(mockDeployRepo.findById).not.toHaveBeenCalled();
    });
  });
});
