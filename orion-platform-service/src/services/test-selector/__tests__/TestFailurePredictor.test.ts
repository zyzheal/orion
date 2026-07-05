/**
 * TestFailurePredictor 单元测试
 */

import { TestFailurePredictor } from '../TestFailurePredictor';

// 模拟数据库
const createMockDb = () => {
  const store: any[] = [];
  return {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      // INSERT
      if (sql.includes('INSERT')) {
        const row = {
          id: params?.[0],
          tenant_id: params?.[1] || 'default',
          test_id: params?.[2],
          execution_id: params?.[3],
          passed: params?.[4],
          duration: params?.[5],
          failure_message: params?.[6],
          pr_id: params?.[7],
          executed_at: params?.[8],
          created_at: new Date(),
        };
        store.push(row);
        return { rows: [row], rowCount: 1 };
      }
      // SELECT DISTINCT test_id
      if (sql.includes('DISTINCT test_id')) {
        const testIds = [...new Set(store.map(r => r.test_id))];
        return { rows: testIds.map(id => ({ test_id: id })), rowCount: testIds.length };
      }
      // SELECT by test_id
      if (sql.includes('WHERE test_id')) {
        const testId = params?.[0];
        const limit = params?.[1] || 100;
        const rows = store
          .filter(r => r.test_id === testId)
          .sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime())
          .slice(0, limit);
        return { rows, rowCount: rows.length };
      }
      // DELETE by tenant
      if (sql.includes('DELETE') && sql.includes('tenant_id')) {
        const tenantId = params?.[0];
        const count = store.filter(r => r.tenant_id === tenantId).length;
        store.length = 0;
        return { rows: [], rowCount: count };
      }
      // DELETE by executed_at (prune)
      if (sql.includes('DELETE') && sql.includes('executed_at')) {
        const count = store.length;
        store.length = 0;
        return { rows: [], rowCount: count };
      }
      return { rows: [], rowCount: 0 };
    }),
    _store: store,
  };
};

