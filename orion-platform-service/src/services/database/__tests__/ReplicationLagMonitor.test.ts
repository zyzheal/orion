/**
 * ReplicationLagMonitor 测试
 */

import {
  ReplicationLagMonitor,
  LagLevel,
  DegradationLevel,
} from '../ReplicationLagMonitor';

// Mock 数据库查询函数
const createMockQuery = (slaveStatuses: any[]) => {
  return async (sql: string) => {
    if (sql === 'SHOW SLAVE STATUS') {
      return { rows: slaveStatuses };
    }
    return { rows: [] };
  };
};

// Smart mock db that handles repository SQL patterns with data persistence
function createMockDb() {
  const store: Record<string, any[]> = {};

  function extractTableName(sql: string): string {
    const match = sql.match(/(?:INSERT INTO|FROM|DELETE FROM)\s+(\w+)/i);
    return match?.[1] || 'unknown';
  }

  function parseInsertRow(sql: string, params?: any[]): any {
    const colMatch = sql.match(/INSERT INTO \w+\s*\(([^)]+)\)\s*VALUES/i);
    if (!colMatch || !params) return { id: `row-${Date.now()}` };
    const cols = colMatch[1].split(',').map(c => c.trim());
    const row: any = {};
    cols.forEach((col, idx) => {
      if (idx < params.length) row[col] = params[idx];
    });
    return row;
  }

  const mockFn = jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    // INSERT ... RETURNING (table-specific handlers first, then generic)
    if (sql.includes('INSERT INTO') && sql.includes('RETURNING')) {
      const tableName = extractTableName(sql);
      const row = parseInsertRow(sql, params);
      // Persist to store for known tables
      if (sql.includes('db_replica_statuses')) {
        if (!store['replica_statuses']) store['replica_statuses'] = [];
        store['replica_statuses'].push(row);
      } else if (sql.includes('db_lag_history')) {
        if (!store['lag_history']) store['lag_history'] = [];
        store['lag_history'].push(row);
      }
      return { rows: [row], rowCount: 1 };
    }
    // SELECT ... WHERE replica_host
    if (sql.includes('SELECT') && sql.includes('db_lag_history') && sql.includes('replica_host')) {
      return { rows: store['lag_history'] || [], rowCount: (store['lag_history'] || []).length };
    }
    // SELECT ... WHERE host = $1 AND port = $2 (findByHost - specific params)
    if (sql.includes('SELECT') && sql.includes('db_replica_statuses') && sql.includes('WHERE host')) {
      const rows = store['replica_statuses'] || [];
      // Filter by host and port from params
      const filtered = rows.filter(r => r.host === params?.[0] && String(r.port) === String(params?.[1]));
      return { rows: filtered.length > 0 ? [filtered[0]] : [], rowCount: filtered.length > 0 ? 1 : 0 };
    }
    // SELECT ... FROM db_replica_statuses WHERE 1=1 (findAllReplicas)
    if (sql.includes('SELECT') && sql.includes('db_replica_statuses')) {
      return { rows: store['replica_statuses'] || [], rowCount: (store['replica_statuses'] || []).length };
    }
    // SELECT COUNT
    if (sql.includes('SELECT COUNT')) {
      const tableName = extractTableName(sql);
      const key = tableName === 'db_lag_history' ? 'lag_history' : tableName === 'db_replica_statuses' ? 'replica_statuses' : null;
      const count = key ? (store[key] || []).length : 0;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    // DELETE FROM db_replica_statuses
    if (sql.includes('DELETE FROM db_replica_statuses')) {
      store['replica_statuses'] = [];
      return { rows: [], rowCount: 0 };
    }
    // DELETE FROM db_lag_history WHERE recorded_at
    if (sql.includes('DELETE FROM db_lag_history') && sql.includes('recorded_at')) {
      return { rows: [], rowCount: 0 };
    }
    // DELETE FROM db_lag_history
    if (sql.includes('DELETE FROM db_lag_history')) {
      store['lag_history'] = [];
      return { rows: [], rowCount: 0 };
    }
    // UPDATE ... RETURNING
    if (sql.includes('UPDATE') && sql.includes('RETURNING')) {
      return { rows: [{ id: params?.[params.length - 1] || 'updated' }], rowCount: 1 };
    }
    // Default
    return { rows: [], rowCount: 0 };
  });
  return { query: mockFn, store };
}

