/**
 * DatabaseFailoverHandler 测试
 */

import {
  DatabaseFailoverHandler,
  FailoverState,
  DegradationLevel,
  ReplicationLagMonitor,
  ReadTrafficManager,
  NodeType,
  RoutingStrategy,
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

// Mock 数据库查询函数
const createMockQuery = (slaveStatuses: any[]) => {
  return async (sql: string) => {
    if (sql === 'SHOW SLAVE STATUS') {
      return { rows: slaveStatuses };
    }
    return { rows: [] };
  };
};

describe('DatabaseFailoverHandler', () => {
  let handler: DatabaseFailoverHandler;
  let lagMonitor: ReplicationLagMonitor;
  let trafficManager: ReadTrafficManager;

  beforeEach(() => {
    lagMonitor = new ReplicationLagMonitor({
      checkInterval: 1000,
      executeQuery: createMockQuery([
        {
          Master_Host: 'replica1.example.com',
          Master_Port: '3306',
          Slave_IO_Running: 'Yes',
          Slave_SQL_Running: 'Yes',
          Seconds_Behind_Master: '0',
        },
      ]),
    });

    trafficManager = new ReadTrafficManager({
      primaryNode: createTestNode('primary', NodeType.PRIMARY, 20),
      replicaNodes: [
        createTestNode('replica1', NodeType.REPLICA, 40),
        createTestNode('replica2', NodeType.REPLICA, 40),
      ],
      defaultStrategy: RoutingStrategy.WEIGHTED,
    });

    handler = new DatabaseFailoverHandler({
      lagMonitor,
      trafficManager,
      enableAutoRecovery: true,
      recoveryCheckInterval: 500,
      recoverySuccessThreshold: 2,
    });
  });

  afterEach(() => {
    handler.stop();
  });

  describe('初始化状态', () => {
    it('应该正确初始化', () => {
      handler.start();

      const state = handler.getCurrentState();

      expect(state.state).toBe(FailoverState.NORMAL);
      expect(state.level).toBe(DegradationLevel.LEVEL_0);
      expect(state.distribution.primaryPercent).toBe(20);
      expect(state.distribution.replicaPercent).toBe(80);

      handler.stop();
    });

    it('应该返回正确的统计信息', () => {
      handler.start();

      const stats = handler.getStats();

      expect(stats.currentState).toBe(FailoverState.NORMAL);
      expect(stats.currentLevel).toBe(DegradationLevel.LEVEL_0);
      expect(stats.totalDegradations).toBe(0);
      expect(stats.totalRecoveries).toBe(0);

      handler.stop();
    });
  });

  describe('手动降级', () => {
    it('应该正确设置降级级别', () => {
      handler.start();
      handler.setDegradationLevel(DegradationLevel.LEVEL_1, 'Manual test');

      const state = handler.getCurrentState();
      expect(state.level).toBe(DegradationLevel.LEVEL_1);
      expect(state.state).toBe(FailoverState.DEGRADED);

      handler.stop();
    });

    it('应该记录降级事件', (done) => {
      handler.on('degradation', (event) => {
        expect(event.newLevel).toBe(DegradationLevel.LEVEL_2);
        expect(event.trigger).toBe('manual');
        expect(event.message).toContain('Manual test');
        done();
      });

      handler.start();
      handler.setDegradationLevel(DegradationLevel.LEVEL_2, 'Manual test');
    });
  });

  describe('自动降级触发', () => {
    it('应该在延迟超过阈值时自动触发降级', async () => {
      // 创建高延迟的监控器
      const highLagMonitor = new ReplicationLagMonitor({
        checkInterval: 500,
        executeQuery: createMockQuery([
          {
            Master_Host: 'replica1.example.com',
            Master_Port: '3306',
            Slave_IO_Running: 'Yes',
            Slave_SQL_Running: 'Yes',
            Seconds_Behind_Master: '45',
          },
        ]),
      });

      const highLagHandler = new DatabaseFailoverHandler({
        lagMonitor: highLagMonitor,
        trafficManager,
        enableAutoRecovery: false, // 禁用自动恢复以便测试
      });

      const degradationPromise = new Promise<any>((resolve) => {
        highLagHandler.on('degradation', (event) => resolve(event));
      });

      highLagHandler.start();

      const event = await degradationPromise;

      expect(event.newLevel).toBe(DegradationLevel.LEVEL_2);
      expect(event.maxLag).toBe(45);
      expect(event.trigger).toBe('lag_threshold');

      highLagHandler.stop();
    });
  });

  describe('读请求路由', () => {
    it('应该正确路由读请求', () => {
      handler.start();

      const context = {
        queryType: 'select',
        priority: 'normal',
        canUseStaleData: true,
      };

      const decision = handler.routeReadRequest(context);

      expect(decision.targetNode).toBeDefined();
      expect(decision.degradationLevel).toBe(DegradationLevel.LEVEL_0);

      handler.stop();
    });

    it('在降级模式下应该正确调整路由', () => {
      handler.start();
      handler.setDegradationLevel(DegradationLevel.LEVEL_1);

      const analyzeContext = {
        queryType: 'analyze',
        priority: 'normal',
      };

      const decision = handler.routeReadRequest(analyzeContext);

      expect(decision.targetNode.type).toBe(NodeType.PRIMARY);
      expect(decision.reason).toContain('L1');

      handler.stop();
    });
  });

  describe('告警功能', () => {
    it('应该发出正确的告警', async () => {
      const highLagMonitor = new ReplicationLagMonitor({
        checkInterval: 500,
        executeQuery: createMockQuery([
          {
            Master_Host: 'replica1.example.com',
            Master_Port: '3306',
            Slave_IO_Running: 'Yes',
            Slave_SQL_Running: 'Yes',
            Seconds_Behind_Master: '75',
          },
        ]),
      });

      const alertHandler = new DatabaseFailoverHandler({
        lagMonitor: highLagMonitor,
        trafficManager,
        enableAutoRecovery: false,
      });

      const alertPromise = new Promise<any>((resolve) => {
        alertHandler.on('alert', (alert) => resolve(alert));
      });

      alertHandler.start();

      const alert = await alertPromise;

      expect(alert.severity).toBe('severe');
      expect(alert.level).toBe(DegradationLevel.LEVEL_3);
      expect(alert.maxLag).toBe(75);

      alertHandler.stop();
    });

    it('应该支持自定义告警处理器', async () => {
      let receivedAlert: any = null;

      const highLagMonitor = new ReplicationLagMonitor({
        checkInterval: 500,
        executeQuery: createMockQuery([
          {
            Master_Host: 'replica1.example.com',
            Master_Port: '3306',
            Slave_IO_Running: 'Yes',
            Slave_SQL_Running: 'Yes',
            Seconds_Behind_Master: '15',
          },
        ]),
      });

      const customHandler = new DatabaseFailoverHandler({
        lagMonitor: highLagMonitor,
        trafficManager,
        enableAutoRecovery: false,
        onAlert: (alert) => {
          receivedAlert = alert;
        },
      });

      customHandler.start();

      // 等待告警触发
      await new Promise<void>((resolve) => {
        customHandler.once('alert', () => resolve());
      });

      expect(receivedAlert).toBeDefined();
      expect(receivedAlert.level).toBe(DegradationLevel.LEVEL_1);

      customHandler.stop();
    });
  });

  describe('恢复功能', () => {
    it('应该记录恢复事件', async () => {
      handler.start();

      // 先触发降级
      handler.setDegradationLevel(DegradationLevel.LEVEL_2, 'Test degradation');

      const recoveryPromise = new Promise<any>((resolve) => {
        handler.on('recovery', (event) => resolve(event));
      });

      // 手动触发恢复
      handler.setDegradationLevel(DegradationLevel.LEVEL_1, 'Manual recovery');

      const event = await recoveryPromise;

      expect(event.newLevel).toBe(DegradationLevel.LEVEL_1);
      expect(event.previousLevel).toBe(DegradationLevel.LEVEL_2);

      handler.stop();
    });

    it('应该正确处理恢复到正常状态', async () => {
      handler.start();

      handler.setDegradationLevel(DegradationLevel.LEVEL_1, 'Test');

      const recoveryPromise = new Promise<any>((resolve) => {
        handler.on('recovery', (event) => resolve(event));
      });

      handler.setDegradationLevel(DegradationLevel.LEVEL_0, 'Full recovery');

      const event = await recoveryPromise;

      expect(event.newLevel).toBe(DegradationLevel.LEVEL_0);
      expect(event.previousLevel).toBe(DegradationLevel.LEVEL_1);

      const state = handler.getCurrentState();
      expect(state.state).toBe(FailoverState.NORMAL);

      handler.stop();
    });
  });

  describe('历史记录', () => {
    it('应该正确记录降级历史', () => {
      handler.start();

      handler.setDegradationLevel(DegradationLevel.LEVEL_1, 'Test 1');
      handler.setDegradationLevel(DegradationLevel.LEVEL_2, 'Test 2');

      const history = handler.getDegradationHistory();

      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0]?.newLevel).toBe(DegradationLevel.LEVEL_1);
      expect(history[1]?.newLevel).toBe(DegradationLevel.LEVEL_2);

      handler.stop();
    });

    it('应该正确记录恢复历史', async () => {
      handler.start();

      // 先触发降级并等待
      const degradationPromise = new Promise<void>((resolve) => {
        handler.once('degradation', () => resolve());
      });
      handler.setDegradationLevel(DegradationLevel.LEVEL_2, 'Test');
      await degradationPromise;

      // 触发恢复并等待
      const recoveryPromise = new Promise<void>((resolve) => {
        handler.once('recovery', () => resolve());
      });
      handler.setDegradationLevel(DegradationLevel.LEVEL_0, 'Recovery');
      await recoveryPromise;

      const history = handler.getRecoveryHistory();

      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[history.length - 1]?.newLevel).toBe(DegradationLevel.LEVEL_0);
      expect(history[history.length - 1]?.previousLevel).toBe(DegradationLevel.LEVEL_2);

      handler.stop();
    });

    it('应该正确记录告警历史', async () => {
      const highLagMonitor = new ReplicationLagMonitor({
        checkInterval: 500,
        executeQuery: createMockQuery([
          {
            Master_Host: 'replica1.example.com',
            Master_Port: '3306',
            Slave_IO_Running: 'Yes',
            Slave_SQL_Running: 'Yes',
            Seconds_Behind_Master: '75',
          },
        ]),
      });

      const alertHandler = new DatabaseFailoverHandler({
        lagMonitor: highLagMonitor,
        trafficManager,
        enableAutoRecovery: false,
      });

      alertHandler.start();

      // 等待告警触发
      await new Promise<void>((resolve) => {
        alertHandler.once('alert', () => resolve());
      });

      const history = alertHandler.getAlertHistory();

      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0]?.severity).toBe('severe');

      alertHandler.stop();
    });
  });

  describe('配置管理', () => {
    it('应该返回正确的配置', () => {
      const config = handler.getConfig();

      expect(config.enableAutoRecovery).toBe(true);
      expect(config.recoveryCheckInterval).toBe(500);
      expect(config.recoverySuccessThreshold).toBe(2);
    });

    it('应该正确更新配置', () => {
      handler.updateConfig({
        enableAutoRecovery: false,
        recoverySuccessThreshold: 5,
      });

      const config = handler.getConfig();

      expect(config.enableAutoRecovery).toBe(false);
      expect(config.recoverySuccessThreshold).toBe(5);
    });
  });

  describe('重置功能', () => {
    it('应该正确重置状态', () => {
      handler.start();
      handler.setDegradationLevel(DegradationLevel.LEVEL_3, 'Test');

      handler.reset();

      const state = handler.getCurrentState();
      expect(state.level).toBe(DegradationLevel.LEVEL_0);
      expect(state.state).toBe(FailoverState.NORMAL);

      handler.stop();
    });

    it('重置应该发出事件', (done) => {
      handler.on('reset', () => {
        done();
      });

      handler.reset();
    });
  });

  describe('延迟趋势分析', () => {
    it('应该正确获取延迟趋势', async () => {
      handler.start();

      // 等待初始检查
      await new Promise<void>((resolve) => {
        lagMonitor.once('check-complete', () => resolve());
      });

      const trend = handler.getLagTrend('replica1.example.com:3306');

      expect(trend).toBeDefined();
      expect(trend.trend).toBe('stable');

      handler.stop();
    });
  });

  describe('节点健康状态', () => {
    it('应该正确设置节点健康状态', () => {
      handler.setNodeHealth('replica1', false, 500);

      const nodes = trafficManager.getNodesStatus();
      const unhealthyReplica = nodes.replicas.find((n) => n.id === 'replica1');

      expect(unhealthyReplica?.healthy).toBe(false);
    });
  });
});