describe('TestFailurePredictor', () => {
  let predictor: TestFailurePredictor;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    predictor = new TestFailurePredictor(mockDb as any);
  });

  afterEach(async () => {
    await predictor.clearHistory();
  });

  describe('predictFailure', () => {
    it('没有历史数据时应返回低默认概率', async () => {
      const prediction = await predictor.predictFailure('new-test');

      expect(prediction.testId).toBe('new-test');
      expect(prediction.failureProbability).toBe(0.1);
      expect(prediction.isFlaky).toBe(false);
      expect(prediction.reasons).toContain('No historical data available');
    });

    it('稳定通过的测试应该有低失败概率', async () => {
      // 添加 10 次全部通过的记录
      for (let i = 0; i < 10; i++) {
        await predictor.updateTestHistory('stable-test', {
          executionId: `exec-${i}`,
          passed: true,
          duration: 500,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        });
      }

      const prediction = await predictor.predictFailure('stable-test');

      expect(prediction.failureProbability).toBeLessThanOrEqual(0.1);
      expect(prediction.isFlaky).toBe(false);
    });

    it('经常失败的测试应该有高失败概率', async () => {
      // 添加 8 次失败的记录
      for (let i = 0; i < 8; i++) {
        await predictor.updateTestHistory('flaky-test', {
          executionId: `exec-${i}`,
          passed: false,
          duration: 800,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
          failureMessage: 'Assertion failed',
        });
      }

      const prediction = await predictor.predictFailure('flaky-test');

      expect(prediction.failureProbability).toBeGreaterThan(0.5);
    });

    it('连续失败应增加预测概率', async () => {
      // 5 次通过
      for (let i = 0; i < 5; i++) {
        await predictor.updateTestHistory('recent-fail-test', {
          executionId: `exec-${i}`,
          passed: true,
          duration: 500,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        });
      }
      // 3 次连续失败
      for (let i = 5; i < 8; i++) {
        await predictor.updateTestHistory('recent-fail-test', {
          executionId: `exec-${i}`,
          passed: false,
          duration: 800,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        });
      }

      const prediction = await predictor.predictFailure('recent-fail-test');

      expect(prediction.reasons.some(r => r.includes('consecutive failure'))).toBe(true);
    });

    it('下降的趋势应增加预测概率', async () => {
      // 前 5 次全部通过
      for (let i = 0; i < 5; i++) {
        await predictor.updateTestHistory('declining-test', {
          executionId: `exec-${i}`,
          passed: true,
          duration: 500,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        });
      }
      // 最近 5 次全部失败
      for (let i = 5; i < 10; i++) {
        await predictor.updateTestHistory('declining-test', {
          executionId: `exec-${i}`,
          passed: false,
          duration: 800,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        });
      }

      const prediction = await predictor.predictFailure('declining-test');

      expect(prediction.reasons.some(r => r.includes('Declining'))).toBe(true);
    });
  });

  describe('updateTestHistory', () => {
    it('应该记录执行历史', async () => {
      await predictor.updateTestHistory('test-001', {
        executionId: 'exec-001',
        passed: true,
        duration: 450,
        timestamp: '2024-01-01T10:00:00.000Z',
      });

      const history = await predictor.getHistory('test-001');
      expect(history).toHaveLength(1);
      expect(history[0].passed).toBe(true);
    });

    it('应该支持批量更新', async () => {
      await predictor.updateTestHistoryBatch([
        {
          testId: 'test-001',
          record: {
            executionId: 'exec-001',
            passed: true,
            duration: 500,
            timestamp: '2024-01-01T10:00:00.000Z',
          },
        },
        {
          testId: 'test-002',
          record: {
            executionId: 'exec-002',
            passed: false,
            duration: 300,
            timestamp: '2024-01-01T10:00:00.000Z',
            failureMessage: 'timeout',
          },
        },
      ]);

      expect(await predictor.getHistory('test-001')).toHaveLength(1);
      expect(await predictor.getHistory('test-002')).toHaveLength(1);
    });
  });

  describe('getFlakyTests', () => {
    it('应该检测抖动测试', async () => {
      // 模拟交替通过/失败的模式
      const results = [true, false, true, false, true, false, true, false, true, false];

      for (let i = 0; i < results.length; i++) {
        await predictor.updateTestHistory('flaky-test', {
          executionId: `exec-${i}`,
          passed: results[i],
          duration: 500 + (i % 3) * 100,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        });
      }

      const flakyTests = await predictor.getFlakyTests();
      expect(flakyTests).toContain('flaky-test');
    });

    it('不应该标记稳定的测试为抖动', async () => {
      for (let i = 0; i < 10; i++) {
        await predictor.updateTestHistory('stable-test', {
          executionId: `exec-${i}`,
          passed: true,
          duration: 500,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        });
      }

      const flakyTests = await predictor.getFlakyTests();
      expect(flakyTests).not.toContain('stable-test');
    });

    it('应该支持自定义阈值', async () => {
      const flakyTests = await predictor.getFlakyTests(30);
      expect(Array.isArray(flakyTests)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('应该返回测试统计信息', async () => {
      for (let i = 0; i < 5; i++) {
        await predictor.updateTestHistory('stats-test', {
          executionId: `exec-${i}`,
          passed: i < 4, // 4/5 通过
          duration: 500 + i * 10,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        });
      }

      const stats = await predictor.getStats('stats-test');

      expect(stats.testId).toBe('stats-test');
      expect(stats.totalRuns).toBe(5);
      expect(stats.passedRuns).toBe(4);
      expect(stats.failedRuns).toBe(1);
      expect(stats.passRate).toBe(0.8);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });

    it('应该正确计算连续失败次数', async () => {
      // 3 次通过
      for (let i = 0; i < 3; i++) {
        await predictor.updateTestHistory('consecutive-test', {
          executionId: `exec-${i}`,
          passed: true,
          duration: 500,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        });
      }
      // 2 次失败（最近）
      for (let i = 3; i < 5; i++) {
        await predictor.updateTestHistory('consecutive-test', {
          executionId: `exec-${i}`,
          passed: false,
          duration: 800,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        });
      }

      const stats = await predictor.getStats('consecutive-test');
      expect(stats.consecutiveFailures).toBe(2);
    });

    it('应该返回空统计对于不存在的测试', async () => {
      const stats = await predictor.getStats('nonexistent');
      expect(stats.totalRuns).toBe(0);
      expect(stats.passRate).toBe(0);
    });
  });

  describe('getAllStats', () => {
    it('应该返回所有测试的统计', async () => {
      await predictor.updateTestHistory('test-001', {
        executionId: 'exec-001',
        passed: true,
        duration: 500,
        timestamp: '2024-01-01T10:00:00.000Z',
      });

      await predictor.updateTestHistory('test-002', {
        executionId: 'exec-002',
        passed: false,
        duration: 300,
        timestamp: '2024-01-01T10:00:00.000Z',
      });

      const allStats = await predictor.getAllStats();
      expect(allStats.length).toBe(2);
    });
  });

  describe('pruneOldHistory', () => {
    it('应该清除旧历史数据', async () => {
      // 旧数据（超过 90 天，使用相对于今天的日期）
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);

      // 新数据
      const newDate = new Date();

      await predictor.updateTestHistory('old-test', {
        executionId: 'exec-old',
        passed: true,
        duration: 500,
        timestamp: oldDate.toISOString(),
      });

      await predictor.updateTestHistory('old-test', {
        executionId: 'exec-new',
        passed: true,
        duration: 500,
        timestamp: newDate.toISOString(),
      });

      const pruned = await predictor.pruneOldHistory(90);

      expect(pruned).toBeGreaterThanOrEqual(1);
    });
  });

  describe('clearHistory', () => {
    it('应该清除所有历史数据', async () => {
      await predictor.updateTestHistory('test-001', {
        executionId: 'exec-001',
        passed: true,
        duration: 500,
        timestamp: '2024-01-01T10:00:00.000Z',
      });

      expect((await predictor.getHistory('test-001'))).toHaveLength(1);

      await predictor.clearHistory();

      expect((await predictor.getHistory('test-001'))).toHaveLength(0);
    });
  });
});