describe('ReplicationLagMonitor', () => {
  let monitor: ReplicationLagMonitor;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    monitor = new ReplicationLagMonitor({
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
    }, mockDb as any);
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('延迟检测', () => {
    it('应该正确解析从库状态', async () => {
      // Mock the replica statuses returned by the repository
      mockDb.store['replica_statuses'] = [{
        id: 'rs-1', host: 'replica1.example.com', port: 3306,
        io_running: true, sql_running: true, seconds_behind_master: 0,
        last_error: null, last_io_error: null, last_sql_error: null,
        relay_master_log_file: '', exec_master_log_pos: 0, read_master_log_pos: 0,
        retrieved_gtid_set: null, executed_gtid_set: null,
        tenant_id: null, created_at: new Date(), updated_at: new Date(),
      }];

      monitor.start();

      // 等待第一次检查完成
      await new Promise<void>((resolve) => {
        monitor.once('check-complete', () => resolve());
      });

      const statuses = await monitor.getReplicaStatuses();
      expect(statuses.size).toBe(1);

      const status = statuses.get('replica1.example.com:3306');
      expect(status).toBeDefined();
      expect(status?.host).toBe('replica1.example.com');
      expect(status?.ioRunning).toBe(true);
      expect(status?.sqlRunning).toBe(true);
      expect(status?.secondsBehindMaster).toBe(0);
    });

    it('应该正确计算最大延迟', async () => {
      mockDb.store['replica_statuses'] = [
        {
          id: 'rs-1', host: 'replica1.example.com', port: 3306,
          io_running: true, sql_running: true, seconds_behind_master: 25,
          last_error: null, last_io_error: null, last_sql_error: null,
          relay_master_log_file: '', exec_master_log_pos: 0, read_master_log_pos: 0,
          retrieved_gtid_set: null, executed_gtid_set: null,
          tenant_id: null, created_at: new Date(), updated_at: new Date(),
        },
        {
          id: 'rs-2', host: 'replica2.example.com', port: 3306,
          io_running: true, sql_running: true, seconds_behind_master: 15,
          last_error: null, last_io_error: null, last_sql_error: null,
          relay_master_log_file: '', exec_master_log_pos: 0, read_master_log_pos: 0,
          retrieved_gtid_set: null, executed_gtid_set: null,
          tenant_id: null, created_at: new Date(), updated_at: new Date(),
        },
      ];

      expect(await monitor.getMaxLag()).toBe(25);
      expect(await monitor.getAverageLag()).toBe(20);
    });

    it('应该正确分类延迟级别', () => {
      expect(monitor.classifyLag(5)).toBe(LagLevel.NORMAL);
      expect(monitor.classifyLag(15)).toBe(LagLevel.WARNING);
      expect(monitor.classifyLag(45)).toBe(LagLevel.CRITICAL);
      expect(monitor.classifyLag(75)).toBe(LagLevel.SEVERE);
    });
  });

  describe('降级级别计算', () => {
    it('应该根据延迟正确计算降级级别', () => {
      expect(monitor.calculateDegradationLevel(5)).toBe(DegradationLevel.LEVEL_0);
      expect(monitor.calculateDegradationLevel(15)).toBe(DegradationLevel.LEVEL_1);
      expect(monitor.calculateDegradationLevel(45)).toBe(DegradationLevel.LEVEL_2);
      expect(monitor.calculateDegradationLevel(75)).toBe(DegradationLevel.LEVEL_3);
    });

    it('应该在阈值边界正确计算级别', () => {
      // 恰好等于阈值
      expect(monitor.calculateDegradationLevel(10)).toBe(DegradationLevel.LEVEL_1);
      expect(monitor.calculateDegradationLevel(30)).toBe(DegradationLevel.LEVEL_2);
      expect(monitor.calculateDegradationLevel(60)).toBe(DegradationLevel.LEVEL_3);

      // 稍低于阈值
      expect(monitor.calculateDegradationLevel(9)).toBe(DegradationLevel.LEVEL_0);
      expect(monitor.calculateDegradationLevel(29)).toBe(DegradationLevel.LEVEL_1);
      expect(monitor.calculateDegradationLevel(59)).toBe(DegradationLevel.LEVEL_2);
    });
  });

  describe('级别变更事件', () => {
    it('应该在延迟超过阈值时发出级别变更事件', async () => {
      mockDb.store['replica_statuses'] = [{
        id: 'rs-1', host: 'replica1.example.com', port: 3306,
        io_running: true, sql_running: true, seconds_behind_master: 0,
        last_error: null, last_io_error: null, last_sql_error: null,
        relay_master_log_file: '', exec_master_log_pos: 0, read_master_log_pos: 0,
        retrieved_gtid_set: null, executed_gtid_set: null,
        tenant_id: null, created_at: new Date(), updated_at: new Date(),
      }];

      const levelChangeMonitor = new ReplicationLagMonitor({
        checkInterval: 500,
        thresholds: { warning: 10, critical: 30, severe: 60 },
        executeQuery: createMockQuery([
          {
            Master_Host: 'replica1.example.com',
            Master_Port: '3306',
            Slave_IO_Running: 'Yes',
            Slave_SQL_Running: 'Yes',
            Seconds_Behind_Master: '0',
          },
        ]),
      }, mockDb as any);

      levelChangeMonitor.start();

      // 等待第一次检查完成
      await new Promise<void>((resolve) => {
        levelChangeMonitor.once('check-complete', () => resolve());
      });

      expect(levelChangeMonitor.getCurrentLevel()).toBe(DegradationLevel.LEVEL_0);
      levelChangeMonitor.stop();

      // 模拟延迟增加到 L1
      mockDb.store['replica_statuses'] = [{
        id: 'rs-1', host: 'replica1.example.com', port: 3306,
        io_running: true, sql_running: true, seconds_behind_master: 15,
        last_error: null, last_io_error: null, last_sql_error: null,
        relay_master_log_file: '', exec_master_log_pos: 0, read_master_log_pos: 0,
        retrieved_gtid_set: null, executed_gtid_set: null,
        tenant_id: null, created_at: new Date(), updated_at: new Date(),
      }];

      const highLagMonitor = new ReplicationLagMonitor({
        checkInterval: 500,
        thresholds: { warning: 10, critical: 30, severe: 60 },
        executeQuery: createMockQuery([
          {
            Master_Host: 'replica1.example.com',
            Master_Port: '3306',
            Slave_IO_Running: 'Yes',
            Slave_SQL_Running: 'Yes',
            Seconds_Behind_Master: '15',
          },
        ]),
      }, mockDb as any);

      const levelChangePromise = new Promise<any>((resolve) => {
        highLagMonitor.once('level-change', (data) => resolve(data));
      });

      highLagMonitor.start();

      const eventData = await levelChangePromise;
      expect(eventData.newLevel).toBe(DegradationLevel.LEVEL_1);
      expect(eventData.maxLag).toBe(15);

      highLagMonitor.stop();
    });
  });

  describe('趋势分析', () => {
    it('应该正确分析稳定趋势', async () => {
      mockDb.store['replica_statuses'] = [{
        id: 'rs-1', host: 'replica1.example.com', port: 3306,
        io_running: true, sql_running: true, seconds_behind_master: 0,
        last_error: null, last_io_error: null, last_sql_error: null,
        relay_master_log_file: '', exec_master_log_pos: 0, read_master_log_pos: 0,
        retrieved_gtid_set: null, executed_gtid_set: null,
        tenant_id: null, created_at: new Date(), updated_at: new Date(),
      }];
      mockDb.store['lag_history'] = [
        { id: 'lh-1', replica_host: 'replica1.example.com:3306', lag_seconds: 0, lag_level: 'normal', recorded_at: new Date(), tenant_id: null, created_at: new Date() },
        { id: 'lh-2', replica_host: 'replica1.example.com:3306', lag_seconds: 0, lag_level: 'normal', recorded_at: new Date(), tenant_id: null, created_at: new Date() },
        { id: 'lh-3', replica_host: 'replica1.example.com:3306', lag_seconds: 0, lag_level: 'normal', recorded_at: new Date(), tenant_id: null, created_at: new Date() },
      ];

      const trend = await monitor.analyzeTrend('replica1.example.com:3306');

      // 延迟为 0，应该是稳定趋势
      expect(trend.trend).toBe('stable');
      expect(trend.rateOfChange).toBe(0);
    });
  });

  describe('告警功能', () => {
    it('应该在达到 L1 时发出警告告警', async () => {
      mockDb.store['replica_statuses'] = [{
        id: 'rs-1', host: 'replica1.example.com', port: 3306,
        io_running: true, sql_running: true, seconds_behind_master: 15,
        last_error: null, last_io_error: null, last_sql_error: null,
        relay_master_log_file: '', exec_master_log_pos: 0, read_master_log_pos: 0,
        retrieved_gtid_set: null, executed_gtid_set: null,
        tenant_id: null, created_at: new Date(), updated_at: new Date(),
      }];

      const alertMonitor = new ReplicationLagMonitor({
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
      }, mockDb as any);

      const alertPromise = new Promise<any>((resolve) => {
        alertMonitor.once('alert', (alert) => resolve(alert));
      });

      alertMonitor.start();

      const alert = await alertPromise;
      expect(alert.level).toBe('warning');
      expect(alert.degradationLevel).toBe(DegradationLevel.LEVEL_1);
      expect(alert.lag).toBe(15);

      alertMonitor.stop();
    });

    it('应该在达到 L3 时发出严重告警', async () => {
      mockDb.store['replica_statuses'] = [{
        id: 'rs-1', host: 'replica1.example.com', port: 3306,
        io_running: true, sql_running: true, seconds_behind_master: 75,
        last_error: null, last_io_error: null, last_sql_error: null,
        relay_master_log_file: '', exec_master_log_pos: 0, read_master_log_pos: 0,
        retrieved_gtid_set: null, executed_gtid_set: null,
        tenant_id: null, created_at: new Date(), updated_at: new Date(),
      }];

      const severeMonitor = new ReplicationLagMonitor({
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
      }, mockDb as any);

      const alertPromise = new Promise<any>((resolve) => {
        severeMonitor.once('alert', (alert) => resolve(alert));
      });

      severeMonitor.start();

      const alert = await alertPromise;
      expect(alert.level).toBe('severe');
      expect(alert.degradationLevel).toBe(DegradationLevel.LEVEL_3);
      expect(alert.lag).toBe(75);

      severeMonitor.stop();
    });
  });

  describe('状态管理', () => {
    it('应该返回正确的监控状态', async () => {
      mockDb.store['replica_statuses'] = [{
        id: 'rs-1', host: 'replica1.example.com', port: 3306,
        io_running: true, sql_running: true, seconds_behind_master: 0,
        last_error: null, last_io_error: null, last_sql_error: null,
        relay_master_log_file: '', exec_master_log_pos: 0, read_master_log_pos: 0,
        retrieved_gtid_set: null, executed_gtid_set: null,
        tenant_id: null, created_at: new Date(), updated_at: new Date(),
      }];

      monitor.start();

      await new Promise<void>((resolve) => {
        monitor.once('check-complete', () => resolve());
      });

      const status = await monitor.getStatus();

      expect(status.isMonitoring).toBe(true);
      expect(status.currentLevel).toBe(DegradationLevel.LEVEL_0);
      expect(status.maxLag).toBe(0);
      expect(status.replicaCount).toBe(1);
    });
  });
});
