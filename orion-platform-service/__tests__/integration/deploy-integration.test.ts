/**
 * Deploy Integration Tests
 *
 * Deploy window validation + actual deployment flow
 */

import { DeployService, DeployServiceError } from '@/services/deploy/DeployService';
import { DeployRepository, Deployment, CreateDeploymentInput } from '@/services/deploy/DeployRepository';
import { DeployWindowService, DeployWindowServiceError } from '@/services/deploy/DeployWindowService';
import { DeployWindowRepository, DeployWindow, CreateDeployWindowInput } from '@/services/deploy/DeployWindowRepository';

// ============================================================
// Mock Repositories
// ============================================================

class MockDeployRepository {
  private deployments: Map<string, Deployment> = new Map();
  private events: Map<string, any[]> = new Map();

  private _createCounter = 0;

  async create(input: CreateDeploymentInput): Promise<Deployment> {
    const id = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this._createCounter++;
    const createdAt = new Date(Date.now() + this._createCounter);
    const deployment: Deployment = {
      id,
      tenant_id: input.tenant_id,
      project_id: input.project_id || null,
      pipeline_run_id: input.pipeline_run_id || null,
      build_id: input.build_id || null,
      environment: input.environment,
      strategy: input.strategy || 'rolling',
      config: input.config || {},
      status: 'pending',
      deployed_by: input.deployed_by || null,
      rollback_to: null,
      created_at: createdAt,
      updated_at: createdAt,
    };
    this.deployments.set(id, deployment);
    return deployment;
  }

  async findById(id: string): Promise<Deployment | null> {
    return this.deployments.get(id) || null;
  }

  async findAll(options?: any): Promise<Deployment[]> {
    let results = Array.from(this.deployments.values());
    if (options?.tenantId) results = results.filter(d => d.tenant_id === options.tenantId);
    if (options?.environment) results = results.filter(d => d.environment === options.environment);
    if (options?.environmentId) results = results.filter(d => d.environment === options.environmentId);
    if (options?.status) results = results.filter(d => d.status === options.status);
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  async count(options?: any): Promise<number> {
    // Count should not apply pagination - real repo runs separate COUNT(*) query
    const { offset, limit, ...filterOptions } = options || {};
    let results = Array.from(this.deployments.values());
    if (filterOptions?.tenantId) results = results.filter(d => d.tenant_id === filterOptions.tenantId);
    if (filterOptions?.environment) results = results.filter(d => d.environment === filterOptions.environment);
    if (filterOptions?.environmentId) results = results.filter(d => d.environment === filterOptions.environmentId);
    if (filterOptions?.status) results = results.filter(d => d.status === filterOptions.status);
    return results.length;
  }

  async startDeployment(id: string): Promise<Deployment | null> {
    const deployment = this.deployments.get(id);
    if (!deployment) return null;
    deployment.status = 'deploying';
    deployment.started_at = new Date();
    return deployment;
  }

  async completeDeployment(id: string, status: string, errorMessage?: string): Promise<Deployment | null> {
    const deployment = this.deployments.get(id);
    if (!deployment) return null;
    deployment.status = status as Deployment['status'];
    deployment.completed_at = new Date();
    if (errorMessage) deployment.error_message = errorMessage;
    return deployment;
  }

  async update(id: string, input: any): Promise<Deployment | null> {
    const deployment = this.deployments.get(id);
    if (!deployment) return null;
    const updated = { ...deployment, ...input, updated_at: new Date() };
    this.deployments.set(id, updated);
    return updated;
  }

  async findEvents(deploymentId: string): Promise<any[]> {
    return this.events.get(deploymentId) || [];
  }

  async createEvent(input: any): Promise<void> {
    const events = this.events.get(input.deployment_id) || [];
    events.push({
      id: `event-${Date.now()}`,
      deployment_id: input.deployment_id,
      event_type: input.event_type,
      message: input.message,
      actor_id: input.actor_id,
      created_at: new Date(),
    });
    this.events.set(input.deployment_id, events);
  }

  async findLatestByEnvironment(tenantId: string, environment: string): Promise<Deployment | null> {
    const deployments = Array.from(this.deployments.values())
      .filter(d => d.tenant_id === tenantId && d.environment === environment)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return deployments[0] || null;
  }

  async findByBuild(buildId: string): Promise<Deployment[]> {
    return Array.from(this.deployments.values()).filter(d => d.build_id === buildId);
  }

  async getEnvironments(tenantId: string): Promise<string[]> {
    const envs = new Set<string>();
    for (const d of this.deployments.values()) {
      if (d.tenant_id === tenantId) envs.add(d.environment);
    }
    return Array.from(envs);
  }

  async getDeployStats(tenantId?: string): Promise<any> {
    let deployments = Array.from(this.deployments.values());
    if (tenantId) deployments = deployments.filter(d => d.tenant_id === tenantId);
    return {
      total: deployments.length,
      success: deployments.filter(d => d.status === 'success').length,
      failed: deployments.filter(d => d.status === 'failed').length,
      deploying: deployments.filter(d => d.status === 'deploying').length,
      avgDuration: 0,
    };
  }

  async findRollbackTarget(tenantId: string, environment: string, excludeId: string): Promise<Deployment | null> {
    const deployments = Array.from(this.deployments.values())
      .filter(d => d.tenant_id === tenantId && d.environment === environment && d.id !== excludeId && d.status === 'success')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return deployments[0] || null;
  }

  clear(): void {
    this.deployments.clear();
    this.events.clear();
    this._createCounter = 0;
  }
}

class MockDeployWindowRepository {
  private windows: Map<string, DeployWindow> = new Map();

