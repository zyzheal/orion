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

// Smart mock db for handler repositories - tracks inserted rows per table
function createHandlerMockDb() {
  let idCounter = 0;
  const tables = new Map<string, any[]>();

  function extractTableName(sql: string): string {
    // INSERT INTO table_name / SELECT * FROM table_name / DELETE FROM table_name
    const match = sql.match(/(?:INSERT INTO|FROM|DELETE FROM)\s+(\w+)/i);
    return match?.[1] || 'unknown';
  }

  const mockFn = jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    // INSERT ... RETURNING
    if (sql.includes('INSERT INTO') && sql.includes('RETURNING')) {
      const tableName = extractTableName(sql);
      const row: any = { id: params?.[0] || `row-${++idCounter}` };
      // Store all params as columns for later retrieval
      if (params) {
        // Parse column names from INSERT statement
        const colMatch = sql.match(/INSERT INTO \w+ \(([^)]+)\)/);
        if (colMatch) {
          const cols = colMatch[1].split(',').map(c => c.trim());
          cols.forEach((col, idx) => {
            if (idx < params.length) row[col] = params[idx];
          });
        }
      }
      if (!tables.has(tableName)) tables.set(tableName, []);
      tables.get(tableName)!.push(row);
      return { rows: [row], rowCount: 1 };
    }
    // SELECT ... WHERE node_id
    if (sql.includes('SELECT') && sql.includes('node_id')) {
      return { rows: [], rowCount: 0 };
    }
    // SELECT ... FROM (any table with ORDER BY)
    if (sql.includes('SELECT') && sql.includes('ORDER BY')) {
      const tableName = extractTableName(sql);
      const rows = tables.get(tableName) || [];
      // Return in reverse order (most recent first) for ORDER BY event_time DESC
      return { rows: [...rows].reverse(), rowCount: rows.length };
    }
    // SELECT ... WHERE level
    if (sql.includes('SELECT') && sql.includes('level')) {
      return { rows: [], rowCount: 0 };
    }
    // SELECT COUNT
    if (sql.includes('SELECT COUNT')) {
      return { rows: [{ count: '0' }], rowCount: 1 };
    }
    // UPDATE ... RETURNING
    if (sql.includes('UPDATE') && sql.includes('RETURNING')) {
      return { rows: [{ id: `updated-${++idCounter}` }], rowCount: 1 };
    }
    // DELETE
    if (sql.includes('DELETE')) {
      return { rows: [], rowCount: 0 };
    }
    // Default
    return { rows: [], rowCount: 0 };
  });
  return { query: mockFn, tables };
}

