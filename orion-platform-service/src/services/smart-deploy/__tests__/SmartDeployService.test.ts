/**
 * SmartDeployService Tests
 */

import { SmartDeployService, DeployInput, DeploymentRecord } from '../SmartDeployService';

describe('SmartDeployService', () => {
  let service: SmartDeployService;

  beforeEach(() => {
    // Use null for in-memory mode
    service = new SmartDeployService(null);
  });

  describe('deploy', () => {
    it('should create a deployment with default rolling strategy', async () => {
      const input: DeployInput = {
        appName: 'test-app-deploy',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'test-user',
      };

      const deployment = await service.deploy(input);

      expect(deployment.id).toBeDefined();
      expect(deployment.appName).toBe('test-app-deploy');
      expect(deployment.version).toBe('1.0.0');
      expect(deployment.environment).toBe('production');
      expect(deployment.strategy).toBe('rolling');
      expect(deployment.status).toBe('running');
      expect(deployment.stages).toBeDefined();
      expect(deployment.stages.length).toBeGreaterThan(0);
    });

    it('should create a deployment with canary strategy', async () => {
      const input: DeployInput = {
        appName: 'test-app-canary',
        version: '1.0.0',
        environment: 'staging',
        strategy: 'canary',
        initiatedBy: 'test-user',
      };

      const deployment = await service.deploy(input);

      expect(deployment.strategy).toBe('canary');
      expect(deployment.stages.length).toBe(4); // pre-deploy, canary-10, canary-50, full-rollout
    });

    it('should create a deployment with blue-green strategy', async () => {
      const input: DeployInput = {
        appName: 'test-app-bg',
        version: '1.0.0',
        environment: 'production',
        strategy: 'blue-green',
        initiatedBy: 'test-user',
      };

      const deployment = await service.deploy(input);

      expect(deployment.strategy).toBe('blue-green');
      expect(deployment.stages.length).toBe(4); // pre-deploy, deploy-green, traffic-switch, cleanup
    });

    it('should create a deployment with recreate strategy', async () => {
      const input: DeployInput = {
        appName: 'test-app-recreate',
        version: '1.0.0',
        environment: 'dev',
        strategy: 'recreate',
        initiatedBy: 'test-user',
      };

      const deployment = await service.deploy(input);

      expect(deployment.strategy).toBe('recreate');
      expect(deployment.stages.length).toBe(3); // pre-deploy, teardown, deploy-new
    });
  });

  describe('getStatus', () => {
    it('should return deployment status by ID', async () => {
      const input: DeployInput = {
        appName: 'test-app-status',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'test-user',
      };

      const deployment = await service.deploy(input);
      const status = await service.getStatus(deployment.id);

      expect(status).toBeDefined();
      expect(status?.id).toBe(deployment.id);
      expect(status?.appName).toBe('test-app-status');
    });

    it('should return undefined for non-existent deployment', async () => {
      const status = await service.getStatus('non-existent-id');
      expect(status).toBeUndefined();
    });
  });

  describe('rollback', () => {
    it('should rollback a deployment', async () => {
      const deployment = await service.deploy({
        appName: 'test-app-rollback',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'test-user',
      });

      const result = await service.rollback(
        deployment.id,
        'User requested rollback',
        'test-user',
        '0.9.0'
      );

      expect(result.deployment.status).toBe('rolledback');
      expect(result.rollback.reason).toBe('User requested rollback');
      expect(result.rollback.targetVersion).toBe('0.9.0');
    });

    it('should throw error for non-existent deployment', async () => {
      await expect(
        service.rollback('non-existent', 'reason', 'user')
      ).rejects.toThrow("Deployment 'non-existent' not found");
    });
  });

  describe('cancelDeployment', () => {
    it('should cancel a running deployment', async () => {
      const deployment = await service.deploy({
        appName: 'test-app-cancel',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'test-user',
      });

      const cancelled = await service.cancelDeployment(deployment.id, 'test-user');

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.completedAt).toBeDefined();
    });

    it('should throw error when cancelling non-existent deployment', async () => {
      await expect(
        service.cancelDeployment('non-existent', 'user')
      ).rejects.toThrow("Deployment 'non-existent' not found");
    });
  });

  describe('getMetrics', () => {
    it('should return metrics object with expected structure', async () => {
      await service.deploy({
        appName: 'test-app-metrics',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user1',
      });

      const metrics = await service.getMetrics();

      expect(metrics.totalDeployments).toBeGreaterThanOrEqual(1);
      expect(metrics.successRate).toBeDefined();
      expect(metrics.averageDurationMs).toBeDefined();
      expect(metrics.deploymentsByEnvironment).toBeDefined();
      expect(metrics.deploymentsByStrategy).toBeDefined();
      expect(metrics.deploymentsByStatus).toBeDefined();
    });
  });

  describe('getLatestDeployment', () => {
    it('should return a deployment when one exists', async () => {
      await service.deploy({
        appName: 'unique-app-latest',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      const latest = await service.getLatestDeployment('unique-app-latest', 'production');

      expect(latest).toBeDefined();
      expect(latest?.appName).toBe('unique-app-latest');
    });

    it('should return undefined for non-existent app/environment', async () => {
      const latest = await service.getLatestDeployment('non-existent-app', 'prod');
      expect(latest).toBeUndefined();
    });
  });

  describe('getAuditTrail', () => {
    it('should return audit trail for a deployment', async () => {
      const deployment = await service.deploy({
        appName: 'test-app-audit',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'test-user',
      });

      await service.rollback(deployment.id, 'test rollback', 'test-user');

      const auditTrail = await service.getAuditTrail(deployment.id);

      expect(auditTrail.length).toBeGreaterThan(0);
      expect(auditTrail.some(e => e.action === 'deployment_created')).toBe(true);
      expect(auditTrail.some(e => e.action === 'rollback_triggered')).toBe(true);
    });
  });
});