  async findById(id: string): Promise<DeployWindow | null> {
    return this.windows.get(id) || null;
  }

  async findAll(options?: any): Promise<DeployWindow[]> {
    let results = Array.from(this.windows.values());
    if (options?.tenantId) results = results.filter(w => w.tenant_id === options.tenantId);
    if (options?.environmentId) results = results.filter(w => w.environment_id === options.environmentId);
    if (options?.status) results = results.filter(w => w.status === options.status);
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  async count(options?: any): Promise<number> {
    // Count should not apply pagination - real repo runs separate COUNT(*) query
    const { offset, limit, ...filterOptions } = options || {};
    let results = Array.from(this.windows.values());
    if (filterOptions?.tenantId) results = results.filter(w => w.tenant_id === filterOptions.tenantId);
    if (filterOptions?.environmentId) results = results.filter(w => w.environment_id === filterOptions.environmentId);
    if (filterOptions?.status) results = results.filter(w => w.status === filterOptions.status);
    return results.length;
  }

  async create(input: CreateDeployWindowInput): Promise<DeployWindow> {
    const id = `window-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const window: DeployWindow = {
      id,
      tenant_id: input.tenant_id,
      environment_id: input.environment_id || null,
      name: input.name,
      cron_expression: input.cron_expression,
      duration_minutes: input.duration_minutes || 60,
      timezone: input.timezone || 'UTC',
      status: 'active',
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    this.windows.set(id, window);
    return window;
  }

  async update(id: string, input: any): Promise<DeployWindow | null> {
    const window = this.windows.get(id);
    if (!window) return null;
    const updated = { ...window, ...input, updated_at: new Date() };
    this.windows.set(id, updated);
    return updated;
  }

  async softDelete(id: string): Promise<DeployWindow | null> {
    const window = this.windows.get(id);
    if (!window) return null;
    window.status = 'deleted';
    window.updated_at = new Date();
    return window;
  }

  async getActiveWindows(tenantId: string, environmentId: string): Promise<DeployWindow[]> {
    return Array.from(this.windows.values())
      .filter(w => w.tenant_id === tenantId && w.environment_id === environmentId && w.status === 'active');
  }

  clear(): void {
    this.windows.clear();
  }
}

describe('Deploy Integration - Deploy Window + Deployment', () => {
  let deployRepo: MockDeployRepository;
  let deployService: DeployService;
  let windowRepo: MockDeployWindowRepository;
  let windowService: DeployWindowService;

  beforeEach(() => {
    deployRepo = new MockDeployRepository();
    deployService = new DeployService(deployRepo as any);

    windowRepo = new MockDeployWindowRepository();
    windowService = new DeployWindowService(windowRepo as any);
  });

  afterEach(() => {
    deployRepo.clear();
    windowRepo.clear();
  });

  describe('E2E: Deploy Window CRUD', () => {
    it('should create a deploy window', async () => {
      const window = await windowService.createWindow({
        tenant_id: 'tenant-1',
        environment_id: 'env-staging',
        name: 'Weekday Deploy Window',
        cron_expression: '0 10 * * 1-5', // 10am UTC Mon-Fri
        duration_minutes: 120,
        timezone: 'UTC',
        created_by: 'admin',
      });

      expect(window.id).toBeDefined();
      expect(window.name).toBe('Weekday Deploy Window');
      expect(window.status).toBe('active');
      expect(window.cron_expression).toBe('0 10 * * 1-5');
    });

    it('should reject window without required fields', async () => {
      await expect(windowService.createWindow({
        tenant_id: 'tenant-1',
        name: '',
        cron_expression: '0 10 * * 1-5',
        created_by: 'admin',
      })).rejects.toThrow('name is required');

      await expect(windowService.createWindow({
        tenant_id: 'tenant-1',
        name: 'test',
        cron_expression: '',
        created_by: 'admin',
      } as any)).rejects.toThrow('cron_expression is required');

      await expect(windowService.createWindow({
        tenant_id: 'tenant-1',
        name: 'test',
        cron_expression: '0 10 * * 1-5',
        created_by: '',
      })).rejects.toThrow('created_by is required');
    });

    it('should list windows with pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await windowService.createWindow({
          tenant_id: 'tenant-1',
          environment_id: 'env-staging',
          name: `Window ${i}`,
          cron_expression: `0 ${10 + i} * * *`,
          duration_minutes: 60,
          created_by: 'admin',
        });
      }

      const result = await windowService.listWindows({ page: 1, limit: 3 });
      expect(result.data.length).toBeLessThanOrEqual(3);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(2);
    });

    it('should update a deploy window', async () => {
      const window = await windowService.createWindow({
        tenant_id: 'tenant-1',
        environment_id: 'env-staging',
        name: 'Original Window',
        cron_expression: '0 10 * * *',
        duration_minutes: 60,
        created_by: 'admin',
      });

      const updated = await windowService.updateWindow(window.id, {
        name: 'Updated Window',
        duration_minutes: 120,
      });

      expect(updated.name).toBe('Updated Window');
      expect(updated.duration_minutes).toBe(120);
    });

    it('should soft delete a deploy window', async () => {
      const window = await windowService.createWindow({
        tenant_id: 'tenant-1',
        environment_id: 'env-staging',
        name: 'To Delete',
        cron_expression: '0 10 * * *',
        duration_minutes: 60,
        created_by: 'admin',
      });

      const deleted = await windowService.deleteWindow(window.id);
      expect(deleted.status).toBe('deleted');
    });
  });

  describe('E2E: Deploy Window Validation', () => {
    it('should allow deployment when no windows configured', async () => {
      const result = await windowService.checkWindowActive('tenant-1', 'env-staging');
      expect(result.isActive).toBe(true);
      expect(result.message).toContain('No deploy windows configured');
    });

    it('should match window when cron expression is active', async () => {
      await windowRepo.create({
        tenant_id: 'tenant-1',
        environment_id: 'env-staging',
        name: 'Active Window',
        cron_expression: '* * * * *', // every minute
        duration_minutes: 60,
        status: 'active',
        created_by: 'admin',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await windowService.checkWindowActive('tenant-1', 'env-staging');
      expect(result.isActive).toBe(true);
    });

    it('should not match window when outside schedule', async () => {
      // Very specific cron that won't match current time
      await windowRepo.create({
        tenant_id: 'tenant-1',
        environment_id: 'env-staging',
        name: 'Rare Window',
        cron_expression: '30 3 31 2 *', // 3:30am on Feb 31 (never matches)
        duration_minutes: 60,
        status: 'active',
        created_by: 'admin',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await windowService.checkWindowActive('tenant-1', 'env-staging');
      // This should be inactive because Feb 31 doesn't exist
      expect(result.isActive).toBe(false);
    });
  });

  describe('E2E: Deployment Lifecycle', () => {
    it('should create and start a deployment', async () => {
      const deployment = await deployService.createDeployment({
        tenant_id: 'tenant-1',
        environment: 'staging',
        strategy: 'rolling',
        deployed_by: 'test-user',
      });

      expect(deployment.id).toBeDefined();
      expect(deployment.status).toBe('pending');

      const started = await deployService.startDeployment(deployment.id, 'test-user');
      expect(started.status).toBe('deploying');
    });

    it('should list deployments with filters', async () => {
      await deployService.createDeployment({
        tenant_id: 'tenant-1',
        environment: 'staging',
        strategy: 'rolling',
      });
      await deployService.createDeployment({
        tenant_id: 'tenant-1',
        environment: 'production',
        strategy: 'blue-green',
      });

      const stagingDeploys = await deployService.listDeployments({
        tenantId: 'tenant-1',
        environment: 'staging',
      });
      expect(stagingDeploys.data).toHaveLength(1);
      expect(stagingDeploys.data[0].environment).toBe('staging');
    });

    it('should cancel a deployment', async () => {
      const deployment = await deployService.createDeployment({
        tenant_id: 'tenant-1',
        environment: 'staging',
        strategy: 'rolling',
      });

      const cancelled = await deployService.cancelDeployment(deployment.id, 'admin');
      expect(cancelled.status).toBe('cancelled');
    });

    it('should reject starting a non-pending deployment', async () => {
      const deployment = await deployService.createDeployment({
        tenant_id: 'tenant-1',
        environment: 'staging',
        strategy: 'rolling',
      });

      await deployService.startDeployment(deployment.id);

      await expect(deployService.startDeployment(deployment.id))
        .rejects
        .toThrow('Can only start pending deployments');
    });

    it('should get deployment events', async () => {
      const deployment = await deployService.createDeployment({
        tenant_id: 'tenant-1',
        environment: 'staging',
        strategy: 'rolling',
        deployed_by: 'test-user',
      });

      const events = await deployService.getDeploymentEvents(deployment.id);
      // Events are created during createDeployment and startDeployment
      expect(Array.isArray(events)).toBe(true);
    });

    it('should get latest deployment by environment', async () => {
      await deployService.createDeployment({
        tenant_id: 'tenant-1',
        environment: 'staging',
        strategy: 'rolling',
      });
      const latest = await deployService.createDeployment({
        tenant_id: 'tenant-1',
        environment: 'staging',
        strategy: 'blue-green',
      });

      const result = await deployService.getLatestDeployment('tenant-1', 'staging');
      expect(result).not.toBeNull();
      expect(result!.id).toBe(latest.id);
    });

    it('should get deploy statistics', async () => {
      await deployService.createDeployment({
        tenant_id: 'tenant-1',
        environment: 'staging',
        strategy: 'rolling',
      });

      const stats = await deployService.getDeployStats('tenant-1');
      expect(stats.total).toBe(1);
      expect(stats.success).toBe(0);
    });
  });

  describe('E2E: Deploy Window + Deployment Combined Flow', () => {
    it('should check window before deploying', async () => {
      // Create a deploy window
      await windowService.createWindow({
        tenant_id: 'tenant-1',
        environment_id: 'env-staging',
        name: 'Maintenance Window',
        cron_expression: '* * * * *', // Always active for testing
        duration_minutes: 120,
        created_by: 'admin',
      });

      // Check window is active
      const windowCheck = await windowService.checkWindowActive('tenant-1', 'env-staging');
      expect(windowCheck.isActive).toBe(true);

      // Deploy if window allows
      if (windowCheck.isActive) {
        const deployment = await deployService.createDeployment({
          tenant_id: 'tenant-1',
          environment: 'staging',
          strategy: 'rolling',
          deployed_by: 'test-user',
        });
        expect(deployment.status).toBe('pending');
      }
    });
  });
});
