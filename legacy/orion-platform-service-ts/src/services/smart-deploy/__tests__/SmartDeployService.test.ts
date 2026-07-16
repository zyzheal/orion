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

    it('should return empty array for non-existent deployment', async () => {
      const auditTrail = await service.getAuditTrail('non-existent-id');
      expect(auditTrail).toEqual([]);
    });
  });

  describe('getHistory', () => {
    it('should return all deployments without filters', async () => {
      await service.deploy({
        appName: 'app-1',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user1',
      });
      await service.deploy({
        appName: 'app-2',
        version: '2.0.0',
        environment: 'staging',
        initiatedBy: 'user2',
      });

      const result = await service.getHistory();

      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should filter by appName', async () => {
      await service.deploy({
        appName: 'filter-app-1',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });
      await service.deploy({
        appName: 'filter-app-2',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      const result = await service.getHistory({ appName: 'filter-app-1' });

      expect(result.data.every(d => d.appName === 'filter-app-1')).toBe(true);
    });

    it('should filter by version', async () => {
      await service.deploy({
        appName: 'version-app',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });
      await service.deploy({
        appName: 'version-app',
        version: '2.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      const result = await service.getHistory({ version: '1.0.0' });

      expect(result.data.every(d => d.version === '1.0.0')).toBe(true);
    });

    it('should filter by environment', async () => {
      await service.deploy({
        appName: 'env-app',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });
      await service.deploy({
        appName: 'env-app',
        version: '1.0.0',
        environment: 'staging',
        initiatedBy: 'user',
      });

      const result = await service.getHistory({ environment: 'staging' });

      expect(result.data.every(d => d.environment === 'staging')).toBe(true);
    });

    it('should filter by strategy', async () => {
      await service.deploy({
        appName: 'strat-app',
        version: '1.0.0',
        environment: 'production',
        strategy: 'canary',
        initiatedBy: 'user',
      });
      await service.deploy({
        appName: 'strat-app',
        version: '1.0.0',
        environment: 'staging',
        strategy: 'rolling',
        initiatedBy: 'user',
      });

      const result = await service.getHistory({ strategy: 'canary' });

      expect(result.data.every(d => d.strategy === 'canary')).toBe(true);
    });

    it('should filter by initiatedBy', async () => {
      await service.deploy({
        appName: 'user-app',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'alice',
      });
      await service.deploy({
        appName: 'user-app',
        version: '1.0.0',
        environment: 'staging',
        initiatedBy: 'bob',
      });

      const result = await service.getHistory({ initiatedBy: 'alice' });

      expect(result.data.every(d => d.initiatedBy === 'alice')).toBe(true);
    });

    it('should filter by startDate', async () => {
      const deployment = await service.deploy({
        appName: 'date-app',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      const futureDate = new Date(Date.now() + 100000);
      const result = await service.getHistory({ startDate: futureDate });

      expect(result.data.length).toBe(0);
    });

    it('should filter by endDate', async () => {
      await service.deploy({
        appName: 'enddate-app',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      const pastDate = new Date(Date.now() - 100000);
      const result = await service.getHistory({ endDate: pastDate });

      expect(result.data.length).toBe(0);
    });

    it('should respect limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await service.deploy({
          appName: `page-app-${i}`,
          version: '1.0.0',
          environment: 'production',
          initiatedBy: 'user',
        });
      }

      const result = await service.getHistory({ limit: 2, offset: 1 });

      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(1);
    });

    it('should sort by startedAt descending', async () => {
      const result = await service.getHistory();

      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i - 1].startedAt.getTime()).toBeGreaterThanOrEqual(
          result.data[i].startedAt.getTime()
        );
      }
    });
  });

  describe('getMetrics', () => {
    it('should return metrics with proper structure', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toHaveProperty('totalDeployments');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('averageDurationMs');
      expect(metrics).toHaveProperty('deploymentsByEnvironment');
      expect(metrics).toHaveProperty('deploymentsByStrategy');
      expect(metrics).toHaveProperty('deploymentsByStatus');
      expect(metrics).toHaveProperty('recentFailures');
    });

    it('should filter metrics by appName', async () => {
      await service.deploy({
        appName: 'metrics-app-1',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });
      await service.deploy({
        appName: 'metrics-app-2',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      const metrics = await service.getMetrics({ appName: 'metrics-app-1' });

      expect(metrics.totalDeployments).toBeGreaterThanOrEqual(1);
    });

    it('should filter metrics by environment', async () => {
      await service.deploy({
        appName: 'metrics-env-app',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });
      await service.deploy({
        appName: 'metrics-env-app',
        version: '1.0.0',
        environment: 'staging',
        initiatedBy: 'user',
      });

      const metrics = await service.getMetrics({ environment: 'staging' });

      expect(metrics.totalDeployments).toBeGreaterThanOrEqual(1);
    });

    it('should filter metrics by startDate', async () => {
      await service.deploy({
        appName: 'metrics-date-app',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      const futureDate = new Date(Date.now() + 100000);
      const metrics = await service.getMetrics({ startDate: futureDate });

      expect(metrics.totalDeployments).toBe(0);
    });

    it('should filter metrics by endDate', async () => {
      await service.deploy({
        appName: 'metrics-enddate-app',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      const pastDate = new Date(Date.now() - 100000);
      const metrics = await service.getMetrics({ endDate: pastDate });

      expect(metrics.totalDeployments).toBe(0);
    });

    it('should include deploymentsByEnvironment', async () => {
      await service.deploy({
        appName: 'env-metrics-app',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      const metrics = await service.getMetrics();

      expect(metrics.deploymentsByEnvironment).toBeDefined();
      expect(metrics.deploymentsByEnvironment['production']).toBeGreaterThanOrEqual(1);
    });

    it('should include deploymentsByStrategy', async () => {
      await service.deploy({
        appName: 'strat-metrics-app',
        version: '1.0.0',
        environment: 'production',
        strategy: 'canary',
        initiatedBy: 'user',
      });

      const metrics = await service.getMetrics();

      expect(metrics.deploymentsByStrategy).toBeDefined();
      expect(metrics.deploymentsByStrategy['canary']).toBeGreaterThanOrEqual(1);
    });

    it('should include deploymentsByStatus', async () => {
      await service.deploy({
        appName: 'status-metrics-app',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      const metrics = await service.getMetrics();

      expect(metrics.deploymentsByStatus).toBeDefined();
    });
  });

  describe('cancelDeployment edge cases', () => {
    it('should throw when cancelling non-running deployment', async () => {
      const deployment = await service.deploy({
        appName: 'cancel-non-running',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      // Wait for deployment to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      await expect(
        service.cancelDeployment(deployment.id, 'user')
      ).rejects.toThrow();
    });

    it('should skip remaining stages when cancelling', async () => {
      const deployment = await service.deploy({
        appName: 'cancel-skip-stages',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      const cancelled = await service.cancelDeployment(deployment.id, 'user');

      // All stages after current should be skipped
      const skippedStages = cancelled.stages.filter(s => s.status === 'skipped');
      expect(skippedStages.length).toBeGreaterThan(0);
    });
  });

  describe('rollback edge cases', () => {
    it('should store rollback history', async () => {
      const deployment = await service.deploy({
        appName: 'rollback-history',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      await service.rollback(deployment.id, 'reason', 'user', '0.9.0');

      const history = await service.getRollbackHistory(deployment.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].reason).toBe('reason');
    });

    it('should return empty rollback history for non-existent deployment', async () => {
      const history = await service.getRollbackHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('deploy with optional fields', () => {
    it('should store notes and changeRequestId', async () => {
      const deployment = await service.deploy({
        appName: 'optional-fields',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
        notes: 'Fix critical bug',
        changeRequestId: 'CHG-123',
      });

      expect(deployment.notes).toBe('Fix critical bug');
      expect(deployment.changeRequestId).toBe('CHG-123');
    });

    it('should store commitSha and commitCommittedAt', async () => {
      const commitDate = new Date();
      const deployment = await service.deploy({
        appName: 'commit-fields',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
        commitSha: 'abc123def',
        commitCommittedAt: commitDate,
      });

      expect(deployment.commitSha).toBe('abc123def');
      expect(deployment.commitCommittedAt).toBe(commitDate);
    });

    it('should store healthCheck and rollbackPolicy', async () => {
      const deployment = await service.deploy({
        appName: 'policy-fields',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
        healthCheck: { endpoint: '/health', interval: 30 },
        rollbackPolicy: { autoRollback: true, threshold: 0.1 },
      });

      expect(deployment.healthCheck).toEqual({ endpoint: '/health', interval: 30 });
      expect(deployment.rollbackPolicy).toEqual({ autoRollback: true, threshold: 0.1 });
    });

    it('should store image and replicas', async () => {
      const deployment = await service.deploy({
        appName: 'image-fields',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
        image: 'nginx:1.21',
        replicas: 3,
      });

      expect(deployment.image).toBe('nginx:1.21');
      expect(deployment.replicas).toBe(3);
    });

    it('should store strategyConfig', async () => {
      const deployment = await service.deploy({
        appName: 'strategy-config',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
        strategyConfig: { batchSize: 2, maxUnavailable: 1 },
      });

      expect(deployment.strategyConfig).toEqual({ batchSize: 2, maxUnavailable: 1 });
    });
  });

  describe('simulateDeploymentProgress', () => {
    it('should complete all stages over time', async () => {
      const deployment = await service.deploy({
        appName: 'sim-complete',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      // Wait for simulation to complete
      await new Promise(resolve => setTimeout(resolve, 3000));

      const status = await service.getStatus(deployment.id);
      expect(status?.status).toBe('completed');
      expect(status?.completedAt).toBeDefined();
    });

    it('should mark all steps as completed', async () => {
      const deployment = await service.deploy({
        appName: 'sim-steps',
        version: '1.0.0',
        environment: 'production',
        initiatedBy: 'user',
      });

      // Wait for simulation to complete
      await new Promise(resolve => setTimeout(resolve, 3000));

      const status = await service.getStatus(deployment.id);
      if (status) {
        for (const stage of status.stages) {
          expect(stage.status).toBe('completed');
          for (const step of stage.steps) {
            expect(step.status).toBe('completed');
          }
        }
      }
    });
  });

  describe('constructor with database', () => {
    it('should create service with null db (in-memory mode)', () => {
      const svc = new SmartDeployService(null);
      expect(svc).toBeDefined();
    });
  });
});