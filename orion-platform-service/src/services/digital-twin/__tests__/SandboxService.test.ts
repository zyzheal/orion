/**
 * SandboxService 单元测试
 */

import { SandboxService, SandboxConfig } from '../SandboxService';

describe('SandboxService', () => {
  let service: SandboxService;

  beforeEach(() => {
    service = new SandboxService();
  });

  describe('createSandbox', () => {
    it('应该创建沙箱', async () => {
      const config: SandboxConfig = {
        twinId: 'twin-1',
        name: 'test-sandbox',
      };

      const sandbox = await service.createSandbox(config);

      expect(sandbox.id).toBeDefined();
      expect(sandbox.twinId).toBe('twin-1');
      expect(sandbox.name).toBe('test-sandbox');
      expect(sandbox.status).toBe('running');
      expect(sandbox.healthStatus).toBe('healthy');
      expect(sandbox.endpoint).toContain('sandbox-');
    });

    it('应该支持自定义资源', async () => {
      const config: SandboxConfig = {
        twinId: 'twin-1',
        name: 'resource-sandbox',
        resources: {
          cpu: '1000m',
          memory: '1Gi',
          replicas: 3,
        },
      };

      const sandbox = await service.createSandbox(config);

      expect(sandbox.resources.cpu).toBe('1000m');
      expect(sandbox.resources.memory).toBe('1Gi');
      expect(sandbox.resources.replicas).toBe(3);
    });

    it('应该支持自定义环境变量', async () => {
      const config: SandboxConfig = {
        twinId: 'twin-1',
        name: 'env-sandbox',
        envVars: { DEBUG: 'true', LOG_LEVEL: 'debug' },
        networkIsolation: false,
      };

      const sandbox = await service.createSandbox(config);

      expect(sandbox.envVars.DEBUG).toBe('true');
      expect(sandbox.networkIsolation).toBe(false);
    });

    it('应该支持快照ID', async () => {
      const config: SandboxConfig = {
        twinId: 'twin-1',
        name: 'snapshot-sandbox',
        snapshotId: 'snap-123',
      };

      const sandbox = await service.createSandbox(config);

      expect(sandbox.snapshotId).toBe('snap-123');
    });
  });

  describe('getSandbox', () => {
    it('应该返回沙箱', async () => {
      const config: SandboxConfig = { twinId: 'twin-1', name: 'test' };
      const created = await service.createSandbox(config);

      const result = await service.getSandbox(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
    });

    it('应该返回 null 如果不存在', async () => {
      const result = await service.getSandbox('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listSandboxes', () => {
    it('应该返回所有沙箱', async () => {
      await service.createSandbox({ twinId: 'twin-1', name: 's1' });
      await service.createSandbox({ twinId: 'twin-1', name: 's2' });
      await service.createSandbox({ twinId: 'twin-2', name: 's3' });

      const all = await service.listSandboxes();
      expect(all.length).toBe(3);
    });

    it('应该支持按 twinId 过滤', async () => {
      await service.createSandbox({ twinId: 'twin-1', name: 's1' });
      await service.createSandbox({ twinId: 'twin-1', name: 's2' });
      await service.createSandbox({ twinId: 'twin-2', name: 's3' });

      const filtered = await service.listSandboxes('twin-1');
      expect(filtered.length).toBe(2);
      expect(filtered.every(s => s.twinId === 'twin-1')).toBe(true);
    });
  });

  describe('stopSandbox', () => {
    it('应该停止运行中的沙箱', async () => {
      const config: SandboxConfig = { twinId: 'twin-1', name: 'stop-test' };
      const created = await service.createSandbox(config);

      const stopped = await service.stopSandbox(created.id);

      expect(stopped).not.toBeNull();
      expect(stopped!.status).toBe('stopped');
      expect(stopped!.healthStatus).toBe('unknown');
      expect(stopped!.stoppedAt).toBeDefined();
    });

    it('应该返回 null 如果沙箱不存在', async () => {
      const result = await service.stopSandbox('nonexistent');
      expect(result).toBeNull();
    });

    it('应该返回 null 如果沙箱已经停止', async () => {
      const config: SandboxConfig = { twinId: 'twin-1', name: 'already-stopped' };
      const created = await service.createSandbox(config);
      await service.stopSandbox(created.id);

      const result = await service.stopSandbox(created.id);
      expect(result).toBeNull();
    });
  });

  describe('startSandbox', () => {
    it('应该启动已停止的沙箱', async () => {
      const config: SandboxConfig = { twinId: 'twin-1', name: 'start-test' };
      const created = await service.createSandbox(config);
      await service.stopSandbox(created.id);

      const started = await service.startSandbox(created.id);

      expect(started).not.toBeNull();
      expect(started!.status).toBe('running');
      expect(started!.healthStatus).toBe('healthy');
    });

    it('应该返回 null 如果沙箱不在停止状态', async () => {
      const config: SandboxConfig = { twinId: 'twin-1', name: 'running-test' };
      const created = await service.createSandbox(config);

      const result = await service.startSandbox(created.id);
      expect(result).toBeNull();
    });
  });

  describe('destroySandbox', () => {
    it('应该销毁沙箱', async () => {
      const config: SandboxConfig = { twinId: 'twin-1', name: 'destroy-test' };
      const created = await service.createSandbox(config);

      const result = await service.destroySandbox(created.id);
      expect(result).toBe(true);

      const found = await service.getSandbox(created.id);
      expect(found).toBeNull();
    });

    it('应该返回 false 如果沙箱不存在', async () => {
      const result = await service.destroySandbox('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('应该执行健康检查', async () => {
      const config: SandboxConfig = { twinId: 'twin-1', name: 'health-test' };
      const created = await service.createSandbox(config);

      const health = await service.healthCheck(created.id);

      expect(health).not.toBeNull();
      expect(health!.healthStatus).toBe('healthy');
      expect(health!.lastHealthCheck).toBeDefined();
    });

    it('已停止的沙箱应该返回 unknown', async () => {
      const config: SandboxConfig = { twinId: 'twin-1', name: 'health-stopped' };
      const created = await service.createSandbox(config);
      await service.stopSandbox(created.id);

      const health = await service.healthCheck(created.id);

      expect(health).not.toBeNull();
      expect(health!.healthStatus).toBe('unknown');
    });

    it('应该返回 null 如果沙箱不存在', async () => {
      const result = await service.healthCheck('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listSandboxesByTwin', () => {
    it('应该返回指定孪生的所有沙箱', async () => {
      await service.createSandbox({ twinId: 'twin-1', name: 's1' });
      await service.createSandbox({ twinId: 'twin-1', name: 's2' });
      await service.createSandbox({ twinId: 'twin-2', name: 's3' });

      const sandboxes = await service.listSandboxesByTwin('twin-1');
      expect(sandboxes.length).toBe(2);
    });
  });

  describe('getRunningCount', () => {
    it('应该返回运行中的沙箱数量', async () => {
      await service.createSandbox({ twinId: 'twin-1', name: 'r1' });
      await service.createSandbox({ twinId: 'twin-1', name: 'r2' });
      const s3 = await service.createSandbox({ twinId: 'twin-1', name: 'r3' });
      await service.stopSandbox(s3.id);

      const count = service.getRunningCount();
      expect(count).toBe(2);
    });
  });
});
