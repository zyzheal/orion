/**
 * SmartDeployService 恢复方法测试
 */

import { SmartDeployService } from '../SmartDeployService';

describe('SmartDeployService crash recovery', () => {
  let service: SmartDeployService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      query: jest.fn(),
    };
    // Clear module-level maps
    const mod = require('../SmartDeployService');
    if (mod.activeDeployments) mod.activeDeployments.clear();
    if (mod.rollbackHistory) mod.rollbackHistory.clear();
    if (mod.auditTrails) mod.auditTrails.clear();
  });

  describe('recoverActiveDeployments', () => {
    it.skip('应该恢复运行中的 deployments 到内存 Map', async () => {
      const runningEntity = {
        id: 'deploy-1',
        app_name: 'test-app',
        version: 'v1.0',
        environment: 'production',
        strategy: 'rolling',
        status: 'running',
        started_at: new Date(),
        initiated_by: 'user-1',
      };
      const pendingEntity = {
        id: 'deploy-2',
        app_name: 'test-app',
        version: 'v2.0',
        environment: 'staging',
        strategy: 'blue-green',
        status: 'pending',
        started_at: new Date(),
        initiated_by: 'user-2',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [runningEntity] })
        .mockResolvedValueOnce({ rows: [pendingEntity] });

      service = new SmartDeployService(mockDb as any);
      const restored = await service.recoverActiveDeployments();

      expect(restored).toBe(2);
    });

    it.skip('空数据库时应返回 0', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      service = new SmartDeployService(mockDb as any);
      const restored = await service.recoverActiveDeployments();
      expect(restored).toBe(0);
    });

    it.skip('没有 DB 时应返回 0', async () => {
      service = new SmartDeployService(null);
      const restored = await service.recoverActiveDeployments();
      expect(restored).toBe(0);
    });
  });

  describe('removeActiveDeployment', () => {
    it.skip('应该从活跃 Map 中移除 deployment', async () => {
      const mod = require('../SmartDeployService');
      mod.activeDeployments.set('deploy-1', {
        id: 'deploy-1',
        appName: 'test',
        version: 'v1',
        environment: 'prod',
        strategy: 'rolling',
        status: 'running',
        stages: [],
        currentStageIndex: 0,
        startedAt: new Date(),
        initiatedBy: 'user',
      } as any);

      mod.rollbackHistory.set('deploy-1', []);
      mod.auditTrails.set('deploy-1', []);

      service = new SmartDeployService(mockDb as any);
      service.removeActiveDeployment('deploy-1');

      expect(mod.activeDeployments.has('deploy-1')).toBe(false);
      expect(mod.rollbackHistory.has('deploy-1')).toBe(false);
      expect(mod.auditTrails.has('deploy-1')).toBe(false);
    });
  });
});
