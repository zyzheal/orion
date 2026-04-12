/**
 * HealthCheckService 单元测试
 */

import {
  HealthCheckService,
  DependencyServiceStatus,
  RollbackReadiness,
} from '../HealthCheckService';

describe('HealthCheckService', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    service = new HealthCheckService();
  });

  // ==================== runPreDeploymentChecks ====================

  describe('runPreDeploymentChecks', () => {
    it('should pass all checks with good conditions', async () => {
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-1',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
        dependencies: ['service-a', 'service-b'],
      });

      expect(result.totalChecks).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
      expect(result.canProceed).toBe(true);
    });

    it('should fail when pipeline is not successful', async () => {
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-2',
        pipelineStatus: 'failed',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
      });

      expect(result.failed).toBeGreaterThan(0);
      expect(result.canProceed).toBe(false);
    });

    it('should fail when pipeline is still running', async () => {
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-3',
        pipelineStatus: 'running',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
      });

      expect(result.failed).toBeGreaterThan(0);
      expect(result.canProceed).toBe(false);
    });

    it('should warn when test failure rate is high', async () => {
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-4',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 80, failed: 20 },
        codeReviewStatus: 'approved',
      });

      const testCheck = result.checks.find((c) => c.checkName === 'testResults');
      expect(testCheck).toBeDefined();
      expect(testCheck!.status).toBe('fail');
      expect(result.canProceed).toBe(false);
    });

    it('should warn when test failure rate is low but present', async () => {
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-5',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 97, failed: 3 },
        codeReviewStatus: 'approved',
      });

      const testCheck = result.checks.find((c) => c.checkName === 'testResults');
      expect(testCheck).toBeDefined();
      expect(testCheck!.status).toBe('warn');
      // Should still be able to proceed (warning is not failure)
      expect(result.canProceed).toBe(true);
    });

    it('should fail when code review is rejected', async () => {
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-6',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'rejected',
      });

      const reviewCheck = result.checks.find((c) => c.checkName === 'codeReview');
      expect(reviewCheck).toBeDefined();
      expect(reviewCheck!.status).toBe('fail');
      expect(result.canProceed).toBe(false);
    });

    it('should warn when code review is pending', async () => {
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-7',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'pending',
      });

      const reviewCheck = result.checks.find((c) => c.checkName === 'codeReview');
      expect(reviewCheck).toBeDefined();
      expect(reviewCheck!.status).toBe('warn');
    });

    it('should handle missing pipeline status gracefully', async () => {
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-8',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
      });

      const pipelineCheck = result.checks.find((c) => c.checkName === 'pipelineStatus');
      expect(pipelineCheck).toBeDefined();
      expect(pipelineCheck!.status).toBe('warn');
    });

    it('should handle unhealthy dependencies', async () => {
      const mockCheckDeps = async (_services: string[]): Promise<DependencyServiceStatus[]> => [
        { name: 'service-a', healthy: true, lastChecked: new Date() },
        { name: 'service-b', healthy: false, lastChecked: new Date(), details: 'Service unreachable' },
        { name: 'service-c', healthy: true, lastChecked: new Date() },
      ];

      service = new HealthCheckService({
        checkDependencyFn: mockCheckDeps,
      });

      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-9',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
        dependencies: ['service-a', 'service-b', 'service-c'],
      });

      const depCheck = result.checks.find((c) => c.checkName === 'dependencyHealth');
      expect(depCheck).toBeDefined();
      expect(depCheck!.status).toBe('warn');
    });

    it('should fail when many dependencies are unhealthy', async () => {
      const mockCheckDeps = async (_services: string[]): Promise<DependencyServiceStatus[]> => [
        { name: 'service-a', healthy: false, lastChecked: new Date() },
        { name: 'service-b', healthy: false, lastChecked: new Date() },
        { name: 'service-c', healthy: true, lastChecked: new Date() },
      ];

      service = new HealthCheckService({
        checkDependencyFn: mockCheckDeps,
      });

      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-10',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
        dependencies: ['service-a', 'service-b', 'service-c'],
      });

      const depCheck = result.checks.find((c) => c.checkName === 'dependencyHealth');
      expect(depCheck).toBeDefined();
      expect(depCheck!.status).toBe('fail');
      expect(result.canProceed).toBe(false);
    });
  });

  // ==================== runHealthChecks ====================

  describe('runHealthChecks', () => {
    it('should run basic health checks', async () => {
      const result = await service.runHealthChecks({});

      expect(result.totalChecks).toBeGreaterThan(0);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should include system health check', async () => {
      const result = await service.runHealthChecks({});

      const systemCheck = result.checks.find((c) => c.checkName === 'systemHealth');
      expect(systemCheck).toBeDefined();
    });

    it('should handle dependency health check', async () => {
      const mockCheckDeps = async (_services: string[]): Promise<DependencyServiceStatus[]> => [
        { name: 'db', healthy: true, lastChecked: new Date() },
      ];

      service = new HealthCheckService({
        checkDependencyFn: mockCheckDeps,
      });

      const result = await service.runHealthChecks({
        dependencies: ['db'],
      });

      const depCheck = result.checks.find((c) => c.checkName === 'dependencyHealth');
      expect(depCheck).toBeDefined();
    });
  });

  // ==================== checkRollbackReadiness ====================

  describe('checkRollbackReadiness', () => {
    it('should pass when rollback is ready', async () => {
      const mockCheckRollback = async (_id: string): Promise<RollbackReadiness> => ({
        hasRollbackVersion: true,
        rollbackVersion: 'v1.0.0',
        rollbackScriptReady: true,
        databaseMigrationReversible: true,
        estimatedRollbackTime: 60000,
      });

      service = new HealthCheckService({
        checkRollbackFn: mockCheckRollback,
      });

      const result = await service.checkRollbackReadiness('deploy-1');

      expect(result.checkName).toBe('rollbackReadiness');
      expect(result.status).toBe('pass');
    });

    it('should warn when some rollback items are missing', async () => {
      const mockCheckRollback = async (_id: string): Promise<RollbackReadiness> => ({
        hasRollbackVersion: true,
        rollbackVersion: 'v1.0.0',
        rollbackScriptReady: false,
        databaseMigrationReversible: true,
        estimatedRollbackTime: 60000,
      });

      service = new HealthCheckService({
        checkRollbackFn: mockCheckRollback,
      });

      const result = await service.checkRollbackReadiness('deploy-2');

      expect(result.status).toBe('warn');
      expect(result.details).toContain('回滚脚本未就绪');
    });

    it('should fail when multiple rollback items are missing', async () => {
      const mockCheckRollback = async (_id: string): Promise<RollbackReadiness> => ({
        hasRollbackVersion: false,
        rollbackScriptReady: false,
        databaseMigrationReversible: false,
      });

      service = new HealthCheckService({
        checkRollbackFn: mockCheckRollback,
      });

      const result = await service.checkRollbackReadiness('deploy-3');

      expect(result.status).toBe('fail');
    });

    it('should handle errors gracefully', async () => {
      const mockCheckRollback = async (_id: string): Promise<RollbackReadiness> => {
        throw new Error('Connection refused');
      };

      service = new HealthCheckService({
        checkRollbackFn: mockCheckRollback,
      });

      const result = await service.checkRollbackReadiness('deploy-4');

      expect(result.status).toBe('warn');
      expect(result.details).toContain('Connection refused');
    });
  });

  // ==================== Aggregate Results ====================

  describe('aggregate results', () => {
    it('should count passed, failed, warnings, skipped', async () => {
      const mockCheckDeps = async (_services: string[]): Promise<DependencyServiceStatus[]> => [
        { name: 'db', healthy: false, lastChecked: new Date() },
      ];

      service = new HealthCheckService({
        checkDependencyFn: mockCheckDeps,
      });

      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-11',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 98, failed: 2 },
        codeReviewStatus: 'approved',
        dependencies: ['db'],
      });

      expect(result.passed + result.failed + result.warnings + result.skipped).toBe(
        result.totalChecks
      );
    });

    it('should set canProceed to false when there are failures', async () => {
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-12',
        pipelineStatus: 'failed',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
      });

      expect(result.canProceed).toBe(false);
    });

    it('should include execution timestamp', async () => {
      const before = new Date();
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-13',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
      });

      expect(result.executedAt).toBeInstanceOf(Date);
      expect(result.executedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should include check duration', async () => {
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-14',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
      });

      result.checks.forEach((check) => {
        expect(check.duration).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ==================== Each check function ====================

  describe('individual check functions', () => {
    it('should generate unique IDs for each check', async () => {
      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-15',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
      });

      const ids = result.checks.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include targetId in check results when provided', async () => {
      const result = await service.checkRollbackReadiness('deploy-specific');

      expect(result.targetId).toBe('deploy-specific');
    });
  });

  // ==================== Configured checks ====================

  describe('configured checks', () => {
    it('should skip pipeline check when disabled', async () => {
      service = new HealthCheckService({
        config: {
          checkPipelineStatus: false,
        },
      });

      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-16',
        pipelineStatus: 'failed',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
      });

      const pipelineCheck = result.checks.find((c) => c.checkName === 'pipelineStatus');
      expect(pipelineCheck).toBeUndefined();
    });

    it('should skip test check when disabled', async () => {
      service = new HealthCheckService({
        config: {
          checkTestResults: false,
        },
      });

      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-17',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 50, failed: 50 },
        codeReviewStatus: 'approved',
      });

      const testCheck = result.checks.find((c) => c.checkName === 'testResults');
      expect(testCheck).toBeUndefined();
    });

    it('should skip rollback check when disabled', async () => {
      service = new HealthCheckService({
        config: {
          checkRollbackReadiness: false,
        },
      });

      const result = await service.runPreDeploymentChecks({
        targetId: 'deploy-18',
        pipelineStatus: 'success',
        testResults: { total: 100, passed: 100, failed: 0 },
        codeReviewStatus: 'approved',
      });

      const rollbackCheck = result.checks.find((c) => c.checkName === 'rollbackReadiness');
      expect(rollbackCheck).toBeUndefined();
    });
  });
});
