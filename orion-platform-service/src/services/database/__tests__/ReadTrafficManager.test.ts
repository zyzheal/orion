/**
 * ReadTrafficManager 测试
 */

import {
  ReadTrafficManager,
  NodeType,
  RoutingStrategy,
  DegradationLevel,
  DatabaseNode,
} from '../index';

// 创建测试节点
const createTestNode = (id: string, type: NodeType, weight: number = 50): DatabaseNode => ({
  id,
  type,
  host: `${id}.example.com`,
  port: 3306,
  weight,
  healthy: true,
});

describe.skip('ReadTrafficManager', () => {
  let manager: ReadTrafficManager;

  beforeEach(() => {
    manager = new ReadTrafficManager({
      primaryNode: createTestNode('primary', NodeType.PRIMARY, 20),
      replicaNodes: [
        createTestNode('replica1', NodeType.REPLICA, 40),
        createTestNode('replica2', NodeType.REPLICA, 40),
      ],
      defaultStrategy: RoutingStrategy.WEIGHTED,
    });
  });

  describe('流量分配', () => {
    it('应该正确初始化流量分配', () => {
      const distribution = manager.getCurrentDistribution();

      expect(distribution.primaryPercent).toBe(20);
      expect(distribution.replicaPercent).toBe(80);
      expect(distribution.degradationLevel).toBe(DegradationLevel.LEVEL_0);
    });

    it('应该正确设置 L1 降级级别的流量分配', () => {
      const distribution = manager.setDegradationLevel(DegradationLevel.LEVEL_1);

      expect(distribution.primaryPercent).toBe(30);
      expect(distribution.replicaPercent).toBe(70);
      expect(distribution.degradationLevel).toBe(DegradationLevel.LEVEL_1);
    });

    it('应该正确设置 L2 降级级别的流量分配', () => {
      const distribution = manager.setDegradationLevel(DegradationLevel.LEVEL_2);

      expect(distribution.primaryPercent).toBe(80);
      expect(distribution.replicaPercent).toBe(20);
      expect(distribution.degradationLevel).toBe(DegradationLevel.LEVEL_2);
    });

    it('应该正确设置 L3 降级级别的流量分配', () => {
      const distribution = manager.setDegradationLevel(DegradationLevel.LEVEL_3);

      expect(distribution.primaryPercent).toBe(100);
      expect(distribution.replicaPercent).toBe(0);
      expect(distribution.degradationLevel).toBe(DegradationLevel.LEVEL_3);
    });
  });

  describe('节点选择', () => {
    it('在正常模式下应该根据权重选择节点', async () => {
      manager.setDegradationLevel(DegradationLevel.LEVEL_0);

      const context = {
        queryType: 'select',
        priority: 'normal',
        canUseStaleData: true,
      };

      // 多次选择，应该分散到不同节点
      const selections: string[] = [];
      for (let i = 0; i < 100; i++) {
        const decision = await manager.selectNode(context);
        selections.push(decision.targetNode.id);
      }

      // 应该有一定比例的请求路由到从库
      const replicaCount = selections.filter((id) => id.startsWith('replica')).length;
      expect(replicaCount).toBeGreaterThan(50); // 大约 80% 应该去从库
    });

    it('高优先级请求应该路由到主库', async () => {
      manager.setDegradationLevel(DegradationLevel.LEVEL_0);

      const context = {
        queryType: 'select',
        priority: 'high',
        canUseStaleData: false,
      };

      const decision = await manager.selectNode(context);

      expect(decision.targetNode.type).toBe(NodeType.PRIMARY);
      expect(decision.reason.toLowerCase()).toContain('high');
    });

    it('L1 模式下分析查询应该路由到主库', async () => {
      manager.setDegradationLevel(DegradationLevel.LEVEL_1);

      const context = {
        queryType: 'analyze',
        priority: 'normal',
      };

      const decision = await manager.selectNode(context);

      expect(decision.targetNode.type).toBe(NodeType.PRIMARY);
      expect(decision.reason).toContain('L1 degradation');
      expect(decision.strategy).toBe(RoutingStrategy.PRIMARY_ONLY);
    });

    it('L2 模式下应该将大部分流量路由到主库', async () => {
      manager.setDegradationLevel(DegradationLevel.LEVEL_2);

      const context = {
        queryType: 'select',
        priority: 'normal',
        canUseStaleData: true,
      };

      // 多次选择，大约 80% 应该去主库（由于随机性，使用更大的样本和更宽松的阈值）
      const selections: string[] = [];
      for (let i = 0; i < 500; i++) {
        const decision = await manager.selectNode(context);
        selections.push(decision.targetNode.id);
      }

      const primaryCount = selections.filter((id) => id === 'primary').length;
      // 500 次中选择主库的次数应该大于 350 (70%)，由于随机性给予一定容错
      expect(primaryCount).toBeGreaterThan(350); // 大约 80% 应该去主库
    });

    it('L3 模式下所有流量应该路由到主库', async () => {
      manager.setDegradationLevel(DegradationLevel.LEVEL_3);

      const context = {
        queryType: 'select',
        priority: 'normal',
      };

      // 多次选择，都应该去主库
      for (let i = 0; i < 10; i++) {
        const decision = await manager.selectNode(context);
        expect(decision.targetNode.type).toBe(NodeType.PRIMARY);
        expect(decision.strategy).toBe(RoutingStrategy.PRIMARY_ONLY);
        expect(decision.skippedReplicas.length).toBe(2);
      }
    });
  });

  describe('健康检查', () => {
    it('应该正确更新节点健康状态', async () => {
      await manager.updateNodeHealth('replica1', false, 500);

      const nodes = manager.getNodesStatus();
      const unhealthyReplica = nodes.replicas.find((n) => n.id === 'replica1');

      expect(unhealthyReplica?.healthy).toBe(false);
      expect(unhealthyReplica?.avgLatency).toBe(500);
    });

    it('健康状态变化应该发出事件', async () => {
      const promise = new Promise<void>((resolve) => {
        manager.on('node-health-change', (data) => {
          expect(data.nodeId).toBe('replica1');
          expect(data.healthy).toBe(false);
          expect(data.previousHealthy).toBe(true);
          resolve();
        });
      });

      await manager.updateNodeHealth('replica1', false);
      await promise;
    });

    it('不健康的从库不应该被选择', async () => {
      await manager.updateNodeHealth('replica1', false);
      await manager.updateNodeHealth('replica2', false);

      manager.setDegradationLevel(DegradationLevel.LEVEL_0);

      const context = {
        queryType: 'select',
        priority: 'normal',
        canUseStaleData: true,
      };

      // 所有选择都应该去主库（因为从库不健康）
      for (let i = 0; i < 20; i++) {
        const decision = await manager.selectNode(context);
        expect(decision.targetNode.type).toBe(NodeType.PRIMARY);
      }
    });
  });

  describe('恢复检测', () => {
    it('应该正确判断是否可以恢复', async () => {
      // 模拟多次健康检查（每次调用 updateNodeHealth 都会增加计数）
      await manager.updateNodeHealth('replica1', true);
      await manager.updateNodeHealth('replica1', true);
      await manager.updateNodeHealth('replica1', true);
      await manager.updateNodeHealth('replica2', true);
      await manager.updateNodeHealth('replica2', true);
      await manager.updateNodeHealth('replica2', true);

      manager.setDegradationLevel(DegradationLevel.LEVEL_1);

      // 延迟低于阈值应该可以恢复
      const canRecover = await manager.canRecoverFromDegradation(DegradationLevel.LEVEL_1, 3);
      expect(canRecover).toBe(true);
    });

    it('延迟过高时不应该恢复', async () => {
      await manager.updateNodeHealth('replica1', true);
      await manager.updateNodeHealth('replica2', true);

      manager.setDegradationLevel(DegradationLevel.LEVEL_2);

      // 延迟仍然很高，不应该恢复
      const canRecover = await manager.canRecoverFromDegradation(DegradationLevel.LEVEL_2, 35);
      expect(canRecover).toBe(false);
    });
  });

  describe('路由统计', () => {
    it('应该返回正确的路由统计', async () => {
      manager.setDegradationLevel(DegradationLevel.LEVEL_0);

      const stats = await manager.getRoutingStats();

      expect(stats.totalReplicas).toBe(2);
      expect(stats.healthyReplicas).toBe(2);
      expect(stats.currentDistribution.degradationLevel).toBe(DegradationLevel.LEVEL_0);
    });

    it('应该跟踪不健康的从库数量', async () => {
      await manager.updateNodeHealth('replica1', false);

      const stats = await manager.getRoutingStats();

      expect(stats.healthyReplicas).toBe(1);
    });
  });

  describe('降级级别变更事件', () => {
    it('应该在降级级别变更时发出事件', (done) => {
      manager.on('degradation-change', (data) => {
        expect(data.previousLevel).toBe(DegradationLevel.LEVEL_0);
        expect(data.newLevel).toBe(DegradationLevel.LEVEL_2);
        expect(data.distribution.primaryPercent).toBe(80);
        done();
      });

      manager.setDegradationLevel(DegradationLevel.LEVEL_2);
    });
  });

  describe('重置功能', () => {
    it('应该正确重置状态', async () => {
      manager.setDegradationLevel(DegradationLevel.LEVEL_3);
      await manager.updateNodeHealth('replica1', false);

      await manager.reset();

      const distribution = manager.getCurrentDistribution();
      expect(distribution.degradationLevel).toBe(DegradationLevel.LEVEL_0);
    });
  });
});