// Smart mock db for lag monitor and traffic manager
function createServiceMockDb() {
  const healthCounts = new Map<string, number>();
  let idCounter = 0;

  const mockFn = jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    // INSERT ... RETURNING
    if (sql.includes('INSERT INTO') && sql.includes('RETURNING')) {
      const row = { id: params?.[0] || `row-${++idCounter}` };
      // Track health count inserts
      if (sql.includes('db_health_check_counts') && params) {
        const nodeId = params[1];
        const count = params[2];
        healthCounts.set(nodeId, count);
      }
      return { rows: [row], rowCount: 1 };
    }
    // SELECT ... WHERE node_id (health check count)
    if (sql.includes('SELECT') && sql.includes('db_health_check_counts') && sql.includes('node_id')) {
      const nodeId = params?.[0];
      const count = healthCounts.get(nodeId) || 0;
      if (count > 0) {
        return { rows: [{ id: `hcc-${nodeId}`, node_id: nodeId, check_count: count, tenant_id: null, created_at: new Date(), updated_at: new Date() }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    // SELECT ... FROM db_replica_statuses
    if (sql.includes('SELECT') && sql.includes('db_replica_statuses')) {
      return { rows: [], rowCount: 0 };
    }
    // SELECT ... db_routing_times
    if (sql.includes('SELECT') && sql.includes('db_routing_times')) {
      return { rows: [], rowCount: 0 };
    }
    // SELECT COUNT
    if (sql.includes('SELECT COUNT')) {
      return { rows: [{ count: '0' }], rowCount: 1 };
    }
    // UPDATE ... RETURNING (health check count)
    if (sql.includes('UPDATE') && sql.includes('db_health_check_counts') && sql.includes('RETURNING')) {
      const countMatch = sql.match(/check_count = \$(\d+)/);
      if (countMatch && params) {
        const countIdx = parseInt(countMatch[1]) - 1;
        const count = params[countIdx];
        const nodeIdIdx = params.length - 1;
        const nid = params[nodeIdIdx];
        healthCounts.set(nid, count);
      }
      return { rows: [{ id: `hcc-updated` }], rowCount: 1 };
    }
    // UPDATE ... RETURNING
    if (sql.includes('UPDATE') && sql.includes('RETURNING')) {
      return { rows: [{ id: `updated-${++idCounter}` }], rowCount: 1 };
    }
    // DELETE
    if (sql.includes('DELETE')) {
      if (sql.includes('db_health_check_counts')) healthCounts.clear();
      return { rows: [], rowCount: 0 };
    }
    // Default
    return { rows: [], rowCount: 0 };
  });
  return { query: mockFn, healthCounts };
}

describe('DatabaseFailoverHandler', () => {
  let handler: DatabaseFailoverHandler;
  let lagMonitor: ReplicationLagMonitor;
  let trafficManager: ReadTrafficManager;
  let serviceDb: ReturnType<typeof createServiceMockDb>;
  let handlerDb: ReturnType<typeof createHandlerMockDb>;

  beforeEach(async () => {
    serviceDb = createServiceMockDb();
    handlerDb = createHandlerMockDb();

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
    }, serviceDb as any);

    trafficManager = new ReadTrafficManager({
      primaryNode: createTestNode('primary', NodeType.PRIMARY, 20),
      replicaNodes: [
        createTestNode('replica1', NodeType.REPLICA, 40),
        createTestNode('replica2', NodeType.REPLICA, 40),
      ],
      defaultStrategy: RoutingStrategy.WEIGHTED,
    }, serviceDb as any);

    handler = new DatabaseFailoverHandler({
      lagMonitor,
      trafficManager,
      enableAutoRecovery: true,
      recoveryCheckInterval: 500,
      recoverySuccessThreshold: 2,
    }, handlerDb as any);
  });

  afterEach(async () => {
    handler.stop();
  });

  describe('初始化状态', () => {
    it('应该正确初始化', async () => {
      handler.start();

      const state = await handler.getCurrentState();

      expect(state.state).toBe(FailoverState.NORMAL);
      expect(state.level).toBe(DegradationLevel.LEVEL_0);
      expect(state.distribution.primaryPercent).toBe(20);
      expect(state.distribution.replicaPercent).toBe(80);

      handler.stop();
    });

    it('应该返回正确的统计信息', async () => {
      handler.start();

      const stats = await handler.getStats();

      expect(stats.currentState).toBe(FailoverState.NORMAL);
      expect(stats.currentLevel).toBe(DegradationLevel.LEVEL_0);
      expect(stats.totalDegradations).toBe(0);
      expect(stats.totalRecoveries).toBe(0);

      handler.stop();
    });
  });

  describe('手动降级', () => {
    it('应该正确设置降级级别', async () => {
      handler.start();
      handler.setDegradationLevel(DegradationLevel.LEVEL_1, 'Manual test');
      // setDegradationLevel doesn't await applyDegradationLevel, so wait for it
      await new Promise(r => setTimeout(r, 50));

      const state = await handler.getCurrentState();
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

  describe('读请求路由', () => {
    it('应该正确路由读请求', async () => {
      handler.start();

      const context = {
        queryType: 'select' as const,
        priority: 'normal' as const,
        canUseStaleData: true,
      };

      const decision = await handler.routeReadRequest(context);

      expect(decision.targetNode).toBeDefined();
      expect(decision.degradationLevel).toBe(DegradationLevel.LEVEL_0);

      handler.stop();
    });

    it('在降级模式下应该正确调整路由', async () => {
      handler.start();
      handler.setDegradationLevel(DegradationLevel.LEVEL_1);
      await new Promise(r => setTimeout(r, 50));

      const analyzeContext = {
        queryType: 'analyze' as const,
        priority: 'normal' as const,
      };

      const decision = await handler.routeReadRequest(analyzeContext);

      expect(decision.targetNode.type).toBe(NodeType.PRIMARY);
      expect(decision.reason).toContain('L1');

      handler.stop();
    });
  });

  describe('恢复功能', () => {
    it('应该记录恢复事件', async () => {
      handler.start();

      // 先触发降级并等待异步完成
      handler.setDegradationLevel(DegradationLevel.LEVEL_2, 'Test degradation');
      await new Promise(r => setTimeout(r, 100));

      const recoveryPromise = new Promise<void>((resolve) => {
        handler.on('recovery', (event) => {
          expect(event.newLevel).toBe(DegradationLevel.LEVEL_1);
          expect(event.previousLevel).toBe(DegradationLevel.LEVEL_2);
          resolve();
        });
      });

      // 手动触发恢复
      handler.setDegradationLevel(DegradationLevel.LEVEL_1, 'Manual recovery');
      await recoveryPromise;
    });

    it('应该正确处理恢复到正常状态', async () => {
      handler.start();

      handler.setDegradationLevel(DegradationLevel.LEVEL_1, 'Test');
      await new Promise(r => setTimeout(r, 100));

      const recoveryPromise = new Promise<void>((resolve) => {
        handler.on('recovery', (event) => {
          expect(event.newLevel).toBe(DegradationLevel.LEVEL_0);
          expect(event.previousLevel).toBe(DegradationLevel.LEVEL_1);
          resolve();
        });
      });

      handler.setDegradationLevel(DegradationLevel.LEVEL_0, 'Full recovery');
      await recoveryPromise;

      const state = await handler.getCurrentState();
      expect(state.state).toBe(FailoverState.NORMAL);
    });
  });

  describe('历史记录', () => {
    it('应该正确记录降级历史', async () => {
      handler.start();

      handler.setDegradationLevel(DegradationLevel.LEVEL_1, 'Test 1');
      await new Promise(r => setTimeout(r, 100));
      handler.setDegradationLevel(DegradationLevel.LEVEL_2, 'Test 2');
      await new Promise(r => setTimeout(r, 100));

      const history = await handler.getDegradationHistory();

      expect(history.length).toBeGreaterThanOrEqual(2);
      // Most recent first (ORDER BY event_time DESC)
      expect(history[0]?.newLevel).toBe(DegradationLevel.LEVEL_2);
      expect(history[1]?.newLevel).toBe(DegradationLevel.LEVEL_1);

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

      const history = await handler.getRecoveryHistory();

      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[history.length - 1]?.newLevel).toBe(DegradationLevel.LEVEL_0);
      expect(history[history.length - 1]?.previousLevel).toBe(DegradationLevel.LEVEL_2);

      handler.stop();
    });
  });

  describe('配置管理', () => {
    it('应该返回正确的配置', async () => {
      const config = handler.getConfig();

      expect(config.enableAutoRecovery).toBe(true);
      expect(config.recoveryCheckInterval).toBe(500);
      expect(config.recoverySuccessThreshold).toBe(2);
    });

    it('应该正确更新配置', async () => {
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
    it('应该正确重置状态', async () => {
      handler.start();
      handler.setDegradationLevel(DegradationLevel.LEVEL_3, 'Test');

      handler.reset();

      const state = await handler.getCurrentState();
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

      const trend = await handler.getLagTrend('replica1.example.com:3306');

      expect(trend).toBeDefined();
      expect(trend.trend).toBe('stable');

      handler.stop();
    });
  });

  describe('节点健康状态', () => {
    it('应该正确设置节点健康状态', async () => {
      await handler.setNodeHealth('replica1', false, 500);

      const nodes = trafficManager.getNodesStatus();
      const unhealthyReplica = nodes.replicas.find((n) => n.id === 'replica1');

      expect(unhealthyReplica?.healthy).toBe(false);
    });
  });
});
