/**
 * DeploymentWorkflow - Deployment Workflow Orchestration Unit Tests
 *
 * Coverage: startDeployment (success/failure/rollback), executeStage,
 *           verifyDeployment, completeDeployment, config validation
 */

import { DeploymentWorkflow } from '../DeploymentWorkflow';

describe('DeploymentWorkflow', () => {
  let workflow: DeploymentWorkflow;
  let mockHistoryService: any;
  let mockStrategyEngine: any;
  let mockVerifier: any;
  let mockRollbackService: any;
  let mockEventPublisher: any;
  let mockLockService: any;

  const sampleConfig = {
    appName: 'my-app',
    version: '1.0.0',
    environment: 'production',
    strategy: 'rolling' as const,
    initiatedBy: 'user-1',
    image: 'registry/my-app:1.0.0',
  };

  beforeEach(() => {
    mockHistoryService = {
      recordDeployment: jest.fn().mockResolvedValue(undefined),
      updateDeployment: jest.fn().mockResolvedValue(undefined),
      getDeployment: jest.fn(),
    };

    mockStrategyEngine = {
      executeStrategy: jest.fn().mockResolvedValue({
        stages: [{ name: 'deploy', status: 'completed', steps: [] }],
        success: true,
      }),
    };

    mockVerifier = {
      generateVerificationReport: jest.fn().mockResolvedValue({
        overallStatus: 'pass',
        healthChecks: [{ name: 'http', passed: true }],
        metrics: [{ name: 'latency', passed: true }],
      }),
    };

    mockRollbackService = {
      triggerRollback: jest.fn().mockResolvedValue({ id: 'rb-1', reason: 'test' }),
      executeRollback: jest.fn().mockResolvedValue({
        deployment: { status: 'rolled_back' },
      }),
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    mockLockService = {
      checkDeploymentAllowed: jest.fn().mockResolvedValue({ allowed: true }),
    };

    workflow = new DeploymentWorkflow({
      historyService: mockHistoryService,
      strategyEngine: mockStrategyEngine,
      verifier: mockVerifier,
      rollbackService: mockRollbackService,
      eventPublisher: mockEventPublisher,
      lockService: mockLockService,
    });
  });

  // ==================== startDeployment ====================

  describe('startDeployment', () => {
    it('should complete deployment successfully', async () => {
      // Capture deployment from recordDeployment for getDeployment mock
      let capturedDeployment: any;
      mockHistoryService.recordDeployment.mockImplementation(async (dep: any) => {
        capturedDeployment = dep;
      });
      mockHistoryService.getDeployment.mockImplementation(async () => capturedDeployment);

      const result = await workflow.startDeployment(sampleConfig);

      expect(result.status).toBe('completed');
      expect(result.appName).toBe('my-app');
      expect(result.version).toBe('1.0.0');
      expect(result.completedAt).toBeDefined();
      expect(mockHistoryService.recordDeployment).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.stringContaining('completed'),
        expect.anything(),
        expect.anything()
      );
    });

    it('should fail when pre-checks fail (invalid config)', async () => {
      const result = await workflow.startDeployment({
        ...sampleConfig,
        appName: '', // invalid
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should fail when strategy execution fails', async () => {
      mockStrategyEngine.executeStrategy.mockResolvedValue({
        stages: [{ name: 'deploy', status: 'failed', steps: [] }],
        success: false,
      });

      const result = await workflow.startDeployment(sampleConfig);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Deployment strategy execution failed');
    });

    it('should auto-rollback when enabled and deploy fails', async () => {
      mockStrategyEngine.executeStrategy.mockResolvedValue({
        stages: [{ name: 'deploy', status: 'failed', steps: [] }],
        success: false,
      });

      const result = await workflow.startDeployment({
        ...sampleConfig,
        rollbackPolicy: { autoRollback: true },
      });

      expect(mockRollbackService.triggerRollback).toHaveBeenCalled();
      expect(result.status).toBe('rolled_back');
    });

    it('should fail when verification fails', async () => {
      let capturedDeployment: any;
      mockHistoryService.recordDeployment.mockImplementation(async (dep: any) => {
        capturedDeployment = dep;
      });
      mockHistoryService.getDeployment.mockImplementation(async () => capturedDeployment);

      mockVerifier.generateVerificationReport.mockResolvedValue({
        overallStatus: 'fail',
        healthChecks: [{ name: 'http', passed: false }],
        metrics: [],
      });

      const result = await workflow.startDeployment(sampleConfig);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('verification');
    });

    it('should auto-rollback when verification fails and rollbackOnHealthCheckFailure enabled', async () => {
      let capturedDeployment: any;
      mockHistoryService.recordDeployment.mockImplementation(async (dep: any) => {
        capturedDeployment = dep;
      });
      mockHistoryService.getDeployment.mockImplementation(async () => capturedDeployment);

      mockVerifier.generateVerificationReport.mockResolvedValue({
        overallStatus: 'fail',
        healthChecks: [{ name: 'http', passed: false }],
        metrics: [],
      });

      const result = await workflow.startDeployment({
        ...sampleConfig,
        rollbackPolicy: { autoRollback: true, rollbackOnHealthCheckFailure: true },
      });

      expect(mockRollbackService.triggerRollback).toHaveBeenCalled();
    });

    it('should handle lock service blocking deployment', async () => {
      mockLockService.checkDeploymentAllowed.mockResolvedValue({
        allowed: false,
        reason: 'Environment is locked for maintenance',
      });

      const result = await workflow.startDeployment(sampleConfig);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('blocked');
    });

    it('should handle lock service errors gracefully', async () => {
      let capturedDeployment: any;
      mockHistoryService.recordDeployment.mockImplementation(async (dep: any) => {
        capturedDeployment = dep;
      });
      mockHistoryService.getDeployment.mockImplementation(async () => capturedDeployment);

      mockLockService.checkDeploymentAllowed.mockRejectedValue(new Error('Lock service down'));

      const result = await workflow.startDeployment(sampleConfig);

      // Should continue despite lock service error
      expect(result.status).toBe('completed');
    });

    it('should handle rollback failure', async () => {
      mockStrategyEngine.executeStrategy.mockResolvedValue({
        stages: [{ name: 'deploy', status: 'failed', steps: [] }],
        success: false,
      });
      mockRollbackService.triggerRollback.mockRejectedValue(new Error('Rollback failed'));

      const result = await workflow.startDeployment({
        ...sampleConfig,
        rollbackPolicy: { autoRollback: true },
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('rollback also failed');
    });

    it('should handle unexpected errors', async () => {
      mockHistoryService.recordDeployment.mockRejectedValue(new Error('DB down'));

      // recordDeployment is called outside try/catch, so error propagates
      await expect(workflow.startDeployment(sampleConfig)).rejects.toThrow('DB down');
    });

    it('should use default strategy when not specified', async () => {
      const result = await workflow.startDeployment({
        ...sampleConfig,
        strategy: undefined as any,
      });

      expect(result.strategy).toBe('rolling');
    });
  });

  // ==================== executeStage ====================

  describe('executeStage', () => {
    it('should execute stage successfully', async () => {
      mockHistoryService.getDeployment.mockResolvedValue({
        id: 'dep-1',
        stages: [{
          name: 'test-stage',
          status: 'pending',
          steps: [{ name: 'step-1', status: 'pending' }],
        }],
        currentStageIndex: 0,
      });

      const result = await workflow.executeStage('dep-1', 0);

      expect(result.success).toBe(true);
      expect(result.stage!.status).toBe('completed');
    });

    it('should throw when deployment not found', async () => {
      mockHistoryService.getDeployment.mockResolvedValue(null);

      await expect(workflow.executeStage('non-existent', 0)).rejects.toThrow('not found');
    });

    it('should throw when stage index out of range', async () => {
      mockHistoryService.getDeployment.mockResolvedValue({
        id: 'dep-1',
        stages: [{ name: 'stage-1', status: 'pending', steps: [] }],
        currentStageIndex: 0,
      });

      await expect(workflow.executeStage('dep-1', 5)).rejects.toThrow('out of range');
    });

    it('should throw when stage index is negative', async () => {
      mockHistoryService.getDeployment.mockResolvedValue({
        id: 'dep-1',
        stages: [{ name: 'stage-1', status: 'pending', steps: [] }],
        currentStageIndex: 0,
      });

      await expect(workflow.executeStage('dep-1', -1)).rejects.toThrow('out of range');
    });
  });

  // ==================== verifyDeployment ====================

  describe('verifyDeployment', () => {
    it('should verify deployment successfully', async () => {
      mockHistoryService.getDeployment.mockResolvedValue({
        id: 'dep-1',
        stages: [],
      });

      const result = await workflow.verifyDeployment('dep-1');

      expect(result.success).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report!.overallStatus).toBe('pass');
    });

    it('should fail verification when checks fail', async () => {
      mockVerifier.generateVerificationReport.mockResolvedValue({
        overallStatus: 'fail',
        healthChecks: [{ name: 'http', passed: false }],
        metrics: [{ name: 'latency', passed: false }],
      });

      mockHistoryService.getDeployment.mockResolvedValue({
        id: 'dep-1',
        stages: [],
      });

      const result = await workflow.verifyDeployment('dep-1');

      expect(result.success).toBe(false);
    });

    it('should throw when deployment not found', async () => {
      mockHistoryService.getDeployment.mockResolvedValue(null);

      await expect(workflow.verifyDeployment('non-existent')).rejects.toThrow('not found');
    });
  });

  // ==================== completeDeployment ====================

  describe('completeDeployment', () => {
    it('should complete deployment', async () => {
      mockHistoryService.getDeployment.mockResolvedValue({
        id: 'dep-1',
        appName: 'my-app',
        version: '1.0.0',
        environment: 'prod',
        status: 'verifying',
      });

      const result = await workflow.completeDeployment('dep-1');

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
    });

    it('should throw when deployment not found', async () => {
      mockHistoryService.getDeployment.mockResolvedValue(null);

      await expect(workflow.completeDeployment('non-existent')).rejects.toThrow('not found');
    });
  });

  // ==================== Service Getters ====================

  describe('getHistoryService', () => {
    it('should return history service', () => {
      expect(workflow.getHistoryService()).toBe(mockHistoryService);
    });
  });

  describe('getRollbackService', () => {
    it('should return rollback service', () => {
      expect(workflow.getRollbackService()).toBe(mockRollbackService);
    });
  });
});
