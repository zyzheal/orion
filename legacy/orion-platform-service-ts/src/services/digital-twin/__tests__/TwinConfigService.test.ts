/**
 * TwinConfigService 单元测试
 */

import { TwinConfigService, RegisterTwinInput } from '../TwinConfigService';

describe('TwinConfigService', () => {
  let service: TwinConfigService;

  beforeEach(() => {
    // 不传入 db 时使用内存模式
    service = new TwinConfigService();
  });

  describe('registerTwin', () => {
    it('应该注册新的孪生配置', async () => {
      const input: RegisterTwinInput = {
        name: 'test-twin',
        environment: 'dev',
        services: ['service-a', 'service-b'],
      };

      const result = await service.registerTwin('tenant1', input);

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant1');
      expect(result.config.name).toBe('test-twin');
      expect(result.config.environment).toBe('dev');
      expect(result.config.services).toContain('service-a');
      expect(result.state.status).toBe('active');
      expect(result.state.healthScore).toBe(100);
    });

    it('应该支持可选参数', async () => {
      const input: RegisterTwinInput = {
        name: 'twin-with-options',
        description: 'Test description',
        environment: 'staging',
        services: ['svc'],
        syncInterval: 120,
      };

      const result = await service.registerTwin('tenant1', input);

      expect(result.config.description).toBe('Test description');
      expect(result.config.syncInterval).toBe(120);
      expect(result.config.dataRetentionDays).toBe(30);
    });
  });

  describe('getTwin', () => {
    it('应该返回已注册的孪生', async () => {
      const input: RegisterTwinInput = {
        name: 'get-twin',
        environment: 'prod',
        services: ['svc'],
      };
      const registered = await service.registerTwin('tenant1', input);

      const result = await service.getTwin(registered.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(registered.id);
    });

    it('应该返回 null 如果不存在', async () => {
      const result = await service.getTwin('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listTwins', () => {
    it('应该返回租户下的所有孪生', async () => {
      await service.registerTwin('tenant1', { name: 'twin1', environment: 'dev', services: [] });
      await service.registerTwin('tenant1', { name: 'twin2', environment: 'staging', services: [] });
      await service.registerTwin('tenant2', { name: 'twin3', environment: 'prod', services: [] });

      const tenant1Twins = await service.listTwins('tenant1');
      expect(tenant1Twins.length).toBe(2);

      const tenant2Twins = await service.listTwins('tenant2');
      expect(tenant2Twins.length).toBe(1);
    });
  });

  describe('configureTwin', () => {
    it('应该更新孪生配置', async () => {
      const registered = await service.registerTwin('tenant1', {
        name: 'config-twin',
        environment: 'dev',
        services: ['svc'],
      });

      const updated = await service.configureTwin(registered.id, {
        name: 'updated-name',
        syncInterval: 300,
      });

      expect(updated).not.toBeNull();
      expect(updated!.config.name).toBe('updated-name');
      expect(updated!.config.syncInterval).toBe(300);
    });

    it('应该返回 null 如果孪生不存在', async () => {
      const result = await service.configureTwin('nonexistent', { name: 'new' });
      expect(result).toBeNull();
    });
  });

  describe('getTwinState', () => {
    it('应该返回孪生状态', async () => {
      const registered = await service.registerTwin('tenant1', {
        name: 'state-twin',
        environment: 'dev',
        services: ['svc'],
      });

      const state = await service.getTwinState(registered.id);

      expect(state).not.toBeNull();
      expect(state!.status).toBe('active');
      expect(state!.healthScore).toBe(100);
    });

    it('应该返回 null 如果孪生不存在', async () => {
      const result = await service.getTwinState('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateTwinState', () => {
    it('应该更新孪生状态', async () => {
      const registered = await service.registerTwin('tenant1', {
        name: 'update-state',
        environment: 'dev',
        services: [],
      });

      const updated = await service.updateTwinState(registered.id, {
        status: 'syncing',
        healthScore: 85,
      });

      expect(updated).not.toBeNull();
      expect(updated!.state.status).toBe('syncing');
      expect(updated!.state.healthScore).toBe(85);
    });

    it('应该返回 null 如果孪生不存在', async () => {
      const result = await service.updateTwinState('nonexistent', { status: 'error' });
      expect(result).toBeNull();
    });
  });

  describe('deleteTwin', () => {
    it('应该删除孪生', async () => {
      const registered = await service.registerTwin('tenant1', {
        name: 'delete-twin',
        environment: 'dev',
        services: [],
      });

      const deleted = await service.deleteTwin(registered.id);
      expect(deleted).toBe(true);

      const result = await service.getTwin(registered.id);
      expect(result).toBeNull();
    });

    it('应该返回 false 如果孪生不存在', async () => {
      const result = await service.deleteTwin('nonexistent');
      expect(result).toBe(false);
    });
  });
});
