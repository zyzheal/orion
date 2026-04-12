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

describe('ReplicationLagMonitor', () => {
  let monitor: ReplicationLagMonitor;

  beforeEach(() => {
    // 使用短间隔进行测试
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
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('延迟检测', () => {
    it('应该正确解析从库状态', async () => {
      monitor.start();

      // 等待第一次检查完成
      await new Promise<void>((resolve) => {
        monitor.once('check-complete', () => resolve());
      });

      const statuses = monitor.getReplicaStatuses();
      expect(statuses.size).toBe(1);

      const status = statuses.get('replica1.example.com:3306');
      expect(status).toBeDefined();
      expect(status?.host).toBe('replica1.example.com');
      expect(status?.ioRunning).toBe(true);
      expect(status?.sqlRunning).toBe(true);
      expect(status?.secondsBehindMaster).toBe(0);
    });

    it('应该正确计算最大延迟', async () => {
      const highLagMonitor = new ReplicationLagMonitor({
        checkInterval: 1000,
        executeQuery: createMockQuery([
          {
            Master_Host: 'replica1.example.com',
            Master_Port: '3306',
            Slave_IO_Running: 'Yes',
            Slave_SQL_Running: 'Yes',
            Seconds_Behind_Master: '25',
          },
          {
            Master_Host: 'replica2.example.com',
            Master_Port: '3306',
            Slave_IO_Running: 'Yes',
            Slave_SQL_Running: 'Yes',
            Seconds_Behind_Master: '15',
          },
        ]),
      });

      highLagMonitor.start();

      await new Promise<void>((resolve) => {
        highLagMonitor.once('check-complete', () => resolve());
      });

      expect(highLagMonitor.getMaxLag()).toBe(25);
      expect(highLagMonitor.getAverageLag()).toBe(20);

      highLagMonitor.stop();
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
      });

      levelChangeMonitor.start();

      // 等待第一次检查完成
      await new Promise<void>((resolve) => {
        levelChangeMonitor.once('check-complete', () => resolve());
      });

      expect(levelChangeMonitor.getCurrentLevel()).toBe(DegradationLevel.LEVEL_0);

      // 模拟延迟增加到 L1
      // 重新创建 monitor 以改变模拟数据
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
      });

      const levelChangePromise = new Promise<any>((resolve) => {
        highLagMonitor.once('level-change', (data) => resolve(data));
      });

      highLagMonitor.start();

      const eventData = await levelChangePromise;
      expect(eventData.newLevel).toBe(DegradationLevel.LEVEL_1);
      expect(eventData.maxLag).toBe(15);

      highLagMonitor.stop();
      levelChangeMonitor.stop();
    });
  });

  describe('趋势分析', () => {
    it('应该正确分析稳定趋势', async () => {
      monitor.start();

      // 添加一些数据点用于趋势分析
      // 等待多次检查完成
      for (let i = 0; i < 3; i++) {
        await new Promise<void>((resolve) => {
          monitor.once('check-complete', () => resolve());
        });
      }

      const trend = monitor.analyzeTrend('replica1.example.com:3306');

      // 延迟为 0，应该是稳定趋势
      expect(trend.trend).toBe('stable');
      expect(trend.rateOfChange).toBe(0);
    });

    it('应该正确分析增长趋势', async () => {
      // 模拟延迟增长的情况
      let currentLag = 0;
      const increasingQuery = async () => {
        currentLag += 2; // 每次增加 2 秒
        return {
          rows: [
            {
              Master_Host: 'replica1.example.com',
              Master_Port: '3306',
              Slave_IO_Running: 'Yes',
              Slave_SQL_Running: 'Yes',
              Seconds_Behind_Master: String(currentLag),
            },
          ],
        };
      };

      const increasingMonitor = new ReplicationLagMonitor({
        checkInterval: 100,
        executeQuery: increasingQuery,
      });

      increasingMonitor.start();

      // 等待多次检查完成以收集趋势数据
      for (let i = 0; i < 5; i++) {
        await new Promise<void>((resolve) => {
          increasingMonitor.once('check-complete', () => resolve());
        });
      }

      const trend = increasingMonitor.analyzeTrend('replica1.example.com:3306');

      // 延迟持续增加，应该是增长趋势
      expect(trend.trend).toBe('increasing');
      expect(trend.rateOfChange).toBeGreaterThan(0);
      expect(trend.predictedLag).toBeGreaterThan(currentLag);

      increasingMonitor.stop();
    });
  });

  describe('告警功能', () => {
    it('应该在达到 L1 时发出警告告警', async () => {
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
      });

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
      });

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
      monitor.start();

      await new Promise<void>((resolve) => {
        monitor.once('check-complete', () => resolve());
      });

      const status = monitor.getStatus();

      expect(status.isMonitoring).toBe(true);
      expect(status.currentLevel).toBe(DegradationLevel.LEVEL_0);
      expect(status.maxLag).toBe(0);
      expect(status.replicaCount).toBe(1);
      expect(status.historySize).toBeGreaterThan(0);
    });
  